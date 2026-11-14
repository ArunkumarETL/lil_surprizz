"use client";
import { useState } from "react";
import type { Category } from "@/lib/types";

const blank = { name: "", description: "", image_url: "", active: true };
export function AdminCategoryManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");
  function start(item?: Category) {
    setEditing(item ?? null);
    setForm(item ? { name: item.name, description: item.description ?? "", image_url: item.image_url ?? "", active: item.active } : blank);
    setMessage("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/admin/categories", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(editing ? { id: editing.id } : {}), ...form, image_url: form.image_url || null }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error ?? "Unable to save category."); return; }
    window.location.reload();
  }
  async function deactivate(id: string) {
    if (!window.confirm("Deactivate this category? Products remain saved.")) return;
    const response = await fetch(`/api/admin/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { const result = await response.json() as { error?: string }; setMessage(result.error ?? "Unable to deactivate category."); return; }
    window.location.reload();
  }
  return <div className="split"><div><div className="section-head"><h2 style={{ fontSize: 24 }}>Categories</h2><button className="btn btn-pink" onClick={() => start()}>+ Add category</button></div>
    {categories.map(category => <div className="cart-row" key={category.id} style={{ gridTemplateColumns: "1fr auto auto" }}><span><b>{category.name}</b><br /><span className="muted">{category.slug} · {category.active ? "Active" : "Inactive"}</span></span><button onClick={() => start(category)}>Edit</button>{category.active && <button onClick={() => deactivate(category.id)}>Deactivate</button>}</div>)}
  </div>{<form className="summary form" onSubmit={save}><h2 style={{ fontSize: 22 }}>{editing ? "Edit category" : "New category"}</h2><div className="field"><label>Name</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div><div className="field"><label>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div><div className="field"><label>Image URL (optional)</label><input type="url" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} /></div><label><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active</label>{message && <div className="notice" role="alert">{message}</div>}<button className="btn btn-pink">Save category</button></form>}</div>;
}
