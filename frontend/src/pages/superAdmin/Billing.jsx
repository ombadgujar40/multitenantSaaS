import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Repeat, XCircle } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

const pageSize = 10;

function money(amountInCents, currency = "usd") {
  if (amountInCents == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountInCents / 100);
}

function safeDate(d) {
  return d ? format(new Date(d), "PPP p") : "-";
}

export default function Billing() {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState(null);

  // pagination + search
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'retry'|'cancel', item }
  const [confirmTyped, setConfirmTyped] = useState("");

  useEffect(() => {
    if (!token || user?.role !== "superAdmin") return;
    fetchBilling();
  }, [token]);

  const fetchBilling = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, subsRes] = await Promise.all([
        api.get("/admin/billing/summary", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/admin/billing/subscriptions", { headers: { Authorization: `Bearer ${token}` }, params: { limit: 500 } })
      ]);
      setSummary(sumRes.data);
      setItems(subsRes.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || err.message || "Failed to load billing");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.tenantName || "").toLowerCase().includes(q) ||
      (i.customerEmail || "").toLowerCase().includes(q) ||
      (i.stripeSubscriptionId || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const openConfirm = (type, item) => {
    setConfirmAction({ type, item });
    setConfirmTyped("");
    setConfirmOpen(true);
  };
  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmAction(null);
    setConfirmTyped("");
  };

  const performAction = async () => {
    if (!confirmAction) return;
    const { type, item } = confirmAction;
    // require exact typed tenant name for cancel (destructive)
    if (type === "cancel" && confirmTyped.trim() !== item.tenantName) {
      return alert("Type the tenant name exactly to confirm cancellation.");
    }
    setActionLoadingId(item.id);
    try {
      if (type === "retry") {
        await api.post(`/admin/billing/invoices/${item.latestInvoiceId}/retry`, {}, { headers: { Authorization: `Bearer ${token}` } });
        alert("Retry triggered (backend will attempt charge in Stripe test mode).");
      } else if (type === "cancel") {
        await api.post(`/admin/billing/subscriptions/${item.stripeSubscriptionId}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } });
        alert("Subscription cancel requested.");
      }
      await fetchBilling();
      closeConfirm();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err.message || "Action failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Stripe Integeration coming soon.....</p>
      </div>
    </div>
  );
}
