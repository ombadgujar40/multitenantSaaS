import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
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

// ------------------ Main Projects Component ------------------
export default function Projects() {
  const { token, org } = empAuth() || custAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // -------- Fetch Projects ----------
  const fetchProjects = async (tok) => {
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
  useEffect(() => {
    const tok = token || localStorage.getItem("token");

    if (tok) fetchProjects(tok);
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
        fetchProjects(tok)
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
      fetchProjects(tok)
      // setProjects((prev) => prev.filter((p) => p.id !== id));
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
                  <Badge>{project.status}</Badge>
                  <Link to={`${project.id}`}>
                  <Badge className={"cursor-pointer"}>View</Badge>
                  </Link>
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


    </div>
  );
}

