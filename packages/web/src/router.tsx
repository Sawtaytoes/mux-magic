import { BrowserRouter, Route, Routes } from "react-router"

import { BuilderPage } from "./pages/BuilderPage"
import { JobsPage } from "./pages/JobsPage"

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<JobsPage />} />
      <Route path="/builder" element={<BuilderPage />} />
    </Routes>
  </BrowserRouter>
)
