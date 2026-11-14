import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/account");
  const { data: orders, error } = await supabase.from("orders").select("*, order_items(*)").eq("customer_id", user.id).order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load orders: ${error.message}`);
  return <main className="section wrap"><span className="eyebrow">Your surprises</span><h1 style={{ fontSize: 44 }}>My orders</h1>
    {!orders?.length ? <div className="banner"><h2>No orders just yet</h2><Link className="btn btn-pink" href="/shop">Find a gift</Link></div> : <div className="form">{orders.map(order => <article key={order.id} className="summary">
      <div className="section-head"><div><b>{order.order_number}</b><div className="muted">{new Date(order.created_at).toLocaleDateString("en-IN")}</div></div><span className="pill">{order.order_status}</span></div>
      {order.order_items.map((item: { id: string; product_name: string; quantity: number; unit_price: number }) => <div key={item.id} className="summary-line"><span>{item.product_name} × {item.quantity}</span><b>₹{Number(item.unit_price * item.quantity).toLocaleString("en-IN")}</b></div>)}
      <div className="summary-line total"><span>Payment: {order.payment_status}</span><b>₹{Number(order.total).toLocaleString("en-IN")}</b></div>{order.tracking_number && <p className="muted">Tracking: {order.tracking_number}</p>}
    </article>)}</div>}
  </main>;
}
