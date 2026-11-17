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
    tr: paymentReference,
    tn: paymentReference,
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
    paymentClaimReference: string | null;
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
  const [accessToken, setAccessToken] = useState("");
  const [claimReference, setClaimReference] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [dynamicQr, setDynamicQr] = useState("");
  const [qrError, setQrError] = useState("");

  async function loadOrder(orderId: string, token: string) {
    const response = await fetch(`/api/checkout/manual-payment?order_id=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
      headers: token ? { "X-Order-Access-Token": token } : undefined,
    });
    const result = await response.json() as ManualPaymentData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load payment details.");
    setAccessToken(token);
    setClaimReference(result.order.paymentClaimReference ?? "");
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

  async function submitPaymentReference(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setClaimBusy(true);
    setClaimMessage("");
    try {
      const response = await fetch(`/api/checkout/manual-payment?order_id=${encodeURIComponent(data.order.id)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { "X-Order-Access-Token": accessToken } : {}),
        },
        body: JSON.stringify({ reference: claimReference }),
      });
      const result = await response.json() as { error?: string; submitted?: boolean };
      if (!response.ok) throw new Error(result.error ?? "Unable to submit the transaction ID.");
      setData(current => current ? { ...current, order: { ...current.order, paymentClaimReference: claimReference.trim() } } : current);
      setClaimMessage("Transaction ID submitted. Your order remains pending until the store verifies the payment.");
    } catch (submitError) {
      setClaimMessage(submitError instanceof Error ? submitError.message : "Unable to submit the transaction ID.");
    } finally {
      setClaimBusy(false);
    }
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
      if (!cancelled) setQrError("The order-specific QR could not be generated. Use the Open UPI app button or the backup static QR.");
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
  const paymentNote = order.paymentReference;
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
        <p className="muted">Scan the order-specific QR or open a UPI app to prefill the recipient, exact amount, transaction reference and payment note. The payment note contains this order’s reference. UPI apps still require you to review and authorize the payment.</p>
        {order.reservationExpiresAt && <p className="notice">Your items are reserved until {new Date(order.reservationExpiresAt).toLocaleString("en-IN")}. Complete payment before then.</p>}
        <div className="summary" style={{ marginTop: 16, textAlign: "center" }}>
          <h3 style={{ fontSize: 20 }}>Scan to prefill this order’s amount</h3>
          {dynamicQr ? <img src={dynamicQr} alt={`Dynamic UPI QR for ${order.orderNumber}, amount ₹${order.total.toFixed(2)}`} style={{ width: 256, height: 256, objectFit: "contain", background: "#fff", padding: 8, border: "1px solid var(--line)", borderRadius: 12, margin: "12px auto" }} /> : qrError ? <p className="notice" role="alert">{qrError}</p> : <p className="muted" role="status">Preparing your order-specific QR…</p>}
          <p className="muted">This dynamic QR includes ₹{order.total.toFixed(2)} and reference {order.paymentReference}; you should not need to type the amount.</p>
        </div>
        <p><b>UPI ID:</b> {payment.upiId}</p>
        <button type="button" className="btn btn-light" onClick={() => copyPaymentDetail("UPI ID", payment.upiId)}>Copy UPI ID</button>
        {payment.qrUrl && <details style={{ marginTop: 16 }}><summary>Backup: use the uploaded static QR</summary><p className="muted">This saved QR does not include this order’s amount. If you use it, enter ₹{order.total.toFixed(2)} and payment reference {order.paymentReference} yourself.</p><img src={payment.qrUrl} alt="Uploaded static UPI QR backup" style={{ width: 240, height: 240, objectFit: "contain", background: "#fff", padding: 10, border: "1px solid var(--line)", borderRadius: 12, margin: "16px auto" }} /></details>}
        <p className="muted"><b>Payment reference / note:</b> {paymentNote}</p>
        <button type="button" className="btn btn-light" onClick={() => copyPaymentDetail("Payment reference", paymentNote)}>Copy payment reference</button>
        {copyStatus && <p className="muted" role="status">{copyStatus}</p>}
        <p><b>Important:</b> Return to this page after paying. Payment is not confirmed until the store checks its GPay account.</p>
        <a className="btn btn-pink" href={upiUrl}>Open GPay / UPI app with amount</a>
        <form className="form" onSubmit={submitPaymentReference} style={{ marginTop: 24 }}>
          <div className="field">
            <label htmlFor="upi-transaction-reference">UPI transaction ID (after paying)</label>
            <input id="upi-transaction-reference" required minLength={6} maxLength={100} pattern="[A-Za-z0-9-]+" value={claimReference} onChange={event => setClaimReference(event.target.value)} />
          </div>
          <button className="btn btn-light" disabled={claimBusy}>{claimBusy ? "Submitting…" : "Submit transaction ID"}</button>
          {order.paymentClaimReference && <p className="muted">Submitted transaction ID: {order.paymentClaimReference}</p>}
          {claimMessage && <p className="muted" role="status">{claimMessage}</p>}
          <p className="muted">Submitting an ID does not mark your order as paid. The store will verify the payment in its GPay/bank account.</p>
        </form>
      </section>
    </>}
    {recoveryWarning && <div className="notice" role="status">{recoveryWarning}</div>}
    <p><Link className="text-link" href="/orders">View saved guest orders on this device</Link></p>
    <p style={{ marginTop: 20 }}><Link className="text-link" href="/shop">Continue shopping</Link></p>
  </main>;
}
