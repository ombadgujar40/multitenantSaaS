import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Calendar, User, Clock } from "lucide-react";

export default function Tasks() {
  const [tasks] = useState([
    { id: "1", title: "UI Design for Dashboard", assignee: "Aarav", dueDate: "2024-11-12", status: "in-progress" },
    { id: "2", title: "Backend API Integration", assignee: "Priya", dueDate: "2024-11-10", status: "completed" },
    { id: "3", title: "Testing Deployment", assignee: "Rohan", dueDate: "2024-11-20", status: "pending" },
  ]);

  const statusColors = {
    completed: "bg-success text-success-foreground",
    "in-progress": "bg-primary text-primary-foreground",
    pending: "bg-warning text-warning-foreground",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-4xl font-bold mb-2">Tasks</h1>
      <p className="text-muted-foreground mb-4">Track and manage ongoing tasks</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <Card key={task.id} className="hover:shadow-lg transition-all hover:-translate-y-1">
            <CardHeader className="flex justify-between items-start">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" /> {task.title}
              </CardTitle>
              <Badge className={statusColors[task.status]}>{task.status}</Badge>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" /> {task.assignee}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> {task.dueDate}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Deadline approaching
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
