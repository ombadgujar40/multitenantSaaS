import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FolderKanban, Calendar, Users } from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: "active" | "completed" | "on-hold";
  dueDate: string;
  team: number;
  progress: number;
}

export default function Projects() {
  const [projects] = useState<Project[]>([
    { id: "1", name: "Website Redesign", status: "active", dueDate: "2024-12-31", team: 5, progress: 65 },
    { id: "2", name: "Mobile App Development", status: "active", dueDate: "2024-11-15", team: 8, progress: 40 },
    { id: "3", name: "API Integration", status: "completed", dueDate: "2024-10-01", team: 3, progress: 100 },
    { id: "4", name: "Database Migration", status: "on-hold", dueDate: "2024-12-20", team: 4, progress: 20 },
  ]);

  const statusColors = {
    active: "bg-primary text-primary-foreground",
    completed: "bg-success text-success-foreground",
    "on-hold": "bg-warning text-warning-foreground",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Projects</h1>
          <p className="text-muted-foreground">Manage and track all your projects</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
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
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-primary transition-all duration-300"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(project.dueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{project.team} members</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
