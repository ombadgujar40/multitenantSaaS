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
import { UserCircle2, Mail, Building2, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import api from "@/api/axios"
import { empAuth } from "../../contexts/EmpContext";
import { custAuth } from "../../contexts/CustContext";

export default function Customers() {
  const { token, org, data } = custAuth();

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [orgName, setOrgName] = useState();

  // -------- Fetch Customers ----------
  useEffect(() => {
    if (!data) return;
    setCustomers(data);
    if (org) setOrgName(org)
  }, [data, org]);

  // -------- Handlers ----------
  const handleAdd = (c) => {
    setSelectedCustomer({
      name: "",
      email: "",
    });
    setIsEditMode(false);
    setIsOpen(true);
  };

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setIsEditMode(true);
    setIsOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelectedCustomer((prev) => ({ ...prev, [name]: value }));
  };

  // -------- Save (Add / Update) ----------
  const handleSave = async () => {
    try {
      if (isEditMode) {
        const res = await api.put(
          `http://127.0.0.1:2000/customer/update/${selectedCustomer.id}`,
          selectedCustomer,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setCustomers((prev) =>
          prev.map((c) =>
            c.id === selectedCustomer.id ? { ...c, ...res.data } : c
          )
        );
        toast.success("Customer updated successfully!");
      } else {
        const payload = { ...selectedCustomer, orgName: org, password: `${selectedCustomer.name}` };

        const res = await api.post(`http://127.0.0.1:2000/customer/register`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setCustomers((prev) => [...prev, res.data.customer]);
        toast.success("Customer added successfully!");
      }

      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Action failed! Check console for details.");
    }
  };

  // -------- Delete ----------
  const handleDelete = async (id) => {
    const confirmation = alert("Do you want to delete the user")
    if (confirmation) {
      try {
        await api.delete(`http://127.0.0.1:2000/customer/delete/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setCustomers((prev) => prev.filter((c) => c.id !== id));
        toast.success("Customer deleted successfully!");
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete customer");
      }
    }
  };

  // -------- UI ----------
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Customers</h1>
          <p className="text-muted-foreground">Manage your organization’s clients</p>
        </div>
        <Button className="gradient-primary shadow-glow" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => (
          <Card
            key={c.id}
            className="hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <CardHeader className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <UserCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{c.name}</CardTitle>
                </div>
              </div>
            </CardHeader>

            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> {c.email}
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> {c.projects.length} projects
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleEdit(c)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Customer" : "Add Customer"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update customer details and save your changes."
                : "Enter new customer details to add them to your organization."}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  name="name"
                  value={selectedCustomer.name}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  name="email"
                  value={selectedCustomer.email}
                  onChange={handleChange}
                />
              </div>
              {!isEditMode && (
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
                    name="company"
                    value={org}
                    onChange={handleChange}
                    disabled
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditMode ? "Save Changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
