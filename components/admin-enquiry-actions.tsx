"use client";
import { useState } from "react";
export function AdminEnquiryActions({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  const [message, setMessage] = useState("");
  async function save() {
    const response = await fetch("/api/admin/enquiries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: value }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error ?? "Unable to update."); return; }
    setMessage("Saved");
  }
  return <span style={{ display: "flex", gap: 6 }}><select value={value} onChange={e => setValue(e.target.value)}>{["New", "Contacted", "Completed", "Closed"].map(s => <option key={s}>{s}</option>)}</select><button onClick={save}>Save</button><small>{message}</small></span>;
}
