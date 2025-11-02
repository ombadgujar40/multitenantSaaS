import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, FolderKanban, CheckSquare, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { custAuth } from "@/contexts/CustContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";


const statsData = [
  { name: "Jan", projects: 12, tasks: 45 },
  { name: "Feb", projects: 19, tasks: 62 },
  { name: "Mar", projects: 15, tasks: 55 },
  { name: "Apr", projects: 22, tasks: 78 },
  { name: "May", projects: 28, tasks: 92 },
  { name: "Jun", projects: 25, tasks: 85 },
];

const pieData = [
  { name: "Completed", value: 45, color: "hsl(var(--success))" },
  { name: "In Progress", value: 30, color: "hsl(var(--primary))" },
  { name: "Pending", value: 25, color: "hsl(var(--warning))" },
];

export default function CustAdminDashboard() {

  const { token } = useAuth()
  const { data } = custAuth()
  const navigate = useNavigate()
  const [CompLen, setCompProjLen] = useState()
  const [ActLen, setActProjLen] = useState()
  const [PendLen, setPendProjLen] = useState()
  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
    const fetchStats = async () => {
      const data = await axios.get(`http://127.0.0.1:2000/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const proComplete = await axios.get("http://127.0.0.1:2000/project/getProjectsStats", {
        headers: { Authorization: `Bearer ${token}` }, params: { role: "customer", status: "completed", id: data.data.id }
      });
      setCompProjLen(proComplete.data.length)
      const proActive = await axios.get("http://127.0.0.1:2000/project/getProjectsStats", {
        headers: { Authorization: `Bearer ${token}` }, params: { role: "customer", status: "active", id: data.data.id }
      });
      setActProjLen(proActive.data.length)
      const proPending = await axios.get("http://127.0.0.1:2000/project/getProjectsStats", {
        headers: { Authorization: `Bearer ${token}` }, params: { role: "customer", status: "pending", id: data.data.id }
      });
      setPendProjLen(proPending.data.length)
    }

    fetchStats()
  }, [token])

  const stats = [
    { title: "Active Projects", value: ActLen, icon: FolderKanban, change: "+2 this month", color: "text-primary" },
    { title: "Completed Projects", value: CompLen, icon: CheckSquare, change: "+3 this month", color: "text-success" },
    { title: "Pending Projects", value: PendLen, icon: CheckSquare, change: "+3 this month", color: "text-warning" },
    { title: "Upcoming Deadlines", value: "4", icon: Calendar, change: "next 7 days", color: "text-warning" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard Customer</h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-success mt-1">{stat.change} from last month</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project & Task Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="projects" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                <Bar dataKey="tasks" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
