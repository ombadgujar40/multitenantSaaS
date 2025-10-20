import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import axios from "axios";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [orgName, setOrgName] = useState(""); // only for organization role
  const [isLoad, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        name,
        email,
        password,
        role,
      };


      const response = await axios.post(`http://127.0.0.1:2000/${payload.role}/register`);

      toast.success("Registration successful!");
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
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

              {/* Role - Radio Buttons */}
              <div className="space-y-2">
                <Label>Register as</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      value="organization"
                      checked={role === "organization"}
                      onChange={() => setRole("organization")}
                      className="accent-primary"
                    />
                    Organization
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      value="employee"
                      checked={role === "employee"}
                      onChange={() => setRole("employee")}
                      className="accent-primary"
                    />
                    Employee
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      value="customer"
                      checked={role === "customer"}
                      onChange={() => setRole("customer")}
                      className="accent-primary"
                    />
                    Customer
                  </label>
                </div>
              </div>

              {/* Organization Name - only if role is organization */}
              {role === "organization" && (
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
      </div>
    </div>
  );
}
