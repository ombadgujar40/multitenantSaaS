import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCircle2, Mail, Building2, Plus } from "lucide-react";

export default function Customers() {
  const [customers] = useState([
    { id: "1", name: "Neha Sharma", company: "Alpha Ltd", email: "neha@alpha.com", projects: 3, status: "active" },
    { id: "2", name: "Vikram Patel", company: "TechFusion", email: "vikram@tfusion.com", projects: 5, status: "active" },
    { id: "3", name: "Sneha Rao", company: "DesignPro", email: "sneha@designpro.com", projects: 1, status: "inactive" },
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Customers</h1>
          <p className="text-muted-foreground">View and manage clients</p>
        </div>
        <Button className="gradient-primary shadow-glow">
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => (
          <Card key={c.id} className="hover:shadow-lg transition-all hover:-translate-y-1">
            <CardHeader className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <UserCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{c.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{c.company}</p>
                </div>
              </div>
              <Badge variant={c.status === "active" ? "success" : "secondary"}>{c.status}</Badge>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> {c.email}
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> {c.projects} active projects
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
