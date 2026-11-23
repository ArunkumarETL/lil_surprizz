"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, Product } from "@/lib/types";

type Props = { categories: Category[]; product?: Product };
type ProductFormState = {
  name: string; sku: string; description: string; category_id: string; price: string; compare_at_price: string; stock: string;
  features: string; hamper_items: string; size: string; weight_grams: string; customer_photo_mode: "none" | "optional" | "required"; customer_photo_limit: string;
  available: boolean; featured: boolean; new_arrival: boolean;
};

async function optimizeImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image optimization is not supported in this browser.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Could not optimize image.")), "image/webp", 0.82));
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}

export function AdminProductForm({ categories, product }: Props) {
  const [form, setForm] = useState<ProductFormState>({
    name: product?.name ?? "", sku: product?.sku ?? "", description: product?.description ?? "", category_id: product?.category_id ?? "",
    price: String(product?.price ?? ""), compare_at_price: product?.compare_at_price ? String(product.compare_at_price) : "", stock: String(product?.stock ?? 0),
    features: (product?.features ?? []).join("\n"), hamper_items: (product?.hamper_items ?? []).join("\n"), size: product?.size ?? "", weight_grams: product?.weight_grams ? String(product.weight_grams) : "",
    customer_photo_mode: product?.customer_photo_mode ?? "none", customer_photo_limit: String(product?.customer_photo_limit ?? 1),
    available: product?.available ?? true, featured: product?.featured ?? false, new_arrival: product?.new_arrival ?? false,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [images, setImages] = useState((product?.product_images ?? []).sort((a, b) => a.position - b.position).map(image => image.image_url));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) { setForm(current => ({ ...current, [key]: value })); }
  function chooseFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list);
    if (images.length + files.length + next.length > 12) { setError("You can add up to 12 images."); return; }
    setError(""); setFiles(current => [...current, ...next]); setPreviews(current => [...current, ...next.map(file => URL.createObjectURL(file))]);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (!form.name.trim() || !form.sku.trim() || Number(form.price) < 0 || !Number.isFinite(Number(form.price))) throw new Error("Enter a product name, SKU, and valid price.");
      const customerPhotoLimit = Number(form.customer_photo_limit);
      if (form.customer_photo_mode !== "none" && (!Number.isInteger(customerPhotoLimit) || customerPhotoLimit < 1 || customerPhotoLimit > 10)) throw new Error("Set a maximum of 1 to 10 customer photos.");
      const supabase = createClient();
      const imageUrls = [...images];
      for (const file of files) {
        const optimized = await optimizeImage(file);
        const path = `${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(path, optimized, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrls.push(data.publicUrl);
      }
      const body = {
        ...(product ? { id: product.id } : {}),
        name: form.name.trim(), sku: form.sku.trim(), description: form.description, category_id: form.category_id || null,
        price: Number(form.price), compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null, stock: Number(form.stock),
        features: form.features.split("\n").map(v => v.trim()).filter(Boolean), hamper_items: form.hamper_items.split("\n").map(v => v.trim()).filter(Boolean),
        size: form.size || null, weight_grams: form.weight_grams ? Number(form.weight_grams) : null,
        customer_photo_mode: form.customer_photo_mode, customer_photo_limit: form.customer_photo_mode === "none" ? 1 : customerPhotoLimit,
        available: form.available, featured: form.featured, new_arrival: form.new_arrival, image_urls: imageUrls,
      };
      const response = await fetch("/api/admin/products", { method: product ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save product.");
      window.location.href = "/admin/products";
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save product."); setBusy(false); }
  }

  const fields: Array<[keyof ProductFormState, string]> = [["available", "Available for sale"], ["featured", "Featured product"], ["new_arrival", "New arrival"]];
  return <form className="form" onSubmit={save}>
    <div className="form-grid">
      <div className="field"><label>Product name *</label><input required maxLength={150} value={form.name} onChange={e => update("name", e.target.value)} /></div>
      <div className="field"><label>Product ID / SKU *</label><input required maxLength={80} value={form.sku} onChange={e => update("sku", e.target.value)} /></div>
      <div className="field"><label>Category</label><select value={form.category_id} onChange={e => update("category_id", e.target.value)}><option value="">Uncategorised</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></div>
      <div className="field"><label>Discount / selling price (₹) *</label><input required type="number" min="0" step="0.01" value={form.price} onChange={e => update("price", e.target.value)} /></div>
      <div className="field"><label>Regular price (₹, optional)</label><input type="number" min="0" step="0.01" value={form.compare_at_price} onChange={e => update("compare_at_price", e.target.value)} /></div>
      <div className="field"><label>Stock quantity *</label><input required type="number" min="0" step="1" value={form.stock} onChange={e => update("stock", e.target.value)} /></div>
      <div className="field"><label>Product size</label><input value={form.size} onChange={e => update("size", e.target.value)} /></div>
      <div className="field"><label>Weight (grams)</label><input type="number" min="0" step="1" value={form.weight_grams} onChange={e => update("weight_grams", e.target.value)} /></div>
    </div>
    <div className="field"><label>Description</label><textarea maxLength={10000} value={form.description} onChange={e => update("description", e.target.value)} /></div>
    <div className="form-grid"><div className="field"><label>Features (one per line)</label><textarea value={form.features} onChange={e => update("features", e.target.value)} /></div><div className="field"><label>Gift box items (one per line)</label><textarea value={form.hamper_items} onChange={e => update("hamper_items", e.target.value)} /></div></div>
    <div className="form-grid">
      <div className="field"><label>Customer photo upload</label><select value={form.customer_photo_mode} onChange={e => { const value = e.target.value; if (value === "none" || value === "optional" || value === "required") update("customer_photo_mode", value); }}><option value="none">Not needed</option><option value="optional">Optional</option><option value="required">Required</option></select><small className="muted">Controls whether customers see a photo upload field at checkout.</small></div>
      {form.customer_photo_mode !== "none" && <div className="field"><label>Maximum customer photos</label><input type="number" min="1" max="10" step="1" required value={form.customer_photo_limit} onChange={e => update("customer_photo_limit", e.target.value)} /><small className="muted">If required, customers must add at least one photo. Photos apply to all units of this product in the order.</small></div>}
    </div>
    <div className="field"><label>Product photos (up to 12, JPEG/PNG/WebP/AVIF, max 10 MB each)</label><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e => chooseFiles(e.target.files)} /><small className="muted">Images are resized and optimized in your browser before secure upload.</small>
      <div className="file-preview">{images.map((url, i) => <div key={url} style={{ position: "relative" }}><img src={url} alt={`Product image ${i + 1}`} /><button type="button" aria-label="Remove image" onClick={() => setImages(images.filter((_, n) => n !== i))}>×</button></div>)}{previews.map((url, i) => <div key={url} style={{ position: "relative" }}><img src={url} alt={`New image ${i + 1}`} /><button type="button" aria-label="Remove image" onClick={() => { setFiles(files.filter((_, n) => n !== i)); setPreviews(previews.filter((_, n) => n !== i)); URL.revokeObjectURL(url); }}>×</button></div>)}</div>
    </div>
    <div className="form-grid">{fields.map(([key, label]) => <label key={key} style={{ display: "flex", gap: 9, alignItems: "center" }}><input type="checkbox" checked={form[key] as boolean} onChange={e => update(key, e.target.checked)} />{label}</label>)}</div>
    {error && <div role="alert" className="notice">{error}</div>}<div style={{ display: "flex", gap: 12 }}><button className="btn btn-pink" disabled={busy}>{busy ? "Saving…" : product ? "Save changes" : "Publish product"}</button><Link className="btn btn-light" href="/admin/products">Cancel</Link></div>
  </form>;
}
