import { getStoreSettings } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const metadata = { title: "Shipping policy" };
export default async function ShippingPage() {
  const settings = await getStoreSettings();
  return <main className="section wrap" style={{ maxWidth: 820 }}><span className="eyebrow">A little joy is on its way</span><h1 style={{ fontSize: 44 }}>Shipping information</h1><p className="muted">We deliver across India to serviceable PIN codes. The delivery fee is ₹{settings.shipping_charge.toLocaleString("en-IN")} and shipping is free on orders above ₹{settings.free_shipping_threshold.toLocaleString("en-IN")}, unless checkout shows otherwise.</p><p className="muted">Delivery estimates can vary by destination, carrier, weather, and the time needed to prepare a custom gift box. If tracking is available, we’ll share it after dispatch.</p><p className="muted">Please check your address and phone number carefully before paying. For a delivery update, contact us with your order number.</p></main>;
}
