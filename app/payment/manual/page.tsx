"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGuestOrderAccessToken, rememberGuestOrder } from "@/lib/guest-order-storage";

type ManualPaymentData = {
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    orderStatus: string;
    paymentStatus: string;
    reservationExpiresAt: string | null;
    reservationExpired: boolean;
    items: { product_name: string; quantity: number; unit_price: number }[];
  };
  payment: { upiId: string; qrUrl: string | null };
};

export default function ManualPaymentPage() {
  const [data, setData] = useState<ManualPaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recoveryWarning, setRecoveryWarning] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  async function loadOrder(orderId: string, token: string) {
    const response = await fetch(`/api/checkout/manual-payment?order_id=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
      headers: token ? { "X-Order-Access-Token": token } : undefined,
    });
    const result = await response.json() as ManualPaymentData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load payment details.");
    if (token) {
      try {
        rememberGuestOrder(orderId, result.order.orderNumber, token);
      } catch {
        setRecoveryWarning("This browser could not save your guest order link. Keep this page open or save its address before leaving.");
      }
    }
    setData(result);
  }

  async function copyPaymentDetail(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus(`Could not copy ${label.toLowerCase()}. Select and copy it manually.`);
    }
  }

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (!orderId) {
      setError("We couldn’t find this order. Please return to the shop or contact the store.");
      setLoading(false);
      return;
    }
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("access_token") ?? "";
    let storedToken = "";
    try {
      storedToken = getGuestOrderAccessToken(orderId);
    } catch {
      setRecoveryWarning("Saved order access could not be read from this browser.");
    }
    const token = fragmentToken || storedToken;
    if (fragmentToken) {
      try {
        rememberGuestOrder(orderId, "", fragmentToken);
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch {
        setRecoveryWarning("This browser could not save your guest order link. Keep this page open or save its address before leaving.");
      }
    }
    loadOrder(orderId, token).catch(e => setError(e instanceof Error ? e.message : "Unable to load payment details.")).finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="section wrap"><p className="muted">Loading your UPI payment details…</p></main>;
  if (!data) return <main className="section wrap" style={{ maxWidth: 700 }}><div className="notice" role="alert">{error}</div><Link className="btn btn-light" href="/orders">My orders</Link><Link className="btn btn-light" href="/shop">Continue shopping</Link></main>;

  const { order, payment } = data;
  const paymentNote = order.orderNumber;
  const paid = order.paymentStatus === "paid";
  const cancelled = order.orderStatus === "Cancelled";
  const paidButCancelled = paid && cancelled;
  const reservationExpired = order.reservationExpired || Boolean(order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() <= Date.now());

  return <main className="section wrap" style={{ maxWidth: 760 }}>
    <span className="eyebrow">Manual UPI payment</span>
    <h1 style={{ fontSize: 42 }}>Complete your payment</h1>
    <div className="summary">
      <div className="summary-line"><span>Order</span><b>{order.orderNumber}</b></div>
      {order.items.map((item, index) => <div key={`${item.product_name}-${index}`} className="summary-line"><span>{item.product_name} × {item.quantity}</span><b>₹{Number(item.unit_price * item.quantity).toLocaleString("en-IN")}</b></div>)}
      <div className="summary-line total"><span>Amount to pay</span><b>₹{order.total.toLocaleString("en-IN")}</b></div>
    </div>
    {paidButCancelled ? <div className="notice" role="status">Payment was received, but this order was cancelled. Contact the store about fulfillment or a refund.</div> : paid ? <div className="notice" role="status">Payment verified. Your order is confirmed.</div> : cancelled || reservationExpired ? <div className="notice" role="status">{reservationExpired ? "The 30-minute stock hold expired. If you already paid, contact the store to confirm availability or arrange a refund." : "This order was cancelled. Contact the store if you already paid."}</div> : <>
      <section className="summary" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 24 }}>Pay with Google Pay or another UPI app</h2>
        <p className="muted">To pay on this phone, open GPay yourself, choose payment by UPI ID, and enter the details below. On another device, scan the QR and pay the exact amount shown above.</p>
        {order.reservationExpiresAt && <p className="notice">Your items are reserved until {new Date(order.reservationExpiresAt).toLocaleString("en-IN")}. Complete payment before then.</p>}
        <p><b>UPI ID:</b> {payment.upiId}</p>
        <button type="button" className="btn btn-light" onClick={() => copyPaymentDetail("UPI ID", payment.upiId)}>Copy UPI ID</button>
        {payment.qrUrl && <img src={payment.qrUrl} alt="Scan to pay with UPI" style={{ width: 240, height: 240, objectFit: "contain", background: "#fff", padding: 10, border: "1px solid var(--line)", borderRadius: 12, margin: "16px auto" }} />}
        <p className="muted"><b>Payment note:</b> {paymentNote}</p>
        <button type="button" className="btn btn-light" onClick={() => copyPaymentDetail("Payment note", paymentNote)}>Copy payment note</button>
        {copyStatus && <p className="muted" role="status">{copyStatus}</p>}
        <p className="muted">Enter exactly ₹{order.total.toFixed(2)} in GPay and add the payment note above.</p>
        <p><b>Important:</b> Return to this page after paying. Payment is not confirmed until the store checks its GPay account.</p>
      </section>
    </>}
    {recoveryWarning && <div className="notice" role="status">{recoveryWarning}</div>}
    <p><Link className="text-link" href="/orders">View saved guest orders on this device</Link></p>
    <p style={{ marginTop: 20 }}><Link className="text-link" href="/shop">Continue shopping</Link></p>
  </main>;
}
