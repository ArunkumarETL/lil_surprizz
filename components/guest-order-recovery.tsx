"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readSavedGuestOrders, removeSavedGuestOrder, type SavedGuestOrder } from "@/lib/guest-order-storage";

export function GuestOrderRecovery() {
  const [orders, setOrders] = useState<SavedGuestOrder[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      setOrders(readSavedGuestOrders());
    } catch {
      setMessage("Saved guest order links could not be read on this device.");
    }
  }, []);

  function removeOrder(orderId: string) {
    try {
      removeSavedGuestOrder(orderId);
      setOrders(current => current.filter(order => order.orderId !== orderId));
      setMessage("");
    } catch {
      setMessage("Could not remove this saved order from the device.");
    }
  }

  return <>
    <p className="muted">Guest order numbers are saved on this device. Contact us if you need help with an order.</p>
    {message && <div className="notice" role="alert">{message}</div>}
    {!orders.length ? <div className="banner"><h2>No saved guest orders</h2><p>Guest orders you place on this device will appear here.</p><Link className="btn btn-pink" href="/shop">Find a gift</Link></div> : <div className="form">
      {orders.map(order => <article key={order.orderId} className="summary">
        <div className="section-head"><b>{order.orderNumber || "Guest order"}</b><button type="button" className="btn btn-light" onClick={() => removeOrder(order.orderId)}>Remove from this device</button></div>
      </article>)}
    </div>}
    {orders.length > 0 && <p><Link className="text-link" href="/contact">Contact us about an order</Link></p>}
  </>;
}
