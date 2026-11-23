import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export default async function AdminDashboard() {
  await requireAdminPage();
  const db = createAdminClient();
  const [products, orders, customers, lowStock] = await Promise.all([
    db.from("products").select("id", { count: "exact", head: true }).eq("archived", false),
    db.from("orders").select("id,order_status,total"),
    db.from("customers").select("id", { count: "exact", head: true }),
    db.from("products").select("id", { count: "exact", head: true }).eq("archived", false).lte("stock", 5),
  ]);
  const ordersData = orders.data ?? [];
  return <><div className="section-head"><div><span className="eyebrow">Store pulse</span><h1 style={{ fontSize: 38, margin: "8px 0" }}>Dashboard</h1></div><Link className="btn btn-pink" href="/admin/products/new">+ Add product</Link></div>
    <div className="stats">{[
      ["Products", products.count ?? 0], ["Total orders", ordersData.length], ["Pending orders", ordersData.filter(o => ["Pending", "Paid", "Processing"].includes(o.order_status)).length], ["Completed", ordersData.filter(o => o.order_status === "Delivered").length],
      ["Customers", customers.count ?? 0], ["Low stock (≤5)", lowStock.count ?? 0],
    ].map(([label, value]) => <div className="stat" key={label}><span className="muted">{label}</span><b>{value}</b></div>)}</div>
    <section className="section"><h2 style={{ fontSize: 24 }}>Recent orders</h2>{ordersData.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>Status</th><th>Total</th></tr></thead><tbody>{ordersData.slice(0, 7).map(order => <tr key={order.id}><td>{order.order_status}</td><td>₹{Number(order.total).toLocaleString("en-IN")}</td></tr>)}</tbody></table></div> : <p className="muted">No orders yet. Your first customer order will appear here.</p>}</section></>;
}
