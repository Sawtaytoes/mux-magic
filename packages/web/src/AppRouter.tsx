import { BrowserRouter, Route, Routes } from "react-router"

import { BuilderPage } from "./pages/BuilderPage/BuilderPage"
import { ErrorsPage } from "./pages/ErrorsPage/ErrorsPage"
import { HomePage } from "./pages/HomePage/HomePage"
import { JobsPage } from "./pages/JobsPage/JobsPage"

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/builder" element={<BuilderPage />} />
      <Route path="/errors" element={<ErrorsPage />} />
      <Route path="/jobs" element={<JobsPage />} />
    </Routes>
  </BrowserRouter>
)
