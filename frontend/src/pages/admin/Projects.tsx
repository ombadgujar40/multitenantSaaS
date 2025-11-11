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
import ProjectModal from "@/components/ProjectModal.jsx";
import { motion, AnimatePresence } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import { Card } from "@/components/ui/card";


export default function Projects() {
  const { token, org, data } = empAuth() || custAuth(); // support both contexts if needed
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isReject, setIsReject] = useState()
  const [teamMembers, setTeamMembers] = useState(0)
  const role = 'admin'

  // -------- Fetch Projects ----------
  useEffect(() => {
    const tok = token || localStorage.getItem('token')
    const fetchProjects = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:2000/project/getAllProjects", {
          headers: { Authorization: `Bearer ${tok}` }, params: { role: role }
        });
        setProjects(res.data || []);
        const uniqueIds = res.data.map(e => e.tasks.map(task => task.assignTo?.id).length);
        // console.log(Number(uniqueIds));
        setTeamMembers(Number(uniqueIds))

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
      projectId: "",
      name: "",
      description: "",
      status: "pending"
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
  const handleStatusChange = async (projectId, status) => {
    const tok = token || localStorage.getItem('token')
    try {
      const res = await axios.put(
        `http://127.0.0.1:2000/project/update/${projectId}`,
        { status: status },
        { headers: { Authorization: `Bearer ${tok}` } }
      );
      try {
        const res = await axios.get("http://127.0.0.1:2000/project/getAllProjects", {
          headers: { Authorization: `Bearer ${tok}` }, params: { role: "admin" }
        });
        setProjects(res.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch projects");
      }
      toast.success("Project updated successfully!");


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

      // console.log(completionRate)

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
            onClick={() => {
              setActiveProject(project);
              setIsModalOpen(true);
            }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderKanban className="h-6 w-6 text-primary" />
                </div>

                {/* Show buttons if status = pending, else show badge */}
                {project.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-600 hover:bg-green-50 h-7 px-2 text-xs"
                      onClick={() => handleStatusChange(project.id, "active")}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50 h-7 px-2 text-xs"
                      onClick={() => handleStatusChange(project.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : project.status == 'rejected' ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-600 hover:bg-green-50 h-7 px-2 text-xs"
                      onClick={() => handleStatusChange(project.id, "active")}
                    >
                      Accept
                    </Button>
                    <Badge className={statusColors[project.status]}>
                      {project.status}
                    </Badge>
                  </div>
                ) : (<Badge className={statusColors[project.status]}>
                  {project.status}
                </Badge>)}
              </div>

              <CardTitle className="mt-4">{project.name}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Progress</span>
                  <span className="font-medium">{completionRate}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-primary transition-all duration-300"
                    style={{ width: `${completionRate}%` }}
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
                  <span>{teamMembers || 0} members</span>
                </div>
              </div>
            </CardContent>
          </Card>


        ))}

      </div>
      {isModalOpen && (
        <ProjectModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          project={activeProject}
          token={localStorage.getItem('token')}
          org={org}
          isAdmin={true}
          dt={data}
          role={role}
        />
      )}
    </div>
  );
}
