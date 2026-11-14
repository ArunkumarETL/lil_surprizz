"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/store-provider";

export default function CartPage() {
  const { items, setQuantity, remove } = useCart();
  const [delivery, setDelivery] = useState({ shipping_charge: 60, free_shipping_threshold: 999 });
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const settings = await response.json() as { shipping_charge: number; free_shipping_threshold: number };
      setDelivery(settings);
    }).catch(() => undefined);
  }, []);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal >= delivery.free_shipping_threshold ? 0 : delivery.shipping_charge;
  return <main className="section wrap"><span className="eyebrow">Your picks</span><h1 style={{ fontSize: 44 }}>Your bag</h1>
    {!items.length ? <div className="banner"><h2>Your bag is taking a little nap</h2><p>Find a thoughtful surprise to add some joy.</p><Link className="btn btn-pink" href="/shop">Explore gifts</Link></div> :
      <div className="split"><div>{items.some(i => !i.product.available || i.product.stock < i.quantity) && <p className="notice">Some gifts are unavailable or have changed stock. Remove them or update quantities before checkout.</p>}{items.map(({ product, quantity }) => <CartRow key={product.id} product={product} quantity={quantity} setQuantity={setQuantity} remove={remove} />)}</div>
        <div className="summary"><h2 style={{ fontSize: 24 }}>Order summary</h2><div className="summary-line"><span>Subtotal</span><b>₹{subtotal.toLocaleString("en-IN")}</b></div><div className="summary-line"><span>Delivery</span><b>{shipping ? `₹${shipping.toLocaleString("en-IN")}` : "Free"}</b></div><p className="muted">Coupon discounts are applied at checkout.</p><div className="summary-line total"><span>Estimated total</span><span>₹{(subtotal + shipping).toLocaleString("en-IN")}</span></div><Link className="btn btn-pink" style={{ width: "100%", marginTop: 14 }} href="/checkout">Continue to checkout</Link></div></div>}
  </main>;
}

function CartRow({ product, quantity, setQuantity, remove }: { product: import("@/lib/types").Product; quantity: number; setQuantity: (id: string, quantity: number) => void; remove: (id: string) => void }) {
  const [image] = useState(product.product_images?.[0]?.image_url ?? "");
  return <div className="cart-row">{image ? <img src={image} alt="" /> : <div className="product-image" style={{ width: 90, height: 90 }}>🎁</div>}<div><b>{product.name}</b><div className="muted">₹{product.price.toLocaleString("en-IN")}</div><div className="quantity" style={{ marginTop: 7 }}><button aria-label="Decrease quantity" onClick={() => setQuantity(product.id, quantity - 1)}>−</button><span>{quantity}</span><button aria-label="Increase quantity" disabled={quantity >= product.stock} onClick={() => setQuantity(product.id, quantity + 1)}>+</button></div></div><button aria-label={`Remove ${product.name}`} className="text-link" style={{ border: 0, background: "none", color: "var(--pink-dark)" }} onClick={() => remove(product.id)}>Remove</button></div>;
}
