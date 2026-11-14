"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PaymentReturnPage() {
  const [message, setMessage] = useState("We’re confirming your payment securely…");
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (!orderId) { setMessage("We couldn’t find this order. Please check My Orders or contact us."); return; }
    const verifiedOrderId = orderId;
    let active = true;
    let attempts = 0;
    let timer: number | undefined;
    async function check() {
      try {
        const response = await fetch(`/api/payments/status?order_id=${encodeURIComponent(verifiedOrderId)}`, { cache: "no-store" });
        const result = await response.json() as { status?: string; error?: string };
        if (!active) return;
        if (result.status === "paid") { setPaid(true); setMessage("Your payment is confirmed. Your surprise is in safe hands!"); return; }
        if (!response.ok && response.status !== 502) { setMessage(result.error ?? "We couldn’t verify this order yet."); return; }
      } catch {
        if (!active) return;
      }
      attempts += 1;
      if (attempts >= 5) { setMessage("Your payment is still being verified. Please check My Orders shortly; the store will update it only after Cashfree confirmation."); return; }
      timer = window.setTimeout(check, 3000);
    }
    void check();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, []);
  return <main className="section wrap" style={{ maxWidth: 650, textAlign: "center" }}><span className="eyebrow">Thank you</span><h1 style={{ fontSize: 43 }}>{paid ? "Your surprise is on its way" : "Payment update"}</h1><p className="muted" role="status">{message}</p><p className="muted">Your order is marked paid only after confirmation directly from Cashfree.</p><div style={{ display: "flex", justifyContent: "center", gap: 12 }}><Link className="btn btn-pink" href="/orders">My orders</Link><Link className="btn btn-light" href="/shop">Keep browsing</Link></div></main>;
}
