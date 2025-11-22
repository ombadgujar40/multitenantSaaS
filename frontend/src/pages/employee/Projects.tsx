import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Calendar,
  Users,
  FolderKanban,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/api/axios.js";
import { empAuth } from "../../contexts/EmpContext";
import { custAuth } from "../../contexts/CustContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Projects() {
  const { token, org } = empAuth() || custAuth();

  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // -------- Fetch Tasks ----------
  useEffect(() => {
    const tok = token || localStorage.getItem("token");

    const fetchTasks = async () => {
      try {
        const tk = token || localStorage.getItem("token");
        const data = await api.get(`http://127.0.0.1:2000/me`, {
          headers: { Authorization: `Bearer ${tk}` },
        });

        const allTasks = await api.get(
          "http://127.0.0.1:2000/task/getAllTasks",
          {
            headers: { Authorization: `Bearer ${tk}` },
            params: { role: "employee", id: data.data.data.id },
          }
        );

        setTasks(allTasks.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch tasks");
      }
    };

    if (tok) fetchTasks();
  }, [token, org]);

  // -------- Status Colors ----------
  const statusColors = {
    pending: "bg-yellow-500 text-black",
    in_progress: "bg-blue-500 text-white",
    completed: "bg-green-500 text-white",
  };

  // -------- Handle Status Update ----------
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      setLoading(true);
      const tk = token || localStorage.getItem("token");

      await api.patch(
        `http://127.0.0.1:2000/task/update/${taskId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${tk}` } }
      );

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      );

      if (selectedTask?.id === taskId)
        setSelectedTask({ ...selectedTask, status: newStatus });

      toast.success(`Task status updated to "${newStatus}"`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update task status");
    } finally {
      setLoading(false);
    }
  };

  // -------- UI ----------
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Tasks</h1>
          <p className="text-muted-foreground">
            Manage and track all your organization’s Tasks
          </p>
        </div>
      </div>

      {/* Task Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tasks?.map((task) => (
          <Card
            key={task.id}
            className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            onClick={() => {
              setSelectedTask(task);
              setIsModalOpen(true);
            }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderKanban className="h-6 w-6 text-primary" />
                </div>

                {/* Replace badge with Select */}
                <Select
                  onValueChange={(val) => handleStatusChange(task.id, val)}
                  value={task.status}
                >
                  <SelectTrigger
                    className={`w-[130px] text-center font-medium border-0 focus:ring-0 ${statusColors[task.status] || "bg-gray-300"}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <CardTitle className="mt-4">{task.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p className="line-clamp-2">{task.description || "No description"}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      })
                      : "No due date"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{task.assignedTo?.name || "Unassigned"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* -------- Task Details Modal -------- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              Detailed information about this task
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong>Description:</strong>
                <p>{selectedTask.description || "No description available."}</p>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <strong>Status:</strong>
                  <div className="mt-1">
                    <Select
                      onValueChange={(val) =>
                        handleStatusChange(selectedTask.id, val)
                      }
                      value={selectedTask.status}
                    >
                      <SelectTrigger
                        className={`w-[140px] text-center font-medium border-0 focus:ring-0 ${statusColors[selectedTask.status] || "bg-gray-300"}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <strong>Due Date:</strong>{" "}
                  {selectedTask.dueDate
                    ? new Date(selectedTask.dueDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "Not specified"}
                </div>
              </div>

              <div>
                <strong>Assigned To:</strong>{" "}
                {selectedTask.assignedTo?.name || "Unassigned"}
              </div>

              <div>
                <strong>Project:</strong>{" "}
                {selectedTask.project?.name || "No project info"}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Loader2 className="animate-spin text-white w-8 h-8" />
        </div>
      )}
    </div>
  );
}
