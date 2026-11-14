"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";

export type CartItem = { product: Product; quantity: number };
type CartContextValue = { items: CartItem[]; count: number; add: (p: Product, quantity?: number) => void; remove: (id: string) => void; setQuantity: (id: string, quantity: number) => void; clear: () => void };
const CartContext = createContext<CartContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    async function restore() {
      let parsed: CartItem[] = [];
      try {
        const saved = localStorage.getItem("lilsurpriz-cart");
        if (saved) {
          parsed = JSON.parse(saved) as CartItem[];
          if (!Array.isArray(parsed)) throw new Error("Invalid saved cart");
          if (parsed.length) {
            setItems(parsed);
            const response = await fetch("/api/cart/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: parsed.map(item => item.product.id) }) });
            if (response.ok) {
              const latest = await response.json() as Product[];
              const byId = new Map(latest.map(product => [product.id, product]));
              setItems(parsed.map(item => ({ ...item, product: byId.get(item.product.id) ?? { ...item.product, available: false, stock: 0 } })));
            }
          }
        }
      } catch {
        if (!Array.isArray(parsed)) localStorage.removeItem("lilsurpriz-cart");
      } finally { setReady(true); }
    }
    void restore();
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("lilsurpriz-cart", JSON.stringify(items)); }, [items, ready]);
  const value = useMemo<CartContextValue>(() => ({
    items, count: items.reduce((sum, item) => sum + item.quantity, 0),
    add: (product, quantity = 1) => setItems(current => {
      const found = current.find(item => item.product.id === product.id);
      return found ? current.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item) : [...current, { product, quantity }];
    }),
    remove: id => setItems(current => current.filter(item => item.product.id !== id)),
    setQuantity: (id, quantity) => setItems(current => quantity < 1 ? current.filter(item => item.product.id !== id) : current.map(item => item.product.id === id ? { ...item, quantity } : item)),
    clear: () => setItems([]),
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within StoreProvider");
  return value;
}
