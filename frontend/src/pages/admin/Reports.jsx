import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Users, FolderKanban, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import api from "@/api/axios"
import { toast } from "sonner";
import { empAuth } from "../../contexts/EmpContext";

export default function ReportsTab({ token }) {
  const { data } = empAuth();
  const [summaryMetrics, setSummaryMetrics] = useState([]);
  const [projectPerformance, setProjectPerformance] = useState([]);
  const [employeeWorkload, setEmployeeWorkload] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);

  const COLORS = ["#10B981", "#F59E0B", "#EF4444"]; // green, yellow, red

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tk = token || localStorage.getItem("token");

        // ----- Fetch Projects -----
        const projectRes = await api.get("/project/getAllProjects", {
          headers: { Authorization: `Bearer ${tk}` }, params: { role: 'admin' }
        });
        const projects = projectRes.data || [];
        // console.log(projectRes.data)
        
        // ----- Fetch Tasks -----
        const taskRes = await api.get("/task/getAllTasks", {
          headers: { Authorization: `Bearer ${tk}` }, params: { role: "admin" }
        });
        const tasks = taskRes.data || [];
        // console.log(taskRes.data)

        // ----- Fetch Employees -----
        const employees = data || [];

        // ---- 1️⃣ Summary Metrics ----
        const totalProjects = projects.length;
        const activeEmployees = new Set(tasks?.map((t) => t.assignedTo?.id)).size;
        const completionRate =
          projects.length > 0
            ? Math.round(
              projects.reduce((acc, project) => {
                const totalTasks = project.tasks?.length || 0;
                const completedTasks =
                  project.tasks?.filter((t) => t.status === "completed").length || 0;
                const projectProgress =
                  totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
                return acc + projectProgress;
              }, 0) / projects.length
            )
            : 0;

        const tasksInProgress = tasks.filter((t) => t.status == "in_progress").length;
        const overdueTasks = tasks.filter(
          (t) => t.status != "completed" && new Date(t.dueDate) < new Date()
        ).length;

        setSummaryMetrics([
          { title: "Total Projects", value: totalProjects, icon: FolderKanban },
          { title: "Active Employees", value: activeEmployees, icon: Users },
          { title: "Completion Rate", value: `${completionRate}%`, icon: CheckCircle },
          { title: "Tasks in Progress", value: tasksInProgress, icon: Clock },
          { title: "Overdue Tasks", value: overdueTasks, icon: AlertTriangle },
        ]);

        // ---- 2️⃣ Project Performance Table ----
        const projectPerformanceData = projects.map((p) => {
          const projectTasks = tasks.filter((t) => t.projectId === p._id);
          const completed = projectTasks.filter((t) => t.status == "completed").length;
          const total = projectTasks.length || 1;
          const percent = Math.round((completed / total) * 100);
          let status = "On Track";
          if (p.progress < 50) status = "Behind";
          if (p.progress === 100) status = "Completed";

          return {
            name: p.name,
            customer: p.customer.name || "N/A",
            progress: percent,
            done: completed,
            total,
            status,
            deadline: p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "N/A",
          };
        });
        setProjectPerformance(projectPerformanceData);

        // ---- 3️⃣ Employee Workload ----
        const employeeData = employees.map((emp) => {
          const empTasks = tasks.filter((t) => t.assignedTo?.id === emp.id);
          const completed = empTasks.filter((t) => t.status === "completed").length;
          const activeProjects = [
            ...new Set(empTasks.map((t) => t.projectId)),
          ].filter(Boolean).length;
          const efficiency =
            empTasks.length > 0
              ? Math.round((completed / empTasks.length) * 100)
              : 0;
          return {
            name: emp.name,
            assigned: empTasks.length,
            completed,
            projects: activeProjects,
            efficiency,
          };
        });
        setEmployeeWorkload(employeeData);

        // ---- 4️⃣ Upcoming Deadlines ----
        const deadlineData = tasks
          .filter((t) => t.dueDate)
          .sort(
            (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          )
          .slice(0, 6)
          .map((t) => ({
            project: t.project?.name || "N/A",
            task: t.title,
            assignedTo: t.assignedTo?.name || "Unassigned",
            dueDate: new Date(t.dueDate).toLocaleDateString(),
            status: t.status,
          }));
        setUpcomingDeadlines(deadlineData);
      } catch (err) {
        console.error(err);
        toast.error("Error fetching report data");
      }
    };

    

    fetchData();
  }, [token, data]);

  // -------------------------------------------------
  // UI
  // -------------------------------------------------
  return (
    <div className="space-y-8">
      {/* 1️⃣ Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryMetrics.map((metric, idx) => (
          <Card key={idx} className="p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <metric.icon className="h-6 w-6 text-primary" />
              <span className="text-2xl font-semibold">{metric.value}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{metric.title}</p>
          </Card>
        ))}
      </div>

      {/* 2️⃣ Project Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Project Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">Project</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2">Progress</th>
                  <th className="p-2">Tasks</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {projectPerformance.map((p, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.customer}</td>
                    <td className="p-2">
                      <Progress value={p.progress} className="h-2" />
                    </td>
                    <td className="p-2">{p.done} / {p.total}</td>
                    <td className="p-2">
                      <Badge
                        className={
                          p.status === "Completed"
                            ? "bg-green-100 text-green-700"
                            : p.status === "Behind"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-2">{p.deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3️⃣ Employee Workload */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Workload Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">Employee</th>
                  <th className="p-2">Assigned</th>
                  <th className="p-2">Completed</th>
                  <th className="p-2">Active Projects</th>
                  <th className="p-2">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {employeeWorkload.map((e, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{e.name}</td>
                    <td className="p-2">{e.assigned}</td>
                    <td className="p-2">{e.completed}</td>
                    <td className="p-2">{e.projects}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Progress value={e.efficiency} className="h-2 w-24" />
                        <span>{e.efficiency}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 4️⃣ Upcoming Deadlines */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">Project</th>
                  <th className="p-2">Task</th>
                  <th className="p-2">Assigned To</th>
                  <th className="p-2">Due Date</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingDeadlines.map((d, i) => (
                  <tr
                    key={i}
                    className={`border-b ${new Date(d.dueDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                        ? "bg-red-50"
                        : ""
                      }`}
                  >
                    <td className="p-2">{d.project}</td>
                    <td className="p-2">{d.task}</td>
                    <td className="p-2">{d.assignedTo}</td>
                    <td className="p-2">{d.dueDate}</td>
                    <td className="p-2 capitalize">{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
