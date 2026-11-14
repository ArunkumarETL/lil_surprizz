"use client";
import { useState } from "react";

export function AdminOrderActions({ id, status, tracking }: { id: string; status: string; tracking: string | null }) {
  const [nextStatus, setNextStatus] = useState(status);
  const [trackingNumber, setTrackingNumber] = useState(tracking ?? "");
  const [message, setMessage] = useState("");
  async function save() {
    setMessage("");
    const response = await fetch("/api/admin/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, order_status: nextStatus, tracking_number: trackingNumber || null }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error ?? "Unable to update order."); return; }
    setMessage("Saved"); window.location.reload();
  }
  return <div style={{ display: "grid", gap: 6, minWidth: 150 }}><select value={nextStatus} onChange={e => setNextStatus(e.target.value)}>{["Pending", "Paid", "Processing", "Packed", "Shipped", "Delivered", "Cancelled"].map(s => <option key={s}>{s}</option>)}</select>{["Shipped", "Delivered"].includes(nextStatus) && <input aria-label="Tracking number" placeholder="Tracking number" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />}<button onClick={save}>Save</button>{message && <small>{message}</small>}</div>;
}
