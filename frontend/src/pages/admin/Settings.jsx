import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-4xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground">Manage your preferences and account</p>

      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input placeholder="Admin Name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input placeholder="admin@company.com" />
            </div>
          </div>
          <Button className="gradient-primary shadow-glow mt-2">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label>Enable notifications</Label>
          <Switch checked={notifications} onCheckedChange={setNotifications} />
        </CardContent>
      </Card>
    </div>
  );
}
