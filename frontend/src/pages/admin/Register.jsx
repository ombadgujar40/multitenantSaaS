import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import axios from "axios";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function AdminRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [designation, setDesignation] = useState("");
  const [isLoad, setIsLoading] = useState(false);
  const [organizationList, setOrganizationList] = useState([]);
  const navigate = useNavigate();

  const role = "admin"; 

  // Fetch all organizations
  useEffect(() => {
    axios
      .get("http://127.0.0.1:2000/organization/all")
      .then((res) => setOrganizationList(res.data.map((org) => org.name)))
      .catch((err) => console.error("Error fetching orgs:", err));
  }, []);

  // Handle Register
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = { orgName, name, email, password, role, designation };
      const res = await axios.post("http://127.0.0.1:2000/employee/register", payload);
      toast.success("Admin registered successfully!");
      navigate("/admin/login");
    } catch (error) {
      console.error("Register Error:", error);
      toast.error(error?.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-subtle">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="p-3 rounded-2xl bg-primary shadow-glow">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>

        {/* Card */}
        <Card className="glass-effect shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl">Admin Registration</CardTitle>
            <CardDescription>Register an admin under an existing organization</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Organization Select */}
              <div className="space-y-2">
                <Label htmlFor="orgSelect">Select Organization</Label>
                <Select value={orgName} onValueChange={(value) => setOrgName(value)}>
                  <SelectTrigger id="orgSelect" className="h-11">
                    <SelectValue placeholder="Choose organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizationList.length > 0 ? (
                      organizationList.map((org, index) => (
                        <SelectItem key={index} value={org}>
                          {org}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No organizations found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              {/* Designation */}
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  type="text"
                  placeholder="Manager"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 gradient-primary shadow-glow"
                disabled={isLoad}
              >
                {isLoad ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Button variant="link" className="p-0 h-auto font-semibold text-primary">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Secure and encrypted admin registration
        </p>
      </div>
    </div>
  );
}
