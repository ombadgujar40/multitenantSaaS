import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext.jsx";
import { EmpProvider } from "@/contexts/EmpContext.jsx";
import { CustProvider } from "@/contexts/CustContext.jsx"
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
import AdminLogin from "./pages/admin/Login.jsx"
import AdminRegister from "./pages/admin/Register.jsx"
import Task from "./pages/admin/Tasks.jsx"
import Chat from "./pages/admin/Chat.jsx"
import Customers from "./pages/admin/Customers.jsx"
import Employees from "./pages/admin/Employees.jsx"
import Reports from "./pages/admin/Reports.jsx"
import Settings from "./pages/admin/Settings.jsx"
import Deleverables from "./pages/customer/Deleverables.jsx"
import ProjectDetail from "./pages/customer/ProjectDetail.jsx"

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <EmpProvider>
        <CustProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin/login" element={<AdminLogin />} />

                <Route path="/admin" element={<DashboardLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="employees" element={<Employees />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="chats" element={<Chat />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="settings" element={<Settings />} />
                </Route>


                <Route path="/employee" element={<DashboardLayout />}>
                  <Route index element={<EmpAdminDashboard />} />
                  <Route path="projects" element={<EmpProjects />} />
                </Route>

                <Route path="/customer" element={<DashboardLayout />}>
                  <Route index element={<CustAdminDashboard />} />
                  <Route path="projects" element={<CustProject />} />
                  <Route path="completed" element={<Deleverables />} />
                  <Route path="/customer/projects/:projId" element={<ProjectDetail/>}  />
                </Route>

                <Route path="/logout" element={<Logout />} />
                <Route path="/register" element={<Register />} />
                <Route path="/register" element={<Register />} />
                <Route path="/admin/register" element={<AdminRegister />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CustProvider>
      </EmpProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
