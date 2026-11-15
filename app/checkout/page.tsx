"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/store-provider";

export default function CheckoutPage() {
  const { items, clear } = useCart();
  const [form, setForm] = useState({ name: "", phone: "", address: "", city: "", state: "", pincode: "" });
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [delivery, setDelivery] = useState({ shipping_charge: 60, free_shipping_threshold: 999 });
  const [upiStatus, setUpiStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [customization, setCustomization] = useState<Record<string, unknown> | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = Math.max(0, subtotal - (appliedCoupon?.discount ?? 0)) >= delivery.free_shipping_threshold ? 0 : delivery.shipping_charge;
  const estimatedTotal = Math.max(0, subtotal - (appliedCoupon?.discount ?? 0)) + shipping;
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unable to load payment settings.");
      const settings = await response.json() as { shipping_charge: number; free_shipping_threshold: number; upi_id?: string };
      setDelivery(settings);
      setUpiStatus(settings.upi_id ? "ready" : "unavailable");
    }).catch(() => setUpiStatus("unavailable"));
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem("lilsurpriz-customization");
    if (saved) {
      try { setCustomization(JSON.parse(saved) as Record<string, unknown>); }
      catch { localStorage.removeItem("lilsurpriz-customization"); }
    }
  }, []);
  async function placeOrder(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: items.map(i => ({ productId: i.product.id, quantity: i.quantity })), ...form, coupon: coupon || undefined, customization }) });
      const result = await response.json() as { manualPaymentUrl?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to start checkout.");
      if (!result.manualPaymentUrl) throw new Error(result.error ?? "Unable to start UPI payment.");
      clear();
      localStorage.removeItem("lilsurpriz-customization");
      window.location.assign(result.manualPaymentUrl);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to start checkout."); setBusy(false); }
  }
  async function applyCoupon() {
    setError("");
    const response = await fetch("/api/coupons/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: coupon, subtotal }) });
    const result = await response.json() as { code?: string; discount?: number; error?: string };
    if (!response.ok || result.discount === undefined || !result.code) { setAppliedCoupon(null); setError(result.error ?? "Unable to apply coupon."); return; }
    setAppliedCoupon({ code: result.code, discount: result.discount });
  }
  if (!items.length) return <main className="section wrap"><div className="banner"><h2>Your bag is empty</h2><Link className="btn" href="/shop">Shop gifts</Link></div></main>;
  return <main className="section wrap"><span className="eyebrow">Almost there</span><h1 style={{ fontSize: 44 }}>Delivery details</h1>
    <div className="split"><form className="form" onSubmit={placeOrder}><div className="field"><label>Full name</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <div className="field"><label>Mobile number</label><input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" placeholder="10-digit Indian number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
      <div className="field"><label>Address</label><textarea required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
      <div className="form-grid"><div className="field"><label>City</label><input required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div><div className="field"><label>State</label><input required value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div></div>
      <div className="field"><label>PIN code</label><input required inputMode="numeric" pattern="[0-9]{6}" value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} /></div>
      <div className="field"><label>Coupon code (optional)</label><div style={{ display: "flex", gap: 8 }}><input value={coupon} onChange={e => { setCoupon(e.target.value.toUpperCase()); setAppliedCoupon(null); }} /><button type="button" className="btn btn-light" onClick={applyCoupon}>Apply</button></div>{appliedCoupon && <small className="muted">{appliedCoupon.code} applied.</small>}</div>
      <div className="summary"><h2 style={{ fontSize: 20 }}>Pay with Google Pay or another UPI app</h2><p className="muted">You’ll pay in your UPI app and submit the transaction reference. Your order stays pending until the store verifies the payment.</p></div>
      {upiStatus === "unavailable" && <div className="notice" role="alert">UPI payments are not available right now. Please contact the store.</div>}
      {error && <div className="notice" role="alert">{error}</div>}<button className="btn btn-pink" disabled={busy || upiStatus !== "ready"}>{busy ? "Creating order…" : upiStatus === "loading" ? "Loading payment options…" : "Continue to UPI payment"}</button>
    </form><div className="summary"><h2 style={{ fontSize: 24 }}>Your order</h2>{items.map(i => <div key={i.product.id} className="summary-line"><span>{i.product.name} × {i.quantity}</span><b>₹{(i.product.price * i.quantity).toLocaleString("en-IN")}</b></div>)}<div className="summary-line"><span>Subtotal</span><b>₹{subtotal.toLocaleString("en-IN")}</b></div>{appliedCoupon && <div className="summary-line"><span>Discount ({appliedCoupon.code})</span><b>− ₹{appliedCoupon.discount.toLocaleString("en-IN")}</b></div>}<div className="summary-line"><span>Delivery</span><b>{shipping ? `₹${shipping.toLocaleString("en-IN")}` : "Free"}</b></div><div className="summary-line total"><span>Estimated total</span><b>₹{estimatedTotal.toLocaleString("en-IN")}</b></div></div></div>
  </main>;
}
