import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Search as SearchIcon, Download, Eye } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

// safe pretty print
function pretty(obj, max = 1200) {
  try {
    const s = JSON.stringify(obj, null, 2);
    return s.length > max ? s.slice(0, max) + "\n... (truncated)" : s;
  } catch {
    return String(obj);
  }
}

function safeDate(d) {
  if (!d) return "-";
  try { return format(new Date(d), "PPP p"); } catch { return d; }
}

export default function Errors() {
  const { token: authToken } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // controls
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all"); // all, CRITICAL, HIGH, MEDIUM, LOW, INFO
  const [eventType, setEventType] = useState("all");

  // details modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState(null);

  useEffect(() => {
    const tk = authToken || localStorage.getItem("token");
    if (tk) fetchErrors(tk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const fetchErrors = async (maybeToken) => {
    setLoading(true);
    setError(null);
    try {
      const tk = authToken || maybeToken || localStorage.getItem("token");
      if (!tk) throw new Error("No auth token");

      // fetch without client-side pagination — we will filter locally
      const res = await api.get("/errors/allerrors", {
        headers: { Authorization: `Bearer ${tk}` },
      });

      // support array or { rows, total }
      if (Array.isArray(res?.data)) {
        setRows(res.data);
      } else if (Array.isArray(res?.data?.rows)) {
        setRows(res.data.rows);
      } else if (Array.isArray(res?.data?.data)) {
        setRows(res.data.data);
      } else {
        const found = Object.values(res.data || {}).find(v => Array.isArray(v));
        setRows(found || []);
      }
    } catch (err) {
      console.error("fetchErrors", err);
      setError(err?.response?.data?.error || err.message || "Failed to load errors");
    } finally {
      setLoading(false);
    }
  };

  const openDetails = (r) => { setDetailsRow(r); setDetailsOpen(true); };
  const closeDetails = () => { setDetailsRow(null); setDetailsOpen(false); };

  // filtered list (client-side): instant search + filters — keeps UI simple
  const filteredRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (severity !== "all" && (String(r.severity || "")).toUpperCase() !== severity.toUpperCase()) return false;
      if (eventType !== "all") {
        const et = (r.eventType || r.error_type || "").toLowerCase();
        if (et !== eventType.toLowerCase()) return false;
      }
      if (!q) return true;
      // search across message, tenant, id, userId
      const message = String(r.message || r.payload?.message || "").toLowerCase();
      const tenant = String(r.tenantId || "").toLowerCase();
      const userId = String(r.userId || r.user_id || "").toLowerCase();
      const id = String(r.id || r._id || "").toLowerCase();
      return message.includes(q) || tenant.includes(q) || userId.includes(q) || id.includes(q);
    });
  }, [rows, query, severity, eventType]);

  const exportCsv = () => {
    const headers = ["createdAt", "tenantId", "userId", "eventType", "severity", "message"];
    const csv = [headers.join(",")];
    (filteredRows || rows).forEach(r => {
      const created = r.createdAt ?? r.created_at ?? "";
      const vals = [
        `"${created}"`,
        `"${r.tenantId ?? ""}"`,
        `"${r.userId ?? r.user_id ?? ""}"`,
        `"${(r.eventType || r.error_type || "").replace(/"/g, '""')}"`,
        `"${(r.severity || "").replace(/"/g, '""')}"`,
        `"${String(r.message || r.payload?.message || "").replace(/"/g, '""')}"`
      ];
      csv.push(vals.join(","));
    });
    const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `errors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Errors</h1>
        <p className="text-muted-foreground">Recent error events (minimal, actionable view).</p>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <CardTitle>Platform Errors</CardTitle>

          <div className="flex items-center gap-2">
            <Input placeholder="Search message / tenant / id..." value={query} onChange={e => setQuery(e.target.value)} className="w-64" />

            <Select value={severity} onValueChange={(v) => setSeverity(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                <SelectItem value="HIGH">HIGH</SelectItem>
                <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                <SelectItem value="LOW">LOW</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
              </SelectContent>
            </Select>

            <Select value={eventType} onValueChange={(v) => setEventType(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                <SelectItem value="unhandled_exception">unhandled_exception</SelectItem>
                <SelectItem value="db_connection_error">db_connection_error</SelectItem>
                <SelectItem value="background_job_failed">background_job_failed</SelectItem>
                <SelectItem value="payment_failure">payment_failure</SelectItem>
                <SelectItem value="third_party_api_error">third_party_api_error</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" onClick={() => fetchErrors()} title="Refresh"><SearchIcon className="w-4 h-4" /></Button>
            <Button variant="ghost" onClick={exportCsv} title="Export CSV"><Download className="w-4 h-4" /></Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Loading errors...</div>
          ) : error ? (
            <div className="p-6 text-center text-destructive">{String(error)}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2">Time</th>
                      <th className="py-2">Tenant</th>
                      <th className="py-2">User</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Severity</th>
                      <th className="py-2">Message</th>
                      <th className="py-2 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!filteredRows || filteredRows.length === 0) ? (
                      <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No errors</td></tr>
                    ) : filteredRows.map((r, i) => (
                      <tr key={r.id || r._id || i} className="border-t">
                        <td className="py-3">{safeDate(r.createdAt ?? r.created_at)}</td>
                        <td className="py-3 text-xs text-muted-foreground">{r.tenantId ?? r.tenant_id ?? "-"}</td>
                        <td className="py-3 text-xs text-muted-foreground">{r.userId ?? r.user_id ?? "-"}</td>
                        <td className="py-3 font-medium">{r.eventType ?? r.error_type ?? "-"}</td>
                        <td className="py-3">{r.severity ?? "-"}</td>
                        <td className="py-3 text-xs">{r.message ?? (r.payload?.message ? String(r.payload.message).slice(0, 200) : "-")}</td>
                        <td className="py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => openDetails(r)}><Eye className="w-4 h-4" /> View</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-muted-foreground">Showing {filteredRows.length} of {rows.length}</div>
                <div className="text-xs text-muted-foreground">(pagination removed - simple list)</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Details modal */}
      {detailsOpen && detailsRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl bg-card rounded-lg shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{detailsRow.eventType ?? detailsRow.error_type ?? "Error"}</div>
                <div className="text-xs text-muted-foreground">{detailsRow.severity ?? ""} • {safeDate(detailsRow.createdAt ?? detailsRow.created_at)}</div>
              </div>
              <div>
                <Button variant="ghost" onClick={closeDetails}>Close</Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Message</div>
                <div className="text-sm">{detailsRow.message ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Payload</div>
                <pre className="text-sm bg-background p-3 rounded border max-h-64 overflow-y-auto">{pretty(detailsRow.payload ?? detailsRow)} </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
