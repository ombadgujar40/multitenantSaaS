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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FolderKanban,
  Calendar,
  Users,
  Pencil,
  Trash2,
  Plus,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { empAuth } from "../../contexts/EmpContext";
import { custAuth } from "../../contexts/CustContext";

// ------------------ Project Viewer Modal ------------------
function ProjectViewerModal({ open, onClose, project, token }) {
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open || !project) return;
    const fetchTasks = async () => {
      try {
        const res = await axios.get(
          `http://127.0.0.1:2000/task/getProjectTasks/${project.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTasks(res.data || []);

        // Calculate % completion
        const completed = res.data.filter((t) => t.status == "completed").length;
        const total = res.data.length;
        setProgress(total ? Math.round((completed / total) * 100) : 0);
      } catch (err) {
        console.error(err);
        toast.error("Unable to load project tasks");
      }
    };
    fetchTasks();
  }, [open, project, token]);

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            {project.name}
          </DialogTitle>
          <DialogDescription>
            {project.description || "No project description provided."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {/* Project Info */}
          <div className="bg-muted/30 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3">Project Details</h3>

            <p className="text-sm mb-2">
              <span className="font-medium">Status:</span>{" "}
              <Badge
                className={
                  project.status === "completed"
                    ? "bg-green-500 text-white"
                    : project.status === "active"
                      ? "bg-primary text-white"
                      : "bg-gray-300 text-black"
                }
              >
                {project.status}
              </Badge>
            </p>

            <p className="text-sm mb-2">
              <span className="font-medium">Due Date:</span>{" "}
              {project.dueDate
                ? new Date(project.dueDate).toLocaleDateString()
                : "Not set"}
            </p>

            <div className="mt-4">
              <p className="font-medium mb-1">Project Progress</p>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs mt-1 text-muted-foreground">
                {progress}% completed
              </p>
            </div>
          </div>

          {/* Task List */}
          <div className="bg-muted/30 rounded-lg p-5 overflow-y-auto max-h-[60vh]">
            <h3 className="text-lg font-semibold mb-3">Tasks</h3>

            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks assigned yet.
              </p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">{task.title}</h4>
                      <Badge
                        className={
                          task.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : task.status === "in_progress"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-600"
                        }
                      >
                        {task.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.description || "No description"}
                    </p>
                    <div className="text-xs text-muted-foreground mt-2 flex justify-between">
                      <span>
                        Assigned to: {task.assignedTo?.name || "Unassigned"}
                      </span>
                      <span>
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString()
                          : "No due date"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------ Main Projects Component ------------------
export default function Projects() {
  const { token, org } = empAuth() || custAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // -------- Fetch Projects ----------
  useEffect(() => {
    const tok = token || localStorage.getItem("token");

    const fetchProjects = async () => {
      try {
        const res = await axios.get(
          "http://127.0.0.1:2000/project/getAllProjects",
          {
            headers: { Authorization: `Bearer ${tok}` },
            params: { role: "customer" },
          }
        );
        setProjects(res.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch projects");
      }
    };

    if (tok) fetchProjects();
  }, [token, org]);

  const handleAdd = () => {
    setSelectedProject({ name: "", description: "", status: "pending" });
    setIsEditMode(false);
    setIsOpen(true);
  };

  const handleEdit = (project) => {
    setSelectedProject(project);
    setIsEditMode(true);
    setIsOpen(true);
  };

  const handleView = (project) => {
    setSelectedProject(project);
    setIsViewOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelectedProject((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const tok = token || localStorage.getItem("token");
    try {
      if (isEditMode) {
        await axios.put(
          `http://127.0.0.1:2000/project/update/${selectedProject.id}`,
          selectedProject,
          { headers: { Authorization: `Bearer ${tok}` } }
        );
        toast.success("Project updated successfully!");
      } else {
        const res = await axios.post(
          `http://127.0.0.1:2000/project/register`,
          selectedProject,
          { headers: { Authorization: `Bearer ${tok}` } }
        );
        setProjects((prev) => [...prev, res.data.project]);
        toast.success("Project added successfully!");
      }

      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Action failed!");
    }
  };

  const handleDelete = async (id) => {
    const confirmation = confirm("Do you want to delete this project?");
    if (!confirmation) return;
    const tok = token || localStorage.getItem("token");
    try {
      await axios.delete(`http://127.0.0.1:2000/project/delete/${id}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Project deleted successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete project");
    }
  };

  const statusColors = {
    active: "bg-primary text-white",
    completed: "bg-green-500 text-white",
    pending: "bg-gray-300 text-black",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Projects</h1>
          <p className="text-muted-foreground">
            Manage and track all your organization’s projects
          </p>
        </div>
        <Button className="gradient-primary shadow-glow" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Project
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(projects || []).filter(Boolean).map((project) => (
          <Card
            key={project.id}
            className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderKanban className="h-6 w-6 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge>{project.status}</Badge>
                </div>
              </div>
              <CardTitle className="mt-4">{project.name}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>{project.description || "No description"}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {project.dueDate
                      ? new Date(project.dueDate).toLocaleDateString()
                      : "No due date"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{project.team || 0} members</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleView(project)}
                >
                  <Eye className="h-4 w-4 mr-1" /> View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(project)}
                >
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(project.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Project" : "Add Project"}
            </DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <div>
                <Label>Project Name</Label>
                <Input
                  name="name"
                  value={selectedProject.name}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  name="description"
                  value={selectedProject.description}
                  onChange={handleChange}
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditMode ? "Save Changes" : "Add Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Project Modal */}
      <ProjectViewerModal
        open={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        project={selectedProject}
        token={localStorage.getItem('token')}
      />
    </div>
  );
}
