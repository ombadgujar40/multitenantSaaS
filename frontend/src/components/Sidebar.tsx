import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  LogOut,
  Building2,
  BarChart3,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Sidebar = () => {
  const { token } = useAuth();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [role, setRole] = useState()
  const navigate = useNavigate();

  // ✅ Fetch current user info
  useEffect(() => {
    const getUserData = async () => {
      try {
        const tk = token || localStorage.getItem("token");
        if (!tk) return;

        const res = await axios.get("http://127.0.0.1:2000/me", {
          headers: {
            Authorization: `Bearer ${tk}`,
          },
        });

        setUserName(res.data.data.name);
        setUserEmail(res.data.data.email);
        setRole(res.data.role)
      } catch (error) {
        console.log("Error fetching user data:", error);
      }
    };

    getUserData();
  }, [token]);

  // ✅ Logout handler
  const Logout = () => {
    navigate("/logout");
  };

  // 🔹 Admin Links
  const adminLinks = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/employees", label: "Employees", icon: Users },
    { to: "/admin/customers", label: "Customers", icon: Users },
    { to: "/admin/projects", label: "Projects", icon: FolderKanban },
    { to: "/admin/tasks", label: "Tasks", icon: CheckSquare },
    { to: "/admin/chats", label: "Chat", icon: MessageSquare },
    { to: "/admin/reports", label: "Reports", icon: BarChart3 },
    { to: "/admin/settings", label: "Settings", icon: Settings },
  ];

  // 🔹 Employee Links
  const employeeLinks = [
    { to: "/employee", label: "Dashboard", icon: LayoutDashboard },
    { to: "/employee/projects", label: "My Projects", icon: FolderKanban },
    { to: "/employee/tasks", label: "My Tasks", icon: CheckSquare },
    { to: "/employee/chats", label: "Chats", icon: MessageSquare },
    { to: "/employee/reports", label: "Reports", icon: BarChart3 },
    { to: "/employee/settings", label: "Settings", icon: Settings },
  ];

  // 🔹 Customer / Client Links
  const customerLinks = [
    { to: "/customer", label: "Dashboard", icon: LayoutDashboard },
    { to: "/customer/projects", label: "My Projects", icon: FolderKanban },
    { to: "/customer/tasks", label: "Deliverables", icon: CheckSquare },
    { to: "/customer/chats", label: "Support / Chat", icon: MessageSquare },
    { to: "/customer/reports", label: "Progress", icon: BarChart3 },
    { to: "/customer/settings", label: "Settings", icon: Settings },
  ];

  // ✅ Choose links based on role
  const links =
    role === "admin"
      ? adminLinks
      : role === "employee"
      ? employeeLinks
      : role === "customer" || role === "client"
      ? customerLinks
      : [];


  return (
    <div className="flex flex-col h-screen w-64 bg-card border-r border-border">
      {/* --- Header Section --- */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary shadow-glow">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg">SaaS Platform</h2>
            <p className="text-xs text-muted-foreground capitalize">
              {role || "user"}
            </p>
          </div>
        </div>
      </div>

      {/* --- Navigation Links --- */}
      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === `/${role}`}
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

      {/* --- Footer Section --- */}
      <div className="p-4 border-t border-border">
        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <p className="text-sm font-medium">{userName || "Loading..."}</p>
          <p className="text-xs text-muted-foreground">{userEmail}</p>
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
