"use client";
import { useState } from "react";

export function AdminOrderActions({ id, status, tracking, fulfillmentAllowed, reservationExpired }: { id: string; status: string; tracking: string | null; fulfillmentAllowed: boolean; reservationExpired: boolean }) {
  const [nextStatus, setNextStatus] = useState(status);
  const [trackingNumber, setTrackingNumber] = useState(tracking ?? "");
  const [message, setMessage] = useState("");
  async function save() {
    setMessage("");
    try {
      const response = await fetch("/api/admin/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, order_status: nextStatus, tracking_number: trackingNumber || null }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update order.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update order."); }
  }
  const statuses = status === "Cancelled"
    ? ["Cancelled"]
    : [...(status === "Paid" ? ["Paid"] : []), "Pending", ...(fulfillmentAllowed ? ["Processing", "Packed", "Shipped", "Delivered"] : []), "Cancelled"];
  return <div style={{ display: "grid", gap: 6, minWidth: 150 }}>
    <select value={nextStatus} onChange={e => setNextStatus(e.target.value)}>{statuses.map(s => <option key={s}>{s}</option>)}</select>
    {["Shipped", "Delivered"].includes(nextStatus) && <input aria-label="ST Courier tracking number" placeholder="ST Courier tracking / consignment number" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />}
    <button onClick={save}>Save status</button>
    {reservationExpired && <small>The 30-minute stock hold expired. Verify product availability before fulfilling this order.</small>}
    {message && <small role="status">{message}</small>}
  </div>;
}
