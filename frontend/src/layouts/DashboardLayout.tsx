import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";

export const DashboardLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 bg-background">
        <Outlet />
      </main>
    </div>
  );
};
