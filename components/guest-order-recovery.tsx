"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGuestOrderAccessToken, readSavedGuestOrders, removeSavedGuestOrder, type SavedGuestOrder } from "@/lib/guest-order-storage";

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

  async function copyOrderLink(orderId: string) {
    try {
      const token = getGuestOrderAccessToken(orderId);
      if (!token) throw new Error("The access token is missing from this device.");
      const link = new URL(`/payment/manual?order_id=${encodeURIComponent(orderId)}`, window.location.origin);
      link.hash = new URLSearchParams({ access_token: token }).toString();
      await navigator.clipboard.writeText(link.toString());
      setMessage("Secure order link copied. Keep it private; anyone with it can view this order.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not copy the secure order link.");
    }
  }

  return <>
    <p className="muted">Guest order links are saved on this device. Copy a secure link to continue on another device; keep it private.</p>
    {message && <div className="notice" role="alert">{message}</div>}
    {!orders.length ? <div className="banner"><h2>No saved guest orders</h2><p>Guest orders you place on this device will appear here.</p><Link className="btn btn-pink" href="/shop">Find a gift</Link></div> : <div className="form">
      {orders.map(order => <article key={order.orderId} className="summary">
        <div className="section-head"><b>{order.orderNumber || "Guest order"}</b><button type="button" className="btn btn-light" onClick={() => removeOrder(order.orderId)}>Remove from this device</button></div>
        <Link className="btn btn-pink" href={`/payment/manual?order_id=${encodeURIComponent(order.orderId)}`}>View payment and order status</Link>
        <button type="button" className="btn btn-light" onClick={() => copyOrderLink(order.orderId)}>Copy secure order link</button>
      </article>)}
    </div>}
  </>;
}
