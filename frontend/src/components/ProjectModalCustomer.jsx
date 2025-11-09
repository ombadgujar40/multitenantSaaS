import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Users, Calendar, FolderKanban } from "lucide-react";

export default function ProjectModalCustomer({
  open,
  onClose,
  project,
  token,
}) {
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!project) return;
      try {
        const res = await axios.get(
          `http://127.0.0.1:2000/task/getProjectTasks/${project.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Unique team members count
        const uniqueIds = [...new Set(data.map((t) => t.assignedTo?.id))];
        setTeamMembers(uniqueIds.length);

        // Calculate progress percentage
        const completed = data.filter((t) => t.status === "completed").length;
        const total = data.length;
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
        setProgress(progressPercent);

        setTasks(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load project tasks");
      }
    };
    fetchTasks();
  }, [project, token]);

  if (!project || !open) return null;

  return (
    <div className="w-[90vw] h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col p-6">
      {/* Header */}
      <div className="border-b pb-3 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            {project.name}
          </h2>
          <p className="text-muted-foreground mt-1">
            {project.description || "No project description available."}
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
        >
          Close
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 overflow-hidden">
        {/* ---------- Left Panel: Project Overview ---------- */}
        <div className="bg-muted/30 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-2">Project Overview</h3>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{teamMembers} team members</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Started on:{" "}
                {project.createdAt
                  ? new Date(project.createdAt).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>

            <div>
              <span className="text-sm font-medium">Progress</span>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs mt-1 text-muted-foreground">{progress}% completed</p>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Status:{" "}
              <span
                className={`font-medium ${project.status === "completed"
                  ? "text-green-600"
                  : project.status === "active"
                    ? "text-blue-600"
                    : "text-yellow-600"
                  }`}
              >
                {project.status}
              </span>
            </p>
          </div>
        </div>

        {/* ---------- Right Panel: Task List ---------- */}
        <div className="bg-muted/30 rounded-xl p-5 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Project Tasks</h3>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks added yet for this project.
            </p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-base">{task.title}</h4>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${task.status === "completed"
                        ? "bg-green-100 text-green-600"
                        : task.status === "in_progress"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      {task.status}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mt-1">
                    {task.description || "No description provided."}
                  </p>

                  <div className="text-xs text-muted-foreground mt-3 flex justify-between">
                    <span>
                      Assigned to: {task.assignedTo?.name || "Unassigned"}
                    </span>
                    <span>
                      Due:{" "}
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
