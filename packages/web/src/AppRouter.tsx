import { BrowserRouter, Route, Routes } from "react-router"

import { BuilderPage } from "./pages/BuilderPage/BuilderPage"
import { ErrorsPage } from "./pages/ErrorsPage/ErrorsPage"
import { JobsPage } from "./pages/JobsPage/JobsPage"

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<JobsPage />} />
      <Route path="/builder" element={<BuilderPage />} />
      <Route path="/errors" element={<ErrorsPage />} />
    </Routes>
  </BrowserRouter>
)
