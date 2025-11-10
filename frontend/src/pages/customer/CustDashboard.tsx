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



export default function CustAdminDashboard() {

  const { token } = useAuth()
  const navigate = useNavigate()
  const [CompLen, setCompProjLen] = useState(0)
  const [ActLen, setActProjLen] = useState(0)
  const [PendLen, setPendProjLen] = useState(0)
  useEffect(() => {
    const tk = token || localStorage.getItem('token')
    if (!token) {
      navigate('/login')
    }


    fetchStats()
  }, [token])

  const fetchStats = async () => {
    const tk = token || localStorage.getItem('token')
    const data = await axios.get(`http://127.0.0.1:2000/me`, {
      headers: {
        Authorization: `Bearer ${tk}`
      }
    })

    const res = await axios.get(
      "http://127.0.0.1:2000/project/getAllProjects",
      {
        headers: { Authorization: `Bearer ${tk}` },
        params: { role: "customer" },
      }
    );

    // console.log(res.data[0].status)
    const proComplete = res.data.filter((e) => e.status =='completed')
    const proActive = res.data.filter((e) => e.status =='active')
    const proPending = res.data.filter((e) => e.status =='pending')
    setActProjLen(proActive.length)
    setCompProjLen(proComplete.length)
    setPendProjLen(proPending.length)
  }


  const stats = [
    { title: "Active Projects", value: ActLen, icon: FolderKanban, change: "+2 this month", color: "text-primary" },
    { title: "Completed Projects", value: CompLen, icon: CheckSquare, change: "+3 this month", color: "text-success" },
    { title: "Pending Projects", value: PendLen, icon: CheckSquare, change: "+3 this month", color: "text-warning" },
    { title: "Upcoming Deadlines", value: 0, icon: Calendar, change: "next 7 days", color: "text-warning" },
  ];

  const pieData = [
  { name: "Completed", value: CompLen, color: "hsl(var(--success))" },
  { name: "In Progress", value: ActLen, color: "hsl(var(--primary))" },
  { name: "Pending", value: PendLen, color: "hsl(var(--warning))" },
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
