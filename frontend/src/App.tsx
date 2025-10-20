import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Projects from "./pages/admin/Projects";
import EmpAdminDashboard from "./pages/employee/EmpDashboard";
import EmpProjects from "./pages/employee/Projects";
import NotFound from "./pages/NotFound";
import CustAdminDashboard from "./pages/customer/CustDashboard";
import CustProject from "./pages/customer/Projects";
import Logout from "./pages/Logout";
import Register from "./pages/Regsiter";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            <Route path="/admin" element={<DashboardLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="projects" element={<Projects />} />
            </Route>


            <Route path="/employee" element={<DashboardLayout />}>
              <Route index element={<EmpAdminDashboard />} />
              <Route path="projects" element={<EmpProjects />} />
            </Route>

            <Route path="/customer" element={<DashboardLayout />}>
              <Route index element={<CustAdminDashboard />} />
              <Route path="projects" element={<CustProject />} />
            </Route>

            <Route path="/logout" element={<Logout />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
