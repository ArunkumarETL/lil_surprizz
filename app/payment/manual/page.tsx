"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ManualPaymentData = {
  order: {
    id: string;
    orderNumber: string;
    total: number;
    orderStatus: string;
    paymentStatus: string;
    paymentClaimReference: string | null;
    items: { product_name: string; quantity: number; unit_price: number }[];
  };
  payment: { upiId: string; qrUrl: string | null };
};

export default function ManualPaymentPage() {
  const [data, setData] = useState<ManualPaymentData | null>(null);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadOrder(orderId: string) {
    const response = await fetch(`/api/checkout/manual-payment?order_id=${encodeURIComponent(orderId)}`, { cache: "no-store" });
    const result = await response.json() as ManualPaymentData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load payment details.");
    setData(result);
    setReference(result.order.paymentClaimReference ?? "");
  }

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (!orderId) {
      setError("We couldn’t find this order. Check My Orders or contact the store.");
      setLoading(false);
      return;
    }
    loadOrder(orderId).catch(e => setError(e instanceof Error ? e.message : "Unable to load payment details.")).finally(() => setLoading(false));
  }, []);

  async function submitReference(event: React.FormEvent) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/checkout/manual-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.order.id, reference }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to submit the payment reference.");
      setData(current => current ? { ...current, order: { ...current.order, paymentClaimReference: reference.trim() } } : current);
      setMessage("Reference submitted. Your order remains pending until the store verifies the payment.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to submit the payment reference."); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="section wrap"><p className="muted">Loading your UPI payment details…</p></main>;
  if (!data) return <main className="section wrap" style={{ maxWidth: 700 }}><div className="notice" role="alert">{error}</div><Link className="btn btn-light" href="/orders">My orders</Link></main>;

  const { order, payment } = data;
  const upiUrl = `upi://pay?pa=${encodeURIComponent(payment.upiId)}&pn=${encodeURIComponent("LILSURPRIZ")}&am=${order.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(order.orderNumber)}`;
  const paid = order.paymentStatus === "paid";
  const cancelled = order.orderStatus === "Cancelled";

  return <main className="section wrap" style={{ maxWidth: 760 }}>
    <span className="eyebrow">Manual UPI payment</span>
    <h1 style={{ fontSize: 42 }}>Complete your payment</h1>
    <div className="summary">
      <div className="summary-line"><span>Order</span><b>{order.orderNumber}</b></div>
      {order.items.map((item, index) => <div key={`${item.product_name}-${index}`} className="summary-line"><span>{item.product_name} × {item.quantity}</span><b>₹{Number(item.unit_price * item.quantity).toLocaleString("en-IN")}</b></div>)}
      <div className="summary-line total"><span>Amount to pay</span><b>₹{order.total.toLocaleString("en-IN")}</b></div>
    </div>
    {paid ? <div className="notice" role="status">Payment verified. Your order is confirmed.</div> : cancelled ? <div className="notice" role="status">This order was cancelled. Contact the store if you already paid.</div> : <>
      <section className="summary" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 24 }}>Pay with Google Pay or another UPI app</h2>
        <p className="muted">On this phone, use the button to open an installed UPI app. On another device, scan the QR and pay the exact amount shown above.</p>
        <p><b>UPI ID:</b> {payment.upiId}</p>
        {payment.qrUrl && <img src={payment.qrUrl} alt="Scan to pay with UPI" style={{ width: 240, height: 240, objectFit: "contain", background: "#fff", padding: 10, border: "1px solid var(--line)", borderRadius: 12, margin: "16px auto" }} />}
        <p><b>Important:</b> Return to this page after paying. Payment is not confirmed until the store checks its GPay account.</p>
        <a className="btn btn-pink" href={upiUrl}>Open GPay / UPI app</a>
      </section>
      <form className="summary form" style={{ marginTop: 20 }} onSubmit={submitReference}>
        <h2 style={{ fontSize: 24 }}>Already paid?</h2>
        <p className="muted">Enter the UPI transaction reference from your payment app. This only notifies the store; it does not mark your order as paid.</p>
        <div className="field"><label htmlFor="upi-reference">UPI transaction reference / UTR</label><input id="upi-reference" required minLength={6} maxLength={100} pattern={"[A-Za-z0-9\\x2d]+"} autoComplete="off" value={reference} onChange={e => setReference(e.target.value)} placeholder="Enter the reference shown by your UPI app" /></div>
        {error && <div className="notice" role="alert">{error}</div>}
        {message && <div className="notice" role="status">{message}</div>}
        <button className="btn btn-pink" disabled={busy}>{busy ? "Submitting…" : "Submit payment reference"}</button>
        {order.paymentClaimReference && <small className="muted">Reference on file: {order.paymentClaimReference} · Awaiting store verification.</small>}
      </form>
    </>}
    <p style={{ marginTop: 20 }}><Link className="text-link" href="/orders">My orders</Link></p>
  </main>;
}
