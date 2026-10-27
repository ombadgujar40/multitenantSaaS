
import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    FolderKanban,
    Calendar,
    Users,
    Download,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/api/axios.js";
import { empAuth } from "../../contexts/EmpContext";
import { custAuth } from "../../contexts/CustContext";

export default function Deleverables() {
    const employeeAuth = empAuth();
    const customerAuth = custAuth();

    // Prefer the customer context on the customer-facing page.
    const auth = customerAuth || employeeAuth;
    const { org } = auth || {};

    const [projects, setProjects] = useState([]);

    useEffect(() => {
        let cancelled = false;

        const fetchProjects = async () => {
            try {
                const res = await api.get("/project/getAllProjects", {
                    params: { role: "customer" },
                });

                console.log("Projects API response:", res.data);

                const projectData = Array.isArray(res.data)
                    ? res.data
                    : Array.isArray(res.data?.projects)
                        ? res.data.projects
                        : [];

                if (!cancelled) {
                    setProjects(projectData);
                }
            } catch (error) {
                console.error(
                    "Failed to fetch projects:",
                    error.response?.status,
                    error.response?.data || error.message
                );

                if (!cancelled) {
                    toast.error("Failed to fetch projects");
                }
            }
        };

        fetchProjects();

        return () => {
            cancelled = true;
        };
    }, [org]);

    const statusColors = {
        active: "bg-primary text-primary-foreground",
        completed: "bg-green-500 text-white",
        "on-hold": "bg-yellow-500 text-black",
        pending: "bg-secondary text-secondary-foreground",
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-4xl font-bold mb-2">
                    Deliverables
                </h1>
                <p className="text-muted-foreground">
                    Manage and track all your organization’s projects
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                    <Card
                        key={project.id}
                        className="hover:shadow-lg transition-all duration-300"
                    >
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <FolderKanban className="h-6 w-6 text-primary" />
                                </div>

                                {project.deliverableLink && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const link = project.deliverableLink;
                                            const url = /^https?:\/\//i.test(link)
                                                ? link
                                                : `https://${link}`;

                                            window.open(
                                                url,
                                                "_blank",
                                                "noopener,noreferrer"
                                            );
                                        }}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download / Open
                                    </Button>
                                )}
                            </div>

                            <CardTitle className="mt-4">
                                {project.name}
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-4 text-sm text-muted-foreground">
                            <div className="flex justify-between items-center">
                                <span>Status</span>
                                <span
                                    className={`rounded-md px-2 py-1 ${
                                        statusColors[project.status] ||
                                        "bg-muted text-foreground"
                                    }`}
                                >
                                    {project.status || "Unknown"}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span>Progress</span>
                                    <span className="font-medium">
                                        {project.progress ?? 0}%
                                    </span>
                                </div>

                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{
                                            width: `${Math.min(
                                                100,
                                                Math.max(
                                                    0,
                                                    Number(project.progress) || 0
                                                )
                                            )}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span>
                                        {project.dueDate
                                            ? new Date(
                                                project.dueDate
                                            ).toLocaleDateString()
                                            : "No due date"}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <span>
                                        {project.team ?? 0} members
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {projects.length === 0 && (
                    <p className="text-muted-foreground col-span-full">
                        No projects found.
                    </p>
                )}
            </div>
        </div>
    );
}
