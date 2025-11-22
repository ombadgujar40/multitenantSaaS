import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Users, Calendar, FolderKanban } from "lucide-react";
import api from "@/api/axios.js";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";

export default function ProjectDetail({ projectId, token }) {
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const { projId } = useParams();
  const navigate = useNavigate();

  // Fetch project details + tasks
  useEffect(() => {
    if (!projId) return;

    const fetchProjectDetails = async () => {
      const token = localStorage.getItem('token')
      try {
        const res = await api.get(`http://127.0.0.1:2000/project/getProjectDetail/${projId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProject(res.data);

        const taskRes = await api.get(
          `http://127.0.0.1:2000/task/getProjectTasks/${projId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const taskData = taskRes.data || [];
        setTasks(taskData);

        // Extract unique employees assigned to tasks
        const uniqueEmployees = Object.values(
          taskData.reduce((acc, t) => {
            if (t.assignedTo) acc[t.assignedTo.id] = t.assignedTo;
            return acc;
          }, {})
        );
        setTeam(uniqueEmployees);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load project details");
      }
    };

    fetchProjectDetails();
  }, [projId, token]);
  if (!project)
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-muted-foreground">Loading project details...</p>
      </div>
    );

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const progress =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 animate-fade-in">
      {/* Header */}
      <Card className="shadow-md border">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">{project.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {project.org?.name || "Organization"}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-2">
            <Badge
              className={`${project.status === "completed"
                ? "bg-green-500 text-white"
                : project.status === "active"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-300 text-gray-800"
                }`}
            >
              {project.status}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {project.createdAt
                ? new Date(project.createdAt).toLocaleDateString()
                : "No start date"}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <p className="text-muted-foreground">
              {project.description || "No project description provided."}
            </p>
          </div>

          <div>
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 mt-1" />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Team Members */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Team Members
        </h2>

        {team.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No employees assigned yet.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {team.map((member) => (
              <Card
                key={member.id}
                className="p-4 flex flex-col justify-between border hover:shadow-md transition"
              >
                <div>
                  <h3 className="font-medium text-base">{member.name}</h3>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
                <div className="text-xs mt-2 text-muted-foreground">
                  Tasks Assigned:{" "}
                  {
                    tasks.filter((t) => t.assignedTo?.id === member.id).length
                  }
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Tasks Section */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-primary" /> Project Tasks
        </h2>

        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No tasks have been added for this project yet.
          </p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Card
                key={task.id}
                className="p-4 border hover:shadow-md transition"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">{task.title}</h3>
                  <Badge
                    className={`${task.status === "completed"
                      ? "bg-green-100 text-green-600"
                      : task.status === "in_progress"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                      }`}
                  >
                    {task.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {task.description || "No description provided."}
                </p>

                <div className="flex justify-between text-xs text-muted-foreground mt-3">
                  <span>
                    Assigned To: {task.assignedTo?.name || "Unassigned"}
                  </span>
                  <span>
                    Due:{" "}
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                      : "—"}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
