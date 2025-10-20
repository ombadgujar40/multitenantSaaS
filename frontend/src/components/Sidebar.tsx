import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  LogOut,
  Building2,
} from "lucide-react";
import { useState } from "react";

export const Sidebar = () => {
  const { logout, role, name, email } = useAuth();
  const navigate = useNavigate()

  const Logout = () => {
    navigate("/logout")
  }

  const adminLinks = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/employees", label: "Employees", icon: Users },
    { to: "/admin/customers", label: "Customers", icon: Users },
    { to: "/admin/projects", label: "Projects", icon: FolderKanban },
    { to: "/admin/tasks", label: "Tasks", icon: CheckSquare },
    { to: "/admin/chat", label: "Chat", icon: MessageSquare },
  ];

  const links = role === "admin" ? adminLinks : [];

  return (
    <div className="flex flex-col h-screen w-64 bg-card border-r border-border">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary shadow-glow">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg">SaaS Platform</h2>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/admin"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "hover:bg-muted text-muted-foreground"
              )
            }
          >
            <link.icon className="h-5 w-5" />
            <span className="font-medium">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={Logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};
