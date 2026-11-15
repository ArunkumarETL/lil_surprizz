import { createAdminClient } from "@/lib/supabase/admin";
import { AdminOrderActions } from "@/components/admin-order-actions";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export default async function AdminOrdersPage() {
  await requireAdminPage();
  const { data, error } = await createAdminClient().from("orders").select("*, customers(full_name,email,phone), order_items(product_name,quantity,unit_price)").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load orders: ${error.message}`);
  return <><span className="eyebrow">From their door to yours</span><h1 style={{ fontSize: 38 }}>Orders</h1><div className="table-scroll"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status & tracking</th></tr></thead><tbody>{data?.map(order => <tr key={order.id}><td>{order.order_number}<br /><small>{new Date(order.created_at).toLocaleDateString("en-IN")}</small></td><td>{order.customers?.full_name}<br />{order.customers?.email}<br />{order.customers?.phone}</td><td>{order.order_items.map((i: { product_name: string; quantity: number }) => `${i.product_name} ×${i.quantity}`).join(", ")}</td><td>₹{Number(order.total).toLocaleString("en-IN")}</td><td>{order.payment_status}<br /><small>{order.payment_method === "manual_upi" ? "GPay / UPI" : "Cashfree"}</small>{order.payment_claim_reference && <><br /><small>Customer-reported UTR: {order.payment_claim_reference}</small></>}{order.payment_reference && <><br /><small>{order.payment_method === "manual_upi" ? "Verified UTR" : "Cashfree reference"}: {order.payment_reference}</small></>}</td><td><AdminOrderActions id={order.id} status={order.order_status} tracking={order.tracking_number} paymentStatus={order.payment_status} paymentMethod={order.payment_method} paymentClaimReference={order.payment_claim_reference} /></td></tr>)}</tbody></table></div></>;
}
