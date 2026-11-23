"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/store-provider";
import { rememberGuestOrder } from "@/lib/guest-order-storage";

const maxPhotos = 10;
const maxPhotoBytes = 350_000;
const maxOriginalPhotoBytes = 20_000_000;
const acceptedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];

async function optimizePhoto(file: File) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Could not read ${file.name}. Please choose a JPG, PNG, or WebP photo.`);
  }

  try {
    const render = async (maxDimension: number, quality: number) => {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo resizing is not supported in this browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    };

    let blob: Blob | null = null;
    for (const [maxDimension, quality] of [[1600, 0.82], [1200, 0.65], [1000, 0.55], [800, 0.45]] as const) {
      blob = await render(maxDimension, quality);
      if (!blob) throw new Error(`Could not prepare ${file.name}. Please try another photo.`);
      if (blob.size <= maxPhotoBytes) break;
    }
    if (!blob || blob.size > maxPhotoBytes) throw new Error(`${file.name} is too large after resizing. Please choose another photo.`);
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

export default function CheckoutPage() {
  const { items, clear } = useCart();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "" });
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [delivery, setDelivery] = useState({ shipping_charge: 60, free_shipping_threshold: 999 });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<{ name: string; url: string }[]>([]);
  const photoUrls = useRef<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submittedOrderId, setSubmittedOrderId] = useState("");
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState("");
  const [guestAccessToken, setGuestAccessToken] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [trackingRefresh, setTrackingRefresh] = useState(0);
  const [returnedFromWhatsApp, setReturnedFromWhatsApp] = useState(false);
  const whatsappStartedRef = useRef(false);
  const leftPageRef = useRef(false);
  const returnedToPageRef = useRef(false);
  const orderSavedRef = useRef(false);
  const [recoveryWarning, setRecoveryWarning] = useState("");
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = Math.max(0, subtotal - (appliedCoupon?.discount ?? 0)) >= delivery.free_shipping_threshold ? 0 : delivery.shipping_charge;
  const estimatedTotal = Math.max(0, subtotal - (appliedCoupon?.discount ?? 0)) + shipping;

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unable to load delivery settings.");
      const settings = await response.json() as { shipping_charge: number; free_shipping_threshold: number };
      setDelivery(settings);
    }).catch(() => setError("Delivery settings could not be loaded. Please refresh and try again."));
  }, []);

  useEffect(() => {
    if (!submittedOrderId) return;
    let active = true;
    let checking = false;
    let trackingFound = false;

    async function checkTracking() {
      if (!active || checking || trackingFound) return;
      checking = true;
      setTrackingLoading(true);
      setTrackingError("");
      try {
        const response = await fetch(`/api/orders/tracking?orderId=${encodeURIComponent(submittedOrderId)}`, {
          cache: "no-store",
          headers: guestAccessToken ? { Authorization: `Bearer ${guestAccessToken}` } : {},
        });
        const result = await response.json() as { orderStatus?: string; trackingNumber?: string | null; error?: string };
        if (!response.ok || !result.orderStatus) throw new Error(result.error ?? "Unable to load tracking details.");
        if (!active) return;
        setOrderStatus(result.orderStatus);
        setTrackingNumber(result.trackingNumber ?? null);
        trackingFound = Boolean(result.trackingNumber);
      } catch (e) {
        if (active) setTrackingError(e instanceof Error ? e.message : "Unable to load tracking details.");
      } finally {
        checking = false;
        if (active) setTrackingLoading(false);
      }
    }

    void checkTracking();
    const timer = window.setInterval(() => { void checkTracking(); }, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [submittedOrderId, guestAccessToken, trackingRefresh]);

  useEffect(() => {
    localStorage.removeItem("lilsurpriz-customization");
    return () => photoUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    function showSuccessOnReturn() {
      if (!whatsappStartedRef.current || !leftPageRef.current) return;
      returnedToPageRef.current = true;
      if (orderSavedRef.current) {
        setReturnedFromWhatsApp(true);
        setMessage("Ordered successfully ✅ Your request is saved and pending store confirmation.");
      }
    }

    function handleBlur() {
      if (whatsappStartedRef.current) leftPageRef.current = true;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && whatsappStartedRef.current) {
        leftPageRef.current = true;
      } else if (document.visibilityState === "visible") {
        showSuccessOnReturn();
      }
    }

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", showSuccessOnReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", showSuccessOnReturn);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const selected = Array.from(files);
    if (selected.some(file => !acceptedPhotoTypes.includes(file.type))) {
      setError("Choose JPG, PNG, or WebP photos.");
      return;
    }
    if (selected.some(file => file.size > maxOriginalPhotoBytes)) {
      setError("Each original photo must be smaller than 20 MB.");
      return;
    }
    if (photos.length + selected.length > maxPhotos) {
      setError(`You can add up to ${maxPhotos} photos.`);
      return;
    }
    const newPreviews = selected.map(file => {
      const url = URL.createObjectURL(file);
      photoUrls.current.push(url);
      return { name: file.name, url };
    });
    setPhotos(current => [...current, ...selected]);
    setPhotoPreviews(current => [...current, ...newPreviews]);
  }

  function removePhoto(index: number) {
    const [preview] = photoPreviews.slice(index, index + 1);
    if (preview) {
      URL.revokeObjectURL(preview.url);
      photoUrls.current = photoUrls.current.filter(url => url !== preview.url);
    }
    setPhotos(current => current.filter((_, photoIndex) => photoIndex !== index));
    setPhotoPreviews(current => current.filter((_, photoIndex) => photoIndex !== index));
  }

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const whatsappWindow = window.open("about:blank", "_blank");
    whatsappStartedRef.current = Boolean(whatsappWindow);
    if (whatsappWindow) whatsappWindow.opener = null;
    try {
      const body = new FormData();
      body.set("order", JSON.stringify({
        items: items.map(item => ({ productId: item.product.id, quantity: item.quantity })),
        ...form,
        coupon: coupon || undefined,
      }));
      const optimizedPhotos = await Promise.all(photos.map(optimizePhoto));
      for (const photo of optimizedPhotos) body.append("photos", photo);

      const response = await fetch("/api/checkout", { method: "POST", body });
      const result = await response.json() as { whatsappUrl?: string; orderId?: string; orderNumber?: string; accessToken?: string; error?: string };
      if (!response.ok || !result.whatsappUrl || !result.orderId || !result.orderNumber) {
        throw new Error(result.error ?? "Unable to submit your order request.");
      }

      if (result.accessToken) {
        try {
          rememberGuestOrder(result.orderId, result.orderNumber, result.accessToken);
        } catch {
          setRecoveryWarning("Your request was saved, but this browser could not save guest tracking access. Keep the WhatsApp message and contact the store if you need help.");
        }
      }
      clear();
      setSubmittedOrderId(result.orderId);
      setSubmittedOrderNumber(result.orderNumber);
      setGuestAccessToken(result.accessToken ?? "");
      setWhatsappUrl(result.whatsappUrl);
      orderSavedRef.current = true;
      setMessage(returnedToPageRef.current
        ? "Ordered successfully ✅ Your request is saved and pending store confirmation."
        : "Your order request is saved. WhatsApp is opening with your order details and photo links. Tap Send there, then return here.");
      if (returnedToPageRef.current) setReturnedFromWhatsApp(true);
      if (whatsappWindow) whatsappWindow.location.href = result.whatsappUrl;
      photoPreviews.forEach(photo => URL.revokeObjectURL(photo.url));
      photoUrls.current = [];
      setPhotos([]);
      setPhotoPreviews([]);
    } catch (e) {
      whatsappWindow?.close();
      setError(e instanceof Error ? e.message : "Unable to submit your order request.");
    } finally {
      setBusy(false);
    }
  }

  async function applyCoupon() {
    setError("");
    const response = await fetch("/api/coupons/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: coupon, subtotal }) });
    const result = await response.json() as { code?: string; discount?: number; error?: string };
    if (!response.ok || result.discount === undefined || !result.code) { setAppliedCoupon(null); setError(result.error ?? "Unable to apply coupon."); return; }
    setAppliedCoupon({ code: result.code, discount: result.discount });
  }

  if (submittedOrderId) return <main className="section wrap" style={{ maxWidth: 700 }}>
    <span className="eyebrow">{returnedFromWhatsApp ? "Order complete" : "Order request saved"}</span><h1 style={{ fontSize: 44 }}>{returnedFromWhatsApp ? "Ordered successfully ✅" : "Almost done"}</h1>
    <div className="notice success" role="status">{message}</div>
    <p className="muted">{returnedFromWhatsApp ? "If you sent the WhatsApp message, your order request is complete. Returning here cannot verify that WhatsApp delivered it. We’ll confirm availability and arrange payment with you directly; no payment has been taken." : "No payment has been taken. WhatsApp should open with your order details and private photo links. Tap Send there, then return here. Photo links expire after 7 days. Items are held for 30 minutes."}</p>
    {recoveryWarning && <p className="notice" role="status">{recoveryWarning}</p>}
    <section className="summary" aria-live="polite">
      <div className="section-head"><div><h2 style={{ fontSize: 22 }}>Track your order</h2><p className="muted">Order status: {orderStatus || "Checking…"}</p></div><button type="button" className="btn btn-light" disabled={trackingLoading} onClick={() => setTrackingRefresh(current => current + 1)}>{trackingLoading ? "Checking…" : "Refresh tracking"}</button></div>
      <p><b>Order number:</b> {submittedOrderNumber}</p>
      {trackingNumber ? <p><b>ST Courier tracking number:</b> {trackingNumber}</p> : <p className="muted">The ST Courier tracking number will appear here after your order ships and the store adds it.</p>}
      {trackingError && <p className="notice" role="alert">{trackingError}</p>}
    </section>
    <a className="btn btn-pink" href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => { whatsappStartedRef.current = true; }}>{returnedFromWhatsApp ? "Open WhatsApp again" : "Open WhatsApp to send your order"}</a>
    <p style={{ marginTop: 20 }}><Link className="text-link" href="/shop">Continue shopping</Link></p>
  </main>;

  if (!items.length) return <main className="section wrap"><div className="banner"><h2>Your bag is empty</h2><Link className="btn" href="/shop">Shop gifts</Link></div></main>;

  return <main className="section wrap"><span className="eyebrow">Almost there</span><h1 style={{ fontSize: 44 }}>Delivery details</h1>
    <div className="split"><form className="form" onSubmit={placeOrder}>
      <div className="field"><label htmlFor="checkout-name">Full name</label><input id="checkout-name" required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div>
      <div className="field"><label htmlFor="checkout-phone">Mobile number</label><input id="checkout-phone" required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" placeholder="10-digit Indian number" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></div>
      <div className="field"><label htmlFor="checkout-email">Email (optional)</label><input id="checkout-email" type="email" maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></div>
      <div className="field"><label htmlFor="checkout-address">Address</label><textarea id="checkout-address" required maxLength={300} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></div>
      <div className="form-grid"><div className="field"><label htmlFor="checkout-city">City</label><input id="checkout-city" required maxLength={80} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /></div><div className="field"><label htmlFor="checkout-state">State</label><input id="checkout-state" required maxLength={80} value={form.state} onChange={event => setForm({ ...form, state: event.target.value })} /></div></div>
      <div className="field"><label htmlFor="checkout-pincode">PIN code</label><input id="checkout-pincode" required inputMode="numeric" pattern="[0-9]{6}" value={form.pincode} onChange={event => setForm({ ...form, pincode: event.target.value })} /></div>
      <div className="field"><label htmlFor="checkout-photos">Add multiple photos</label><input id="checkout-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { addPhotos(event.target.files); event.currentTarget.value = ""; }} /><small className="muted">Select up to {maxPhotos} photos. We resize them and add private links to your WhatsApp message; links expire after 7 days.</small>
        {photoPreviews.length > 0 && <div className="file-preview">{photoPreviews.map((photo, index) => <div key={photo.url} style={{ position: "relative" }}><img src={photo.url} alt={`Selected photo ${index + 1}: ${photo.name}`} /><button type="button" aria-label={`Remove ${photo.name}`} onClick={() => removePhoto(index)}>×</button></div>)}</div>}
      </div>
      <div className="field"><label htmlFor="checkout-coupon">Coupon code (optional)</label><div style={{ display: "flex", gap: 8 }}><input id="checkout-coupon" value={coupon} onChange={event => { setCoupon(event.target.value.toUpperCase()); setAppliedCoupon(null); }} /><button type="button" className="btn btn-light" onClick={applyCoupon}>Apply</button></div>{appliedCoupon && <small className="muted">{appliedCoupon.code} applied.</small>}</div>
      <div className="summary"><h2 style={{ fontSize: 20 }}>Send your order request</h2><p className="muted">After saving your request, WhatsApp opens with the order details and photo links. Review them and tap Send. We’ll confirm availability and arrange payment with you directly; no payment is taken here. Items are held for 30 minutes.</p></div>
      {error && <div className="notice" role="alert">{error}</div>}
      <button className="btn btn-pink" disabled={busy}>{busy ? "Saving order and photos…" : "Submit order request on WhatsApp"}</button>
    </form><div className="summary"><h2 style={{ fontSize: 24 }}>Your order</h2>{items.map(item => <div key={item.product.id} className="summary-line"><span>{item.product.name} × {item.quantity}</span><b>₹{(item.product.price * item.quantity).toLocaleString("en-IN")}</b></div>)}<div className="summary-line"><span>Subtotal</span><b>₹{subtotal.toLocaleString("en-IN")}</b></div>{appliedCoupon && <div className="summary-line"><span>Discount ({appliedCoupon.code})</span><b>− ₹{appliedCoupon.discount.toLocaleString("en-IN")}</b></div>}<div className="summary-line"><span>Delivery</span><b>{shipping ? `₹${shipping.toLocaleString("en-IN")}` : "Free"}</b></div><div className="summary-line total"><span>Estimated total</span><b>₹{estimatedTotal.toLocaleString("en-IN")}</b></div></div></div>
  </main>;
}
