import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import api from "@/api/axios"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [designation, setDesignation] = useState("");
  const [orgName, setOrgName] = useState(""); // input or select depending on role
  const [isLoad, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [organizationList, setOrganizationList] = useState<string[]>([]);

  // Fetch all organizations
  useEffect(() => {
    api
      .get("/organization/all")
      .then((res) => setOrganizationList(res.data.map((org: any) => org.name)))
      .catch((err) => console.error("Error fetching orgs:", err));
  }, []);

  // Handle Register
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (role === "organization") {
        // Register as new organization
        const orgData = { name: orgName };
        const res = await api.post("/organization/register", orgData);
        toast.success("Organization registered successfully!");
      } else if (role === "admin") {
        // Register employee or customer under existing organization
        const payload = { orgName, name, email, password, role, designation };
        const res = await api.post(`/employee/register`, payload);
        toast.success("Registration successful!");
      } else if(role === "employee") {
        const payload = { orgName, name, email, password, role, designation };
        const res = await api.post(`/employee/register`, payload);
        toast.success("Registration successful!");
      } else {
        const payload = { orgName, name, email, password, role, designation };
        const res = await api.post(`/customer/register`, payload);
        toast.success("Registration successful!");
      }
      navigate("/login");
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
            <CardTitle className="text-3xl">Create your account</CardTitle>
            <CardDescription>Join your workspace to get started</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role */}
              <div className="space-y-2">
                <Label>Register as</Label>
                <div className="flex gap-4">
                  {/* {["organization", "employee", "customer", "admin"].map((r) => ( */}
                  {["organization", "employee", "customer"].map((r) => (
                    <label key={r} className="flex items-center gap-2 capitalize">
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => {
                          setRole(r);
                          setOrgName("");
                        }}
                        className="accent-primary"
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              {/* Organization Field */}
              {role === "organization" ? (
                // If user is registering as organization
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    type="text"
                    placeholder="Techify Solutions"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
              ) : (
                // If employee or customer
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
              )}

              {/* Name */}
              {role !== "organization" && (
                <>
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
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  {role == 'employee' && (
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
                  )}

                  {role == 'admin' && (
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
                  )}

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
                </>
              )}


              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 gradient-primary shadow-glow"
                disabled={isLoad}
              >
                {isLoad ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
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
          Secure and encrypted registration process
        </p>
      </div >
    </div >
  );
}
