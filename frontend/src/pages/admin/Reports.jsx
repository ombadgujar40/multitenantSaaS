import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Reports() {
  const data = [
    { name: "Jan", revenue: 12000, expenses: 8000 },
    { name: "Feb", revenue: 15000, expenses: 9000 },
    { name: "Mar", revenue: 18000, expenses: 11000 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-4xl font-bold mb-2">Reports</h1>
      <p className="text-muted-foreground">View monthly performance insights</p>

      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
