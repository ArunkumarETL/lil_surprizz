"use client";
import { useState } from "react";
export function DeleteProductButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  async function deleteProduct() {
    if (!window.confirm("Permanently delete this product? It will be removed from the shop and product list. Past order records will remain. This cannot be undone.")) return;
    setBusy(true);
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json() as { error?: string; warning?: string };
    if (!response.ok) { window.alert(result.error ?? "Unable to delete product."); setBusy(false); return; }
    if (result.warning) window.alert(result.warning);
    window.location.reload();
  }
  return <button disabled={busy} onClick={deleteProduct} style={{ border: 0, background: "none", color: "#b42318", marginLeft: 8 }}>{busy ? "Deleting…" : "Delete permanently"}</button>;
}
