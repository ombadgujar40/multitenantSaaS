import React, { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, FolderKanban, CheckSquare, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { empAuth } from "../../contexts/EmpContext"
import api from "@/api/axios"


const DashBoard = () => {

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      window.location.href = '/superAdmin/login'
    } else {
      // console.log(token)
    }
  }, [])
  const { data } = empAuth()
  const [recentAudit, setRecentAudit] = useState([]);
  const [recentErrors, setRecentErrors] = useState([]);
  const [healthMetrics, setHealthMetrics] = useState([])

  const [overview, setOverview] = useState({
    Organization: [],
    OrgAdmins: [],
    Employees: [],
    Customers: [],
  })
  const health = false
  const navigate = useNavigate()

  useEffect(() => {
    const tok = localStorage.getItem('token')
    if (tok) fetchMetrics(tok)
  }, [data])

  const fetchMetrics = async (tok) => {
    const resp = await api.get(`/superadmin/metrics`, {
      headers: { Authorization: `Bearer ${tok}` },
    })

    // console.log(resp.data.data)
    const dt = resp.data.data
    setOverview({
      Organization: dt.organization,
      OrgAdmins: dt.orgAdmin,
      Employees: dt.employee,
      Customers: dt.customer,
    })

    const aud = await api.get("/audits/recentaudits", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    setRecentAudit(aud.data);

    const err = await api.get("/errors/getrecenterrors", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    setRecentErrors(err.data);


    const errHealth = await api.get("/errors/health")
    const auditHealth = await api.get("/audits/health")
    const planHealth = await api.get("/plans/health")
    const projectHealth = await api.get("/project/health")
    const taskHealth = await api.get("/task/health")
    const superAdminHealth = await api.get("/superadmin/health")
    const organizationHealth = await api.get("/organization/health")
    const employeeHealth = await api.get("/employee/health")
    const chatHealth = await api.get("/chat/health")
    const customerHealth = await api.get("/customer/health")

    setHealthMetrics([{
      project: projectHealth.data.ok,
      superAdmin: superAdminHealth.data.ok,
      organization: organizationHealth.data.ok,
      employee: employeeHealth.data.ok,
      chat: chatHealth.data.ok,
      customer: customerHealth.data.ok,
      audits: auditHealth.data.ok,
      errors: errHealth.data.ok,
      plans: planHealth.data.ok,
      task: taskHealth.data.ok,
    }]
    )
  }


  const helathMetrics = [
    { title: "project", value: healthMetrics.project ? "OK" : "FAIL" },
    { title: "superAdmin", value: healthMetrics.superAdminHealth ? "OK" : "FAIL" },
    { title: "organization", value: healthMetrics.organizationHealth ? "OK" : "FAIL" },
    { title: "employee", value: healthMetrics.employeeHealth ? "OK" : "FAIL" },
    { title: "chat", value: healthMetrics.chatHealth ? "OK" : "FAIL" },
    { title: "customer", value: healthMetrics.customerHealth ? "OK" : "FAIL" },
    { title: "audits", value: healthMetrics.auditHealth ? "OK" : "FAIL" },
    { title: "errors", value: healthMetrics.errHealth ? "OK" : "FAIL" },
    { title: "plans", value: healthMetrics.planHealth ? "OK" : "FAIL" },
    { title: "task", value: healthMetrics.taskHealth ? "OK" : "FAIL" },

  ]

  const stats = [
    { title: "Total Organization", value: overview.Organization?.length ? overview.Organization?.length : 0, icon: Users, change: "+12%", color: "text-primary" },
    { title: "Total OrgAdmins", value: overview.OrgAdmins?.length ? overview.OrgAdmins?.length : 0, icon: CheckSquare, change: "+23%", color: "text-success" },
    { title: "Total Employees", value: overview.Employees?.length ? overview.Employees?.length : 0, icon: FolderKanban, change: "+8%", color: "text-warning" },
    { title: "Total Customers", value: overview.Customers?.length ? overview.Customers?.length : 0, icon: CheckSquare, change: "+23%", color: "text-warning" },
  ];


  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard Super Admin</h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="max-h-30 overflow-y-auto">
          <CardHeader>
            <CardTitle>Recent Audit Logs</CardTitle>
          </CardHeader>

          <CardContent className="max-h-72 overflow-y-auto">
            <ul className="space-y-3">
              {recentAudit?.length > 0 ? (
                recentAudit.map((log, idx) => (
                  <li key={idx} className="p-3 border rounded-lg bg-muted/20">
                    <div className="text-sm font-medium">
                      {log.action}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      By: {log.actorEmail || "System"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>

                    {log.target && (
                      <pre className="text-[10px] mt-2 bg-background p-2 rounded border max-h-20 overflow-y-auto">
                        {JSON.stringify(log.target, null, 2)}
                      </pre>
                    )}
                  </li>
                ))
              ) : (
                <div className="text-muted-foreground text-sm">No recent audit logs</div>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Errors</CardTitle>
          </CardHeader>

          <CardContent className="max-h-72 overflow-y-auto">
            <ul className="space-y-3">
              {recentErrors?.length > 0 ? (
                recentErrors.map((err, idx) => (
                  <li key={idx} className="p-3 border rounded-lg bg-destructive/10">
                    <div className="text-sm font-medium">
                      Error ID: {err.id}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Time: {new Date(err.createdAt).toLocaleString()}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Tenant: {err.tenant_id || "—"}
                    </div>

                    {err.payload && (
                      <pre className="text-[10px] mt-2 bg-background p-2 rounded border max-h-20 overflow-y-auto">
                        {JSON.stringify(err.payload, null, 2)}
                      </pre>
                    )}
                  </li>
                ))
              ) : (
                <div className="text-muted-foreground text-sm">No recent errors</div>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card className="col-span-2 w-full">
        <CardHeader>
          <CardTitle>System's API's Health Overview</CardTitle>
        </CardHeader>

        <CardContent>
          {!helathMetrics ? (
            <div className="text-sm text-muted-foreground">Loading health metrics...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {helathMetrics?.map((health, index) => (
                <div key={index} className="p-4 border rounded-lg bg-muted/20 flex items-center justify-between">

                  {/* Left Side: Title + Value */}
                  <div>
                    <div className="text-xs text-muted-foreground">{health.title}</div>
                    <div className="text-lg font-semibold">
                      {health.value ? "OK" : "FAIL"}
                    </div>
                  </div>

                  {/* Right Side: Status Light */}
                  <div
                    className={`
                w-4 h-4 rounded-full
                ${health.value ? "bg-green-500" : "bg-red-500"}
              `}
                  ></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


    </div>
  );
}

export default DashBoard






