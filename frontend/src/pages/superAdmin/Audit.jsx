import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search as SearchIcon, Eye, Download } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

// Helper: pretty print JSON safely (truncated)
function pretty(obj, max = 1000) {
  try {
    const s = JSON.stringify(obj, null, 2);
    return s.length > max ? s.slice(0, max) + "\n... (truncated)" : s;
  } catch {
    return String(obj);
  }
}

function safeDateField(r) {
  const d = r?.createdAt ?? r?.created_at ?? null;
  try { return d ? format(new Date(d), "PPP p") : "-" } catch { return "-" }
}

export default function Audit() {
  const { token: authToken } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // controls
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState(""); // client-side actor search only
  const [actionFilter, setActionFilter] = useState("all"); // 'all' = no filter
  const [tenantFilter, setTenantFilter] = useState("");
  const [totalCount, setTotalCount] = useState(null);

  // modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState(null);

  const AUDIT_EVENTS = [
    // Authentication
    "USER_LOGIN",

    // Employees (empAuth)
    "EMPLOYEE_CREATE",
    "EMPLOYEE_UPDATE",
    "EMPLOYEE_DELETE",
    "EMPLOYEE_LIST",

    // Customers (custAuth)
    "CUSTOMER_CREATE",
    "CUSTOMER_UPDATE",
    "CUSTOMER_DELETE",
    "CUSTOMER_LIST",

    // Organizations (orgAuth)
    "ORG_CREATE",
    "ORG_LIST",
    "ORG_GET",
    "ORG_UPDATE",
    "ORG_UPDATE_PLAN",

    // Projects (projectsRoutes)
    "PROJECT_CREATE",
    "PROJECT_LIST",
    "PROJECT_STATS",
    "PROJECT_GET",
    "PROJECT_UPDATE",
    "PROJECT_DELETE",
    "PROJECT_ACTIVATE",

    // Tasks (taskRoutes)
    "TASK_CREATE",
    "TASK_LIST",
    "TASK_PROJECT_LIST",
    "TASK_UPDATE",
    "TASK_DELETE",

    // Super Admin
    "SUPERADMIN_LOGIN",
    "SUPERADMIN_CREATE",
    "SUPERADMIN_GET_ME",
    "SUPERADMIN_METRICS",

    // System / Infra
    "AUDIT_LOG_ERROR",
    "ERROR_LOG_CREATED"
  ];

  // fetch once on mount (or when Refresh pressed)
  useEffect(() => {
    const tk = authToken || localStorage.getItem("token");
    if (tk) fetchAudit(tk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const fetchAudit = async (maybeToken) => {
    setLoading(true);
    setError(null);
    try {
      const tk = maybeToken || authToken || localStorage.getItem("token");
      if (!tk) throw new Error("No auth token available");

      // NOTE: query is NOT sent to backend. We only send pagination/action/tenant when fetching.
      const params = {
        limit,
        offset: page * limit,
      };
      if (actionFilter && actionFilter !== "all") params.action = actionFilter;
      if (tenantFilter) params.tenantId = tenantFilter;

      const res = await api.get("/audits/allaudits", {
        headers: { Authorization: `Bearer ${tk}` },
        params,
      });

      // tolerant handling of shapes
      let data = null;
      if (Array.isArray(res?.data)) data = res.data;
      else if (Array.isArray(res?.data?.data)) data = res.data.data;
      else if (Array.isArray(res?.data?.rows)) data = res.data.rows;
      else if (Array.isArray(res?.data?.rows?.data)) data = res.data.rows.data;
      else if (res?.data && typeof res.data === "object") data = res.data;

      if (Array.isArray(data)) {
        setRows(data);
        const total = res?.data?.total ?? res?.data?.totalCount ?? null;
        setTotalCount(total);
      } else {
        const foundArray = Object.values(res.data || {}).find(v => Array.isArray(v));
        if (foundArray) setRows(foundArray);
        else if (Array.isArray(res.data)) setRows(res.data);
        else setRows([]);
        setTotalCount(null);
      }
    } catch (err) {
      console.error("fetchAudit error:", err);
      setError(err?.response?.data?.error || err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const openDetails = (r) => { setDetailsRow(r); setDetailsOpen(true); };
  const closeDetails = () => { setDetailsOpen(false); setDetailsRow(null); };

  // CLIENT-SIDE FILTERING / SEARCH: search ONLY actor (actorEmail / actor_email)
  // IMPORTANT: treat missing actor email as "system" so typing "system" matches those rows
  const filteredRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const q = (query || "").trim().toLowerCase();

    return rows.filter((r) => {
      // actionFilter still respected client-side
      if (actionFilter && actionFilter !== "all") {
        const act = (r.action || r.actionType || "").toString().toLowerCase();
        if (act !== actionFilter.toLowerCase()) return false;
      }

      if (tenantFilter) {
        const t = (r.tenantId || r.tenant_id || "").toString().toLowerCase();
        if (!t.includes(tenantFilter.trim().toLowerCase())) return false;
      }

      if (!q) return true;

      // ONLY actor field is searched here (actorEmail / actor_email)
      // If actor email is missing, treat actor as 'system' so typing "system" will match.
      const actor = (r.actorEmail || r.actor_email || "system").toString().toLowerCase();
      return actor.includes(q);
    });
  }, [rows, query, actionFilter, tenantFilter]);

  // Export CSV (simple) - exports current rows (not filteredRows) but you can change if needed
  const exportCsv = () => {
    const headers = ["createdAt", "actorEmail", "action", "target", "metadata"];
    const csvRows = [headers.join(",")];
    rows.forEach(r => {
      const created = r.createdAt ?? r.created_at ?? "";
      const vals = [
        `"${created}"`,
        `"${(r.actorEmail || r.actor_email || "").replace(/"/g, '""')}"`,
        `"${(r.action || "").replace(/"/g, '""')}"`,
        `"${JSON.stringify(r.target || {}).replace(/"/g, '""')}"`,
        `"${JSON.stringify(r.metadata || {}).replace(/"/g, '""')}"`
      ];
      csvRows.push(vals.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Immutable record of admin & system actions. Only visible to SuperAdmin.</p>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <CardTitle>Audit Log Viewer</CardTitle>

          <div className="flex items-center gap-2">
            {/* FIRST INPUT: client-side search (actor only) - DOES NOT trigger API calls */}
            <Input
              placeholder="Search actor email or 'system'..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); /* no fetch */ }}
              className="w-64"
            />

            <Select onValueChange={(v) => { setActionFilter(v); }} value={actionFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {AUDIT_EVENTS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
                {/* <SelectItem value="suspend_tenant">suspend_tenant</SelectItem>
                <SelectItem value="reactivate_tenant">reactivate_tenant</SelectItem>
                <SelectItem value="create_tenant">create_tenant</SelectItem>
                <SelectItem value="impersonate_user">impersonate_user</SelectItem>
                <SelectItem value="admin_user_create">admin_user_create</SelectItem>
                <SelectItem value="login_failed">login_failed</SelectItem> */}
              </SelectContent>
            </Select>

            <Input
              placeholder="Tenant ID (optional)"
              value={tenantFilter}
              onChange={(e) => { setTenantFilter(e.target.value); }}
              className="w-36"
            />
            <Button variant="ghost" onClick={() => fetchAudit()} title="Refresh"><SearchIcon className="w-4 h-4" /></Button>
            <Button variant="ghost" onClick={exportCsv} title="Export CSV"><Download className="w-4 h-4" /></Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Loading audit logs...</div>
          ) : error ? (
            <div className="p-6 text-center text-destructive">{String(error)}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2">Time</th>
                      <th className="py-2">Actor</th>
                      <th className="py-2">Action</th>
                      <th className="py-2 text-right">Details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No audit logs</td></tr>
                    ) : filteredRows.map((r, i) => (
                      <tr key={r.id || r._id || i} className="border-t">
                        <td className="py-3">{safeDateField(r)}</td>
                        <td className="py-3">{r.actorEmail || r.actor_email || 'system'}</td>
                        <td className="py-3 font-medium">{r.action || r.actionType || '-'}</td>

                        <td className="py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => openDetails(r)}><Eye className="w-4 h-4" /> View</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                Showing {filteredRows.length} of {rows.length}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Details modal (simple) */}
      {detailsOpen && detailsRow && (
        <div className="w-[50%] fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl bg-card rounded-lg shadow-lg">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{detailsRow.action}</div>
                  <div className="text-xs text-muted-foreground">{detailsRow.actorEmail || detailsRow.actor_email || 'system'} • {safeDateField(detailsRow)}</div>
                </div>
                <div>
                  <Button variant="ghost" onClick={closeDetails}>Close</Button>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Target</div>
                <pre className="text-sm bg-background p-3 rounded border max-h-64 overflow-y-auto">{pretty(detailsRow.target)}</pre>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Metadata</div>
                <pre className="text-sm bg-background p-3 rounded border max-h-64 overflow-y-auto">{pretty(detailsRow.metadata)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
