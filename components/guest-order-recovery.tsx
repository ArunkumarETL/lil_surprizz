"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGuestOrderAccessToken, readSavedGuestOrders, removeSavedGuestOrder, type SavedGuestOrder } from "@/lib/guest-order-storage";
import { StCourierTrackForm } from "@/components/st-courier-track-form";

function GuestOrderTracking({ orderId }: { orderId: string }) {
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    let accessToken = "";
    try {
      accessToken = getGuestOrderAccessToken(orderId);
    } catch {
      setError("Tracking access could not be read on this device.");
      return () => { active = false; };
    }
    if (!accessToken) {
      setError("Tracking access is not available on this device.");
      return () => { active = false; };
    }
    setTrackingNumber(null);
    setError("");
    fetch(`/api/orders/tracking?orderId=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(async response => {
      const result = await response.json() as { trackingNumber?: string | null; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load tracking details.");
      if (active) setTrackingNumber(result.trackingNumber ?? null);
    }).catch(e => {
      if (active) setError(e instanceof Error ? e.message : "Unable to load tracking details.");
    });
    return () => { active = false; };
  }, [orderId, refresh]);

  return trackingNumber
    ? <div><p className="muted">ST Courier tracking: {trackingNumber}</p><StCourierTrackForm trackingNumber={trackingNumber} /></div>
    : <div><p className="muted">{error || "The ST Courier tracking number will appear here after the store adds it."}</p><button type="button" className="btn btn-light" onClick={() => setRefresh(current => current + 1)}>Refresh tracking</button></div>;
}

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
        <GuestOrderTracking orderId={order.orderId} />
      </article>)}
    </div>}
    {orders.length > 0 && <p><Link className="text-link" href="/contact">Contact us about an order</Link></p>}
  </>;
}
