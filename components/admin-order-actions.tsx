"use client";
import { useState } from "react";

export function AdminOrderActions({ id, status, tracking, paymentStatus, paymentMethod, paymentClaimReference, reservationExpired }: { id: string; status: string; tracking: string | null; paymentStatus: string; paymentMethod: string; paymentClaimReference: string | null; reservationExpired: boolean }) {
  const [nextStatus, setNextStatus] = useState(status);
  const [trackingNumber, setTrackingNumber] = useState(tracking ?? "");
  const [verifiedReference, setVerifiedReference] = useState("");
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
  async function verifyPayment() {
    if (verifiedReference.trim().length < 6) { setMessage("Enter the transaction reference you verified in your payment account."); return; }
    if (!window.confirm("Only continue after checking that the full amount was received in your account. Confirm this payment?")) return;
    setMessage("");
    try {
      const response = await fetch("/api/admin/orders/verify-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id, verifiedReference }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to verify payment.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to verify payment."); }
  }
  const statuses = paymentStatus === "paid"
    ? ["Paid", "Processing", "Packed", "Shipped", "Delivered", "Cancelled"]
    : status === "Cancelled" ? ["Cancelled"] : ["Pending", "Cancelled"];
  return <div style={{ display: "grid", gap: 6, minWidth: 150 }}>
    <select value={nextStatus} onChange={e => setNextStatus(e.target.value)}>{statuses.map(s => <option key={s}>{s}</option>)}</select>
    {["Shipped", "Delivered"].includes(nextStatus) && <input aria-label="ST Courier tracking number" placeholder="ST Courier tracking / consignment number" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />}
    <button onClick={save}>Save status</button>
    {paymentMethod === "manual_upi" && (paymentStatus === "pending" || reservationExpired) && <div style={{ display: "grid", gap: 6 }}>
      {reservationExpired && <small>The 30-minute stock hold expired. Confirm stock is available before confirming payment; otherwise arrange a refund or replacement.</small>}
      <small>{paymentClaimReference ? `Customer-reported UTR: ${paymentClaimReference}` : "No customer UTR was submitted."}</small>
      <input aria-label="Verified payment transaction reference" placeholder="Verified transaction reference / UTR" minLength={6} maxLength={100} pattern="[A-Za-z0-9-]+" value={verifiedReference} onChange={e => setVerifiedReference(e.target.value)} />
      <button className="btn btn-pink" onClick={verifyPayment}>Confirm payment received</button>
    </div>}
    {message && <small role="status">{message}</small>}
  </div>;
}
