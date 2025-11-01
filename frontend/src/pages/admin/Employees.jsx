import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { empAuth } from "../../contexts/EmpContext";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Briefcase, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

export default function Employees() {
  const { data, token, org } = empAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [orgName, setOrgName] = useState();

  useEffect(() => {
    if (!data) return;
    setEmployees(data);
    if (org) setOrgName(org)
  }, [data, org]);


  // -------------------- HANDLERS --------------------

  const handleEdit = (emp) => {
    setSelectedEmp(emp);
    setIsEditMode(true);
    setIsOpen(true);
  };

  const handleAdd = () => {

    setSelectedEmp({
      name: "",
      email: "",
      password: "", // new employee needs password
      role: "employee",
      jobPosition: "",
    });

    setIsEditMode(false);
    setIsOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelectedEmp((prev) => ({ ...prev, [name]: value }));
  };

  // -------------------- SAVE / ADD --------------------

  const handleSave = async () => {
    try {
      if (isEditMode) {
        // --- EDIT EMPLOYEE ---
        const res = await axios.put(
          `http://127.0.0.1:2000/employee/update/${selectedEmp.id}`,
          selectedEmp,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        toast.success("Employee updated successfully!");

        // Update local state
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === selectedEmp.id ? { ...emp, ...res.data } : emp
          )
        );
      } else {
        // --- ADD NEW EMPLOYEE ---
        if (!orgName) {
          toast.error("Please select an organization before adding!");
          return;
        }

        const payload = {
          ...selectedEmp,
          orgName: orgName, // 👈 Inject orgName here
        };

        console.log("Registering employee with:", payload);

        const res = await axios.post(
          `http://127.0.0.1:2000/employee/register`,
          { orgName: payload.orgName, name: payload.name, email: payload.email, password: payload.password, role: payload.role, designation: payload.jobPosition }
        );

        toast.success("Employee added successfully!");
        setEmployees((prev) => [...prev, res.data.employee]);
      }

      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Action failed! Check console for details.");
    }
  };

  // -------------------- DELETE --------------------

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:2000/employee/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Employee deleted successfully!");
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
    } catch (error) {
      toast.error("Failed to delete employee");
      console.error(error);
    }
  };

  // -------------------- UI --------------------

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Employees</h1>
          <p className="text-muted-foreground">
            Manage all organization employees
          </p>
        </div>
        <Button
          className="gradient-primary shadow-glow"
          onClick={handleAdd}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {employees.map((emp) => (
          <Card
            key={emp.id}
            className="hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <CardHeader className="flex flex-row justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{emp.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{emp.role}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleEdit(emp)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(emp.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> {emp.email}
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> {emp.jobPosition}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add / Edit Modal */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Employee" : "Add Employee"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Update employee details and save your changes."
                  : "Enter new employee information to add them to the organization."}
              </DialogDescription>
            </DialogHeader>

            {selectedEmp && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    name="name"
                    value={selectedEmp.name}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    name="email"
                    value={selectedEmp.email}
                    onChange={handleChange}
                  />
                </div>

                {/* Only show password field for new employee */}
                {!isEditMode && (
                  <>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        name="password"
                        type="password"
                        value={selectedEmp.password}
                        onChange={handleChange}
                      />
                    </div>
                    {/* Organization Select */}
                    <div className="space-y-2">
                      <Label htmlFor="orgSelect">Organization</Label>
                      <Select value={org} disabled>
                        <SelectTrigger id="orgSelect" className="h-11">
                          <SelectValue placeholder="Organization" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={org}>{org}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Job Position</Label>
                  <Input
                    name="jobPosition"
                    value={selectedEmp.jobPosition || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    name="role"
                    value={selectedEmp.role}
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
                {isEditMode ? "Save Changes" : "Add Employee"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
