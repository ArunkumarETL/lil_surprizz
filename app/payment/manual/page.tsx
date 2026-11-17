"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getGuestOrderAccessToken, rememberGuestOrder } from "@/lib/guest-order-storage";

function buildUpiPaymentUrl(upiId: string, amount: number, paymentReference: string) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: "LILSURPRIZ",
    am: amount.toFixed(2),
    cu: "INR",
    tn: paymentReference,
    tr: paymentReference,
  });
  return `upi://pay?${params}`;
}

type ManualPaymentData = {
  order: {
    id: string;
    orderNumber: string;
    paymentReference: string;
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
  const [dynamicQr, setDynamicQr] = useState("");
  const [qrError, setQrError] = useState("");

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

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setDynamicQr("");
    setQrError("");
    QRCode.toDataURL(
      buildUpiPaymentUrl(data.payment.upiId, data.order.total, data.order.paymentReference),
      { errorCorrectionLevel: "M", margin: 2, width: 256 },
    ).then(value => {
      if (!cancelled) setDynamicQr(value);
    }).catch(error => {
      console.error("Unable to generate order-specific UPI QR", error);
      if (!cancelled) setQrError("The order-specific QR could not be generated. Use the manual UPI option below.");
    });
    return () => { cancelled = true; };
  }, [data?.order.id, data?.order.total, data?.order.paymentReference, data?.payment.upiId]);

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
  const upiUrl = buildUpiPaymentUrl(payment.upiId, order.total, order.paymentReference);
  const paid = order.paymentStatus === "paid";
  const cancelled = order.orderStatus === "Cancelled";
  const paidButCancelled = paid && cancelled;
  const reservationExpired = order.reservationExpired || Boolean(order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() <= Date.now());

  return <main className="section wrap" style={{ maxWidth: 760 }}>
    <span className="eyebrow">Manual UPI payment</span>
    <h1 style={{ fontSize: 42 }}>Complete your payment</h1>
    <div className="summary">
      <div className="summary-line"><span>Order</span><b>{order.orderNumber}</b></div>
      <div className="summary-line"><span>Payment reference</span><b>{order.paymentReference}</b></div>
      {order.items.map((item, index) => <div key={`${item.product_name}-${index}`} className="summary-line"><span>{item.product_name} × {item.quantity}</span><b>₹{Number(item.unit_price * item.quantity).toLocaleString("en-IN")}</b></div>)}
      <div className="summary-line total"><span>Amount to pay</span><b>₹{order.total.toLocaleString("en-IN")}</b></div>
    </div>
    {paidButCancelled ? <div className="notice" role="status">Payment was received, but this order was cancelled. Contact the store about fulfillment or a refund.</div> : paid ? <div className="notice" role="status">Payment verified. Your order is confirmed.</div> : cancelled || reservationExpired ? <div className="notice" role="status">{reservationExpired ? "The 30-minute stock hold expired. If you already paid, contact the store to confirm availability or arrange a refund." : "This order was cancelled. Contact the store if you already paid."}</div> : <>
      <section className="summary" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 24 }}>Pay with Google Pay or another UPI app</h2>
        <p className="muted">Scan this order-specific QR with another phone. It includes the exact amount and payment reference, so you won’t need to enter the amount. Review and authorize the payment in your UPI app.</p>
        {order.reservationExpiresAt && <p className="notice">Your items are reserved until {new Date(order.reservationExpiresAt).toLocaleString("en-IN")}. Complete payment before then.</p>}
        <div className="summary" style={{ marginTop: 16, textAlign: "center" }}>
          <h3 style={{ fontSize: 20 }}>Dynamic QR — amount and payment note included</h3>
          {dynamicQr ? <img src={dynamicQr} alt={`Dynamic UPI QR for ${order.orderNumber}, amount ₹${order.total.toFixed(2)}`} style={{ width: 256, height: 256, objectFit: "contain", background: "#fff", padding: 8, border: "1px solid var(--line)", borderRadius: 12, margin: "12px auto" }} /> : qrError ? <p className="notice" role="alert">{qrError}</p> : <p className="muted" role="status">Preparing your order-specific QR…</p>}
          <p className="muted">This dynamic QR includes ₹{order.total.toFixed(2)} and reference {order.paymentReference}; you should not need to type the amount.</p>
          <a className="btn btn-pink" href={upiUrl}>Open Google Pay / UPI app with amount</a>
          <p className="muted">The app will show the prefilled amount for you to review and authorize. If the app handoff fails, scan the QR with another phone.</p>
        </div>
        <details style={{ marginTop: 16 }}>
          <summary>Having trouble with automatic UPI? Pay manually</summary>
          <p className="muted">Open your UPI app, choose payment by UPI ID, and enter the exact amount shown below. This manual transfer is not prefilled.</p>
          <p><b>UPI ID:</b> {payment.upiId}</p>
          <p><b>Exact amount:</b> ₹{order.total.toFixed(2)}</p>
          <p className="muted">Payment note (optional): {order.paymentReference}. If adding a note causes an error, leave it blank; the reference remains on this order page.</p>
          {payment.qrUrl && <><p className="muted">Or scan this saved static QR from another device, then enter the exact amount above.</p><img src={payment.qrUrl} alt="Uploaded static UPI QR backup" style={{ width: 240, height: 240, objectFit: "contain", background: "#fff", padding: 10, border: "1px solid var(--line)", borderRadius: 12, margin: "16px auto" }} /></>}
          <p className="muted">The order remains pending until the store verifies the payment in its GPay/bank account.</p>
        </details>
        <p><b>Payment reference:</b> {order.paymentReference}</p>
        <p><b>Important:</b> Your order stays pending until the store verifies the payment in its GPay/bank account. Opening the UPI app does not confirm payment.</p>
      </section>
    </>}
    {recoveryWarning && <div className="notice" role="status">{recoveryWarning}</div>}
    <p><Link className="text-link" href="/orders">View saved guest orders on this device</Link></p>
    <p style={{ marginTop: 20 }}><Link className="text-link" href="/shop">Continue shopping</Link></p>
  </main>;
}
