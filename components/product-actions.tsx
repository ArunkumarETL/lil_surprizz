"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { useCart } from "@/components/store-provider";

export function ProductActions({ product }: { product: Product }) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  return <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
    <div className="quantity"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><b>{quantity}</b><button aria-label="Increase quantity" disabled={quantity >= product.stock} onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}>+</button><span className="muted">{product.stock} in stock</span></div>
    <button className="btn btn-pink" disabled={!product.available || product.stock < 1} onClick={() => { add(product, quantity); setMessage("Added to your bag!"); }}>Add to bag — ₹{(product.price * quantity).toLocaleString("en-IN")}</button>
    {product.customizable && <a className="btn btn-light" href="/customise">Make it your own</a>}
    {message && <span className="notice success" role="status">{message}</span>}
  </div>;
}
