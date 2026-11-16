"use client";

import { useState } from "react";
import type { BoxColour } from "@/lib/types";

const blank = { name: "", active: true };

export function AdminBoxColourManager({ colours }: { colours: BoxColour[] }) {
  const [editing, setEditing] = useState<BoxColour | null>(null);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");

  function start(colour?: BoxColour) {
    setEditing(colour ?? null);
    setForm(colour ? { name: colour.name, active: colour.active } : blank);
    setMessage("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/box-colours", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(editing ? { id: editing.id } : {}), ...form }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Unable to save box colour.");
      return;
    }
    window.location.reload();
  }

  async function deactivate(id: string) {
    if (!window.confirm("Deactivate this box colour? Existing enquiries will keep their saved colour.")) return;
    const response = await fetch(`/api/admin/box-colours?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json() as { error?: string };
      setMessage(result.error ?? "Unable to deactivate box colour.");
      return;
    }
    window.location.reload();
  }

  return <div className="split">
    <div>
      <div className="section-head"><h2 style={{ fontSize: 24 }}>Available colours</h2><button className="btn btn-pink" onClick={() => start()}>+ Add colour</button></div>
      {colours.map(colour => <div className="cart-row" key={colour.id} style={{ gridTemplateColumns: "1fr auto auto" }}>
        <span><b>{colour.name}</b><br /><span className="muted">{colour.active ? "Active" : "Inactive"}</span></span>
        <button onClick={() => start(colour)}>Edit</button>
        {colour.active && <button onClick={() => deactivate(colour.id)}>Deactivate</button>}
      </div>)}
      {!colours.length && <p className="muted">No colours added yet. Add one to show it in the customer dropdown.</p>}
      {message && <div className="notice" role="alert">{message}</div>}
    </div>
    <form className="summary form" onSubmit={save}>
      <h2 style={{ fontSize: 22 }}>{editing ? "Edit colour" : "New colour"}</h2>
      <div className="field"><label htmlFor="box-colour-name">Colour name</label><input id="box-colour-name" required minLength={2} maxLength={60} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mint green" /></div>
      <label><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active — show in customer dropdown</label>
      {message && <div className="notice" role="alert">{message}</div>}
      <button className="btn btn-pink">Save colour</button>
    </form>
  </div>;
}
