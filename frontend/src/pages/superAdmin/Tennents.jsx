import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Check, Search as SearchIcon, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/api/axios';
import { format } from 'date-fns';

function safeDate(d){ return d ? format(new Date(d), 'PPP p') : '-' }

export default function Tenants() {
  // const { token, user } = useAuth(); // expects { token, user: { role } }
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [token, setToken] = useState();
  const pageSize = 10;

  // confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'suspend'|'reactivate', tenant }
  const [confirmTypedName, setConfirmTypedName] = useState('');

  useEffect(() => {
    setToken(localStorage.getItem('token'))
    if (token)  fetchTenants(token);
  }, [token]);

  const fetchTenants = async (token) => {
    setLoading(true);
    setError(null);
    try {
      // simple fetch, server can support pagination & filter
      const res = await api.get('/plans/allplans', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(res)
      setTenants(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || err.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  // filtered + paginated
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(t =>
      (t.org.name || '').toLowerCase().includes(q) ||
      (t.Domain || '').toLowerCase().includes(q)
    );
  }, [tenants, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const openConfirm = (type, tenant) => {
    setConfirmAction({ type, tenant });
    setConfirmTypedName('');
    setConfirmOpen(true);
    console.log(tenant.id)
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmAction(null);
    setConfirmTypedName('');
  };

  const performAction = async () => {
    if (!confirmAction) return;
    const { type, tenant } = confirmAction;
    // require exact typed tenant name for suspend/delete (destructive)
    if (type === 'suspend' && confirmTypedName !== tenant.name) {
      return alert('Type the tenant name exactly to confirm.');
    }
    setActionLoadingId(tenant.id);
    try {
      const url = `/organization/updateplan/${tenant.id}`;
      const resp = await api.put(url, {Status: type === 'suspend' ? 'Suspended' : 'Active'}, { headers: { Authorization: `Bearer ${token}` } });
      // optimistic refresh
      console.log(resp)
      await fetchTenants(token);
      closeConfirm();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err.message || 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderStatus = (s) => {
    if (!s) return '-';
    if (s === 'active') return <span className="text-green-600 font-medium">Active</span>;
    if (s === 'suspended') return <span className="text-yellow-600 font-medium">Suspended</span>;
    return <span className="text-muted-foreground">{s}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Tenants</h1>
        <p className="text-muted-foreground">Manage organizations on the platform.</p>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Tenant Management</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name or domain..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              className="w-72"
            />
            <Button variant="ghost" onClick={() => fetchTenants(token)} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Loading tenants...</div>
          ) : error ? (
            <div className="p-6 text-center text-destructive">Error: {String(error)}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2">Name</th>
                      <th className="py-2">Domain</th>
                      <th className="py-2">Plan</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Created</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No tenants found</td></tr>
                    ) : pageItems.map(t => (
                      <tr key={t.org.id} className="border-t">
                        <td className="py-3">{t.org.name}</td>
                        <td className="py-3">{t.Domain || '-'}</td>
                        <td className="py-3">{t.Plan || '-'}</td>
                        <td className="py-3">{renderStatus(t.Status)}</td>
                        <td className="py-3">{safeDate(t.createdAt)}</td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            {t.Status !== 'Suspended' ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openConfirm('suspend', t.org)}
                                disabled={actionLoadingId === t.id}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Suspend
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openConfirm('reactivate', t.org)}
                                disabled={actionLoadingId === t.id}
                              >
                                <Check className="w-4 h-4 mr-2" /> Reactivate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation modal (simple inline) */}
      {confirmOpen && confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-card rounded-lg shadow-lg">
            <div className="p-4 border-b">
              <div className="text-lg font-semibold">
                {confirmAction.type === 'suspend' ? 'Confirm Suspend Tenant' : 'Confirm Reactivate Tenant'}
              </div>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {confirmAction.type === 'suspend'
                  ? `Suspending tenant "${confirmAction.tenant.name}" will prevent users from accessing their workspace. This is reversible. To confirm, type the tenant name exactly below.`
                  : `Reactivate tenant "${confirmAction.tenant.name}" to restore access.`}
              </p>

              {confirmAction.type === 'suspend' && (
                <div>
                  <Input
                    placeholder="Type tenant name to confirm"
                    value={confirmTypedName}
                    onChange={(e) => setConfirmTypedName(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeConfirm}>Cancel</Button>
                <Button
                  variant={confirmAction.type === 'suspend' ? 'destructive' : 'primary'}
                  onClick={performAction}
                  disabled={actionLoadingId === confirmAction.tenant.id}
                >
                  {actionLoadingId === confirmAction.tenant.id ? 'Working...' : (confirmAction.type === 'suspend' ? 'Suspend' : 'Reactivate')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
