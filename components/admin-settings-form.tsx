"use client";
import { useState } from "react";
import type { StoreSettings } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export function AdminSettingsForm({ settings }: { settings: StoreSettings }) {
  const [form, setForm] = useState({ ...settings, contact_email: settings.contact_email, instagram_url: settings.instagram_url });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function uploadLogo(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 10 * 1024 * 1024) { setMessage("Choose a JPEG, PNG, WebP or AVIF image smaller than 10 MB."); return; }
    const supabase = createClient();
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) { setMessage("Image optimization is not supported in this browser."); return; }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob) { setMessage("Unable to optimize this logo."); return; }
    const path = `brand/${crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/webp", upsert: false });
    if (error) { setMessage(`Logo upload failed: ${error.message}`); return; }
    setForm({ ...form, logo_url: supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl });
  }
  async function uploadUpiQr(file?: File) {
    if (!file) return;
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = extensions[file.type];
    if (!extension || file.size > 10 * 1024 * 1024) { setMessage("Choose a PNG, JPEG or WebP QR image smaller than 10 MB."); return; }
    const supabase = createClient();
    const path = `payments/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setMessage(`UPI QR upload failed: ${error.message}`); return; }
    setForm(current => ({ ...current, upi_qr_url: supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl }));
    setMessage("UPI QR uploaded. Save settings to make it available at checkout.");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, shipping_charge: Number(form.shipping_charge), free_shipping_threshold: Number(form.free_shipping_threshold) }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save settings.");
      setMessage("Settings saved."); window.location.reload();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save settings."); }
    finally { setBusy(false); }
  }
  return <form className="form" onSubmit={save}><div className="form-grid">
    <div className="field"><label>Brand name</label><input required value={form.brand_name} onChange={e => setForm({ ...form, brand_name: e.target.value })} /></div>
    <div className="field"><label>Business phone</label><input value={form.business_phone} onChange={e => setForm({ ...form, business_phone: e.target.value })} /></div>
    <div className="field"><label>Business WhatsApp (country code + number)</label><input placeholder="919876543210" value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} /></div>
    <div className="field"><label>UPI ID for manual payments</label><input placeholder="yourname@bank" value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} /></div>
    <div className="field"><label>Contact email</label><input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
    <div className="field"><label>Instagram URL</label><input type="url" value={form.instagram_url} onChange={e => setForm({ ...form, instagram_url: e.target.value })} /></div>
    <div className="field"><label>Shipping charge (₹)</label><input type="number" min="0" step=".01" value={form.shipping_charge} onChange={e => setForm({ ...form, shipping_charge: Number(e.target.value) })} /></div>
    <div className="field"><label>Free shipping threshold (₹)</label><input type="number" min="0" step=".01" value={form.free_shipping_threshold} onChange={e => setForm({ ...form, free_shipping_threshold: Number(e.target.value) })} /></div>
  </div>
  <div className="field"><label>Business address</label><textarea maxLength={500} value={form.business_address} onChange={e => setForm({ ...form, business_address: e.target.value })} /></div>
  <div className="field"><label>Store announcement</label><input maxLength={300} value={form.announcement} onChange={e => setForm({ ...form, announcement: e.target.value })} /></div>
  <div className="field"><label>Logo image</label><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => uploadLogo(e.target.files?.[0])} />{form.logo_url && <img src={form.logo_url} alt="Current store logo" style={{ maxWidth: 180, maxHeight: 65, objectFit: "contain" }} />}</div>
  <div className="field"><label>GPay / UPI QR code</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadUpiQr(e.target.files?.[0])} />{form.upi_qr_url && <><img src={form.upi_qr_url} alt="Current UPI payment QR code" style={{ width: 180, height: 180, objectFit: "contain", background: "#fff", padding: 8 }} /><button type="button" className="btn btn-light" onClick={() => setForm({ ...form, upi_qr_url: null })}>Remove QR</button></>}</div>
  <p className="muted">Customers can scan this QR on another device or use the UPI button on the same phone. The QR image is stored as uploaded so it stays scannable.</p>
  <div className="form-grid"><div className="field"><label>Facebook URL</label><input type="url" value={form.social_links.facebook ?? ""} onChange={e => setForm({ ...form, social_links: { ...form.social_links, facebook: e.target.value } })} /></div><div className="field"><label>YouTube URL</label><input type="url" value={form.social_links.youtube ?? ""} onChange={e => setForm({ ...form, social_links: { ...form.social_links, youtube: e.target.value } })} /></div></div>
  {message && <div role="status" className="notice">{message}</div>}<button className="btn btn-pink" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></form>;
}
