"use client";
import { useState } from "react";

type Coupon = { id: string; code: string; discount_type: "percent" | "fixed"; discount_value: number; minimum_order: number; active: boolean; expires_at: string | null };
export function AdminCouponManager({ coupons }: { coupons: Coupon[] }) {
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ code: "", discount_type: "percent" as "percent" | "fixed", discount_value: "", minimum_order: "", expires_at: "" });
  async function create(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, discount_value: Number(form.discount_value), minimum_order: Number(form.minimum_order || 0), active: true, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error ?? "Unable to create coupon."); return; }
    window.location.reload();
  }
  async function toggle(coupon: Coupon) {
    const response = await fetch("/api/admin/coupons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...coupon, active: !coupon.active }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error ?? "Unable to update coupon."); return; }
    window.location.reload();
  }
  return <div className="split"><div><h2 style={{ fontSize: 24 }}>Active and past coupons</h2>{coupons.map(c => <div key={c.id} className="cart-row" style={{ gridTemplateColumns: "1fr auto" }}><span><b>{c.code}</b><br /><span className="muted">{c.discount_value}{c.discount_type === "percent" ? "%" : " ₹"} off · Minimum ₹{c.minimum_order} · {c.active ? "Active" : "Inactive"}</span></span><button onClick={() => toggle(c)}>Set {c.active ? "inactive" : "active"}</button></div>)}</div>
    <form className="summary form" onSubmit={create}><h2 style={{ fontSize: 24 }}>Create coupon</h2><div className="field"><label>Coupon code</label><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div><div className="field"><label>Discount type</label><select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value as "percent" | "fixed" })}><option value="percent">Percent</option><option value="fixed">Fixed amount (₹)</option></select></div><div className="field"><label>Discount value</label><input required type="number" min=".01" step=".01" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} /></div><div className="field"><label>Minimum order (₹)</label><input type="number" min="0" step=".01" value={form.minimum_order} onChange={e => setForm({ ...form, minimum_order: e.target.value })} /></div><div className="field"><label>Expiry (optional)</label><input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} /></div>{message && <div role="alert" className="notice">{message}</div>}<button className="btn btn-pink">Create coupon</button></form></div>;
}
