import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import api from "@/api/axios"

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [isLoad, setIsLoading] = useState(false);
  const { token, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {

    const navigateUser = async () => {
      try {
        const tk = token || localStorage.getItem("token");
        if (!tk) return;

        const res = await api.get("http://127.0.0.1:2000/me", {
          headers: {
            Authorization: `Bearer ${tk}`,
          },
        });

      navigate(`/${res.data.role}`)
      } catch (error) {
        console.log("Error fetching user data:", error);
      }
    }

    if (token) navigateUser()
  }, [token])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const resp = await login(email, password, role)
      if (resp.sucess) {
        navigate(`/${role}`)
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.log(error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-subtle">
      <div className="w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-center mb-8">
          <div className="p-3 rounded-2xl bg-primary shadow-glow">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>

        <Card className="glass-effect shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Sign in as</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="role" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full h-11 gradient-primary shadow-glow"
                disabled={isLoad}
              >
                {isLoad ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Button variant="link" className="p-0 h-auto font-semibold text-primary">
                <Link to="/register">Register</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Protected by enterprise-grade security
        </p>
      </div>
    </div>
  );
}
