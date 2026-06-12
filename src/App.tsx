import { TooltipProvider } from "@/components/ui/tooltip"

import SatelliteDemoOverlay from "./SatelliteDemoOverlay"
import SolarDashboard from "./SolarDashboard"

function App() {
  return (
    <TooltipProvider>
      <SolarDashboard />
      <SatelliteDemoOverlay />
    </TooltipProvider>
  )
}

export default App
