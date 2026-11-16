"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ManualPaymentData = {
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    orderStatus: string;
    paymentStatus: string;
    items: { product_name: string; quantity: number; unit_price: number }[];
  };
  payment: { upiId: string; qrUrl: string | null };
};

export default function ManualPaymentPage() {
  const [data, setData] = useState<ManualPaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrder(orderId: string, token: string) {
    const response = await fetch(`/api/checkout/manual-payment?order_id=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
      headers: token ? { "X-Order-Access-Token": token } : undefined,
    });
    const result = await response.json() as ManualPaymentData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load payment details.");
    setData(result);
  }

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (!orderId) {
      setError("We couldn’t find this order. Please return to the shop or contact the store.");
      setLoading(false);
      return;
    }
    const tokenKey = `lilsurpriz-order-access:${orderId}`;
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("access_token") ?? "";
    const token = fragmentToken || sessionStorage.getItem(tokenKey) || "";
    if (fragmentToken) {
      sessionStorage.setItem(tokenKey, fragmentToken);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    loadOrder(orderId, token).catch(e => setError(e instanceof Error ? e.message : "Unable to load payment details.")).finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="section wrap"><p className="muted">Loading your UPI payment details…</p></main>;
  if (!data) return <main className="section wrap" style={{ maxWidth: 700 }}><div className="notice" role="alert">{error}</div><Link className="btn btn-light" href="/shop">Continue shopping</Link></main>;

  const { order, payment } = data;
  const paymentNote = order.customerName ? `${order.customerName} - ${order.orderNumber}` : order.orderNumber;
  const upiUrl = `upi://pay?pa=${encodeURIComponent(payment.upiId)}&pn=${encodeURIComponent("LILSURPRIZ")}&am=${order.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(paymentNote)}`;
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
        <p className="muted"><b>GPay note:</b> Keep “{paymentNote}” in the note so we can match your payment to your order.</p>
        <p><b>Important:</b> Return to this page after paying. Payment is not confirmed until the store checks its GPay account.</p>
        <a className="btn btn-pink" href={upiUrl}>Open GPay / UPI app</a>
      </section>
    </>}
    <p style={{ marginTop: 20 }}><Link className="text-link" href="/shop">Continue shopping</Link></p>
  </main>;
}
