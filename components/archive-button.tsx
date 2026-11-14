"use client";
import { useState } from "react";
export function ArchiveButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  async function archive() {
    if (!window.confirm("Archive this product? It will disappear from the shop, but existing orders will be kept.")) return;
    setBusy(true);
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { const result = await response.json() as { error?: string }; window.alert(result.error ?? "Unable to archive product."); setBusy(false); return; }
    window.location.reload();
  }
  return <button disabled={busy} onClick={archive} style={{ border: 0, background: "none", color: "var(--pink-dark)", marginLeft: 8 }}>{busy ? "Archiving…" : "Archive"}</button>;
}
