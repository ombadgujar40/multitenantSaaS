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
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { empAuth } from "../../contexts/EmpContext";
import { custAuth } from "../../contexts/CustContext";

export default function Projects() {
  const { token, org, data } = empAuth() || custAuth(); // support both contexts if needed

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // -------- Fetch Projects ----------
  useEffect(() => {
    const tok = token || localStorage.getItem('token')
    const fetchProjects = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:2000/project/getAllProjects", {
          headers: { Authorization: `Bearer ${tok}` }, params: { role: "admin" }
        });
        setProjects(res.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch projects");
      }
    };
    if (tok) fetchProjects();

  }, [token, org]);


  // -------- Handlers ----------
  const handleAdd = () => {
    setSelectedProject({
      name: "",
      dueDate: "",
      team: "",
      progress: 0,
      status: "active",
    });
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

  // -------- Save (Add / Update) ----------
  const handleSave = async () => {
    try {
      if (isEditMode) {
        const res = await axios.put(
          `http://127.0.0.1:2000/project/update/${selectedProject.id}`,
          selectedProject,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setProjects((prev) =>
          prev.map((p) =>
            p.id === selectedProject.id ? { ...p, ...res.data.project } : p
          )
        );
        toast.success("Project updated successfully!");
      } else {
        const payload = { ...selectedProject, orgName: org };

        const res = await axios.post(
          `http://127.0.0.1:2000/project/create`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setProjects((prev) => [...prev, res.data.project]);
        toast.success("Project added successfully!");
      }

      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Action failed! Check console for details.");
    }
  };

  // -------- Delete ----------
  const handleDelete = async (id) => {
    const confirmation = confirm("Do you want to delete this project?");
    if (!confirmation) return;

    try {
      await axios.delete(`http://127.0.0.1:2000/project/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Project deleted successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete project");
    }
  };

  // -------- UI ----------
  const statusColors = {
    active: "bg-primary text-primary-foreground",
    completed: "bg-green-500 text-white",
    "on-hold": "bg-yellow-500 text-black",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Projects</h1>
          <p className="text-muted-foreground">
            Manage and track all your organization’s projects
          </p>
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderKanban className="h-6 w-6 text-primary" />
                </div>
                <Badge className={statusColors[project.status]}>
                  {project.status}
                </Badge>
              </div>
              <CardTitle className="mt-4">{project.name}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Progress</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-primary transition-all duration-300"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
