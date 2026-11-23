"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { useCart } from "@/components/store-provider";

const surpriseMe = "Surprise me";
const occasions = ["Birthday", "Bestie surprise", "Thank you", "Just because", "Self care"];

export function CustomBuilder({ products, colours }: { products: Product[]; colours: string[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [recipient, setRecipient] = useState("");
  const [occasion, setOccasion] = useState(occasions[0]);
  const [colour, setColour] = useState(colours[0] ?? surpriseMe);
  const [note, setNote] = useState("");
  const [instructions, setInstructions] = useState("");
  const [message, setMessage] = useState("");
  const { add } = useCart();
  const router = useRouter();
  const selected = products.filter(product => (quantities[product.id] ?? 0) > 0);
  const total = selected.reduce((sum, product) => sum + product.price * quantities[product.id], 0);
  const details = { recipient, occasion, colour, note, instructions, items: selected.map(p => ({ productId: p.id, name: p.name, quantity: quantities[p.id], unitPrice: p.price })), estimatedTotal: total };

  function continueToCheckout() {
    if (!selected.length || !recipient.trim()) { setMessage("Choose at least one gift and add the recipient’s name."); return; }
    setMessage("");
    selected.forEach(product => add(product, quantities[product.id]));
    localStorage.setItem("lilsurpriz-customization", JSON.stringify(details));
    router.push("/checkout");
  }

  return <div className="split"><div><h2 style={{ fontSize: 24 }}>Pick their little joys</h2>{products.length ? products.map(product => <label key={product.id} className="cart-row" style={{ gridTemplateColumns: "1fr auto", cursor: "pointer" }}>
    <span><b>{product.name}</b><br /><span className="muted">₹{product.price.toLocaleString("en-IN")} · {product.stock} in stock</span></span>
    <span className="quantity"><button type="button" aria-label="Remove one" onClick={e => { e.preventDefault(); setQuantities({ ...quantities, [product.id]: Math.max(0, (quantities[product.id] ?? 0) - 1) }); }}>−</button><b>{quantities[product.id] ?? 0}</b><button type="button" aria-label="Add one" disabled={(quantities[product.id] ?? 0) >= product.stock} onClick={e => { e.preventDefault(); setQuantities({ ...quantities, [product.id]: (quantities[product.id] ?? 0) + 1 }); }}>+</button></span>
    </label>) : <p className="notice">There are no available gift items yet. The store can add products in the admin dashboard.</p>}
    </div><div className="summary"><h2 style={{ fontSize: 24 }}>Make it theirs</h2><div className="form">
      <div className="field"><label>Recipient name</label><input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Who’s the surprise for?" /></div>
      <div className="field"><label>Occasion</label><select value={occasion} onChange={e => setOccasion(e.target.value)}>{occasions.map(o => <option key={o}>{o}</option>)}</select></div>
      <div className="field"><label>Box colour</label><select value={colour} onChange={e => setColour(e.target.value)}>{colours.map(c => <option key={c}>{c}</option>)}<option>{surpriseMe}</option></select></div>
      <div className="field"><label>Personal message</label><textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="A little note to make them smile…" /></div>
      <div className="field"><label>Special instructions</label><textarea maxLength={1000} value={instructions} onChange={e => setInstructions(e.target.value)} /></div>
      <div className="summary-line total"><span>Estimated gift total</span><b>₹{total.toLocaleString("en-IN")}</b></div>
      {message && <div role="alert" className="notice">{message}</div>}
      <button className="btn btn-pink" onClick={continueToCheckout}>Continue to order details</button>
      <small className="muted">Add delivery details and any photo lamp images next, then review and send your request in WhatsApp.</small>
    </div></div></div>;
}
