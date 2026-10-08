import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/Home";
import LabPage from "./pages/Lab";
import { useMe } from "./api/hooks";

const LoginPage = lazy(() => import("./pages/Login"));
const RegisterPage = lazy(() => import("./pages/Register"));
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const MistakesPage = lazy(() => import("./pages/Mistakes"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const NotFoundPage = lazy(() => import("./pages/NotFound"));
const PcPage = lazy(() => import("./pages/Pc"));

export default function App() {
  useMe();
  return (
    <Suspense fallback={<div className="page-pad muted">加载中…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="lab" element={<LabPage />} />
          <Route path="pc" element={<PcPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="mistakes" element={<MistakesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
