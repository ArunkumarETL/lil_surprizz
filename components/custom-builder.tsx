"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { useCart } from "@/components/store-provider";

const colours = ["Blush pink", "Lavender", "Cream", "Surprise me"];
const occasions = ["Birthday", "Bestie surprise", "Thank you", "Just because", "Self care"];

export function CustomBuilder({ products, whatsapp }: { products: Product[]; whatsapp: string }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [recipient, setRecipient] = useState("");
  const [occasion, setOccasion] = useState(occasions[0]);
  const [colour, setColour] = useState(colours[0]);
  const [note, setNote] = useState("");
  const [instructions, setInstructions] = useState("");
  const [message, setMessage] = useState("");
  const { add } = useCart();
  const router = useRouter();
  const selected = products.filter(product => (quantities[product.id] ?? 0) > 0);
  const total = selected.reduce((sum, product) => sum + product.price * quantities[product.id], 0);
  const details = { recipient, occasion, colour, note, instructions, items: selected.map(p => ({ productId: p.id, name: p.name, quantity: quantities[p.id], unitPrice: p.price })), estimatedTotal: total };

  async function saveAndContinue(channel: "whatsapp" | "online") {
    if (!selected.length || !recipient.trim()) { setMessage("Choose at least one gift and add the recipient’s name."); return; }
    setMessage("");
    try {
      const response = await fetch("/api/custom-enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(details) });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? "Could not save your hamper request.");
      }
      if (channel === "whatsapp") {
        if (!whatsapp) throw new Error("The store has not added its WhatsApp number yet. Please use Contact Us.");
        const lines = selected.map(p => `• ${p.name} × ${quantities[p.id]} — ₹${(p.price * quantities[p.id]).toLocaleString("en-IN")}`).join("\n");
        const text = `Hi LILSURPRIZ! I'd love a custom hamper.\nRecipient: ${recipient}\nOccasion: ${occasion}\nBox: ${colour}\nItems:\n${lines}\nMessage: ${note || "None"}\nInstructions: ${instructions || "None"}\nEstimated total: ₹${total.toLocaleString("en-IN")}`;
        window.open(`https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      } else {
        selected.forEach(product => add(product, quantities[product.id]));
        localStorage.setItem("lilsurpriz-customization", JSON.stringify(details));
        router.push("/checkout");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong."); }
  }

  return <div className="split"><div><h2 style={{ fontSize: 24 }}>Pick their little joys</h2>{products.length ? products.map(product => <label key={product.id} className="cart-row" style={{ gridTemplateColumns: "1fr auto", cursor: "pointer" }}>
    <span><b>{product.name}</b><br /><span className="muted">₹{product.price.toLocaleString("en-IN")} · {product.stock} in stock</span></span>
    <span className="quantity"><button type="button" aria-label="Remove one" onClick={e => { e.preventDefault(); setQuantities({ ...quantities, [product.id]: Math.max(0, (quantities[product.id] ?? 0) - 1) }); }}>−</button><b>{quantities[product.id] ?? 0}</b><button type="button" aria-label="Add one" disabled={(quantities[product.id] ?? 0) >= product.stock} onClick={e => { e.preventDefault(); setQuantities({ ...quantities, [product.id]: (quantities[product.id] ?? 0) + 1 }); }}>+</button></span>
    </label>) : <p className="notice">There are no available hamper items yet. The store can add products in the admin dashboard.</p>}
    </div><div className="summary"><h2 style={{ fontSize: 24 }}>Make it theirs</h2><div className="form">
      <div className="field"><label>Recipient name</label><input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Who’s the surprise for?" /></div>
      <div className="field"><label>Occasion</label><select value={occasion} onChange={e => setOccasion(e.target.value)}>{occasions.map(o => <option key={o}>{o}</option>)}</select></div>
      <div className="field"><label>Box colour</label><select value={colour} onChange={e => setColour(e.target.value)}>{colours.map(c => <option key={c}>{c}</option>)}</select></div>
      <div className="field"><label>Personal message</label><textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="A little note to make them smile…" /></div>
      <div className="field"><label>Special instructions</label><textarea maxLength={1000} value={instructions} onChange={e => setInstructions(e.target.value)} /></div>
      <div className="summary-line total"><span>Estimated gift total</span><b>₹{total.toLocaleString("en-IN")}</b></div>
      {message && <div role="alert" className="notice">{message}</div>}
      <button className="btn btn-pink" onClick={() => saveAndContinue("online")}>Add to bag & pay online</button>
      <button className="btn btn-light" onClick={() => saveAndContinue("whatsapp")}>Continue with WhatsApp</button>
      <small className="muted">WhatsApp requests are enquiries only; no payment is taken or marked as paid.</small>
    </div></div></div>;
}
