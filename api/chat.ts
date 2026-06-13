import { readFile } from "node:fs/promises"
import path from "node:path"

type ChatRequest = {
  question?: string
}

type VercelRequest = {
  method?: string
  body?: ChatRequest
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  send: (body: string) => void
}

async function readDashboardData() {
  const file = path.join(process.cwd(), "src", "data", "inverter-dashboard.json")
  const raw = await readFile(file, "utf8")
  return JSON.parse(raw)
}

function compactContext(data: any) {
  const topInverters = [...data.inverters]
    .sort((a, b) => b.lossEUR - a.lossEUR)
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      status: row.status,
      lossEUR: row.lossEUR,
      lossKWh: row.lossKWh,
      availability: row.availability,
      curtailmentKWh: row.curtailmentKWh,
      downtimeKWh: row.downtimeKWh,
      degradationKWh: row.degradationKWh,
      nonzeroErrors: row.nonzeroErrors,
      state6Events: row.state6Events,
      action: row.lastAction,
    }))

  return {
    generatedFrom: data.generatedFrom,
    assumptions: data.assumptions,
    summary: data.summary,
    topInverters,
    alerts: data.alerts,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed")
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(503).json({
      answer:
        "LLM chat is disabled because OPENAI_API_KEY is not configured on the API server.",
    })
    return
  }

  const question = req.body?.question?.trim()
  if (!question) {
    res.status(400).send("Missing question")
    return
  }

  const data = await readDashboardData()
  const context = compactContext(data)
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini"

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You answer as an operations analyst for an Enerparc solar-plant digital twin dashboard. Use only the supplied JSON context. Be concise, quantify kWh/EUR where possible, and mention assumptions when relevant.",
        },
        {
          role: "user",
          content: `Context JSON:\n${JSON.stringify(context)}\n\nQuestion: ${question}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    res.status(response.status).send(text)
    return
  }

  const payload = await response.json()
  const answer =
    payload.output_text ??
    payload.output?.flatMap((item: any) => item.content ?? [])
      ?.map((item: any) => item.text)
      ?.filter(Boolean)
      ?.join("\n") ??
    "No answer returned."

  res.status(200).json({ answer })
}
