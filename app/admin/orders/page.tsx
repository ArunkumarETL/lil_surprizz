import { createAdminClient } from "@/lib/supabase/admin";
import { AdminOrderActions } from "@/components/admin-order-actions";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";

type CustomOrderDetails = {
  recipient: string | null;
  occasion: string | null;
  colour: string | null;
  note: string | null;
  instructions: string | null;
};

function readCustomOrderDetails(value: unknown): CustomOrderDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const details = value as Record<string, unknown>;
  const asText = (field: unknown) => typeof field === "string" && field.trim() ? field : null;
  const parsed = {
    recipient: asText(details.recipient),
    occasion: asText(details.occasion),
    colour: asText(details.colour),
    note: asText(details.note),
    instructions: asText(details.instructions),
  };
  return Object.values(parsed).some(Boolean) ? parsed : null;
}

export default async function AdminOrdersPage() {
  await requireAdminPage();
  const db = createAdminClient();
  const { error: expiryError } = await db.rpc("expire_pending_order_reservations");
  if (expiryError) throw new Error(`Unable to expire pending order reservations: ${expiryError.message}`);
  const { data, error } = await db.from("orders").select("*, customers(full_name,email,phone), order_items(product_name,quantity,unit_price)").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load orders: ${error.message}`);
  return <><span className="eyebrow">From their door to yours</span><h1 style={{ fontSize: 38 }}>Orders</h1><div className="table-scroll"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status & tracking</th></tr></thead><tbody>{data?.map(order => {
    const address = order.shipping_address as { name?: string; phone?: string } | null;
    const custom = readCustomOrderDetails(order.custom_details);
    return <tr key={order.id}>
      <td>{order.order_number}<br /><small>{new Date(order.created_at).toLocaleDateString("en-IN")}</small></td>
      <td>{order.customers?.full_name || address?.name || "—"}<br />{order.customers?.email}<br />{order.customers?.phone || address?.phone}</td>
      <td>
        {order.order_items.map((i: { product_name: string; quantity: number }) => `${i.product_name} ×${i.quantity}`).join(", ")}
        {custom && <details><summary>Custom hamper details</summary><dl>
          {custom.recipient && <div><dt>Recipient</dt><dd>{custom.recipient}</dd></div>}
          {custom.occasion && <div><dt>Occasion</dt><dd>{custom.occasion}</dd></div>}
          {custom.colour && <div><dt>Box colour</dt><dd>{custom.colour}</dd></div>}
          {custom.note && <div><dt>Personal message</dt><dd>{custom.note}</dd></div>}
          {custom.instructions && <div><dt>Instructions</dt><dd>{custom.instructions}</dd></div>}
        </dl></details>}
      </td>
      <td>₹{Number(order.total).toLocaleString("en-IN")}</td>
      <td>{order.payment_status}<br /><small>{order.payment_method === "manual_upi" ? "GPay / UPI" : "Cashfree"}</small>{order.payment_claim_reference && <><br /><small>Customer-reported UTR: {order.payment_claim_reference}</small></>}{order.payment_reference && <><br /><small>{order.payment_method === "manual_upi" ? "Verified UTR" : "Cashfree reference"}: {order.payment_reference}</small></>}</td>
      <td><AdminOrderActions id={order.id} status={order.order_status} tracking={order.tracking_number} paymentStatus={order.payment_status} paymentMethod={order.payment_method} paymentClaimReference={order.payment_claim_reference} reservationExpired={order.reservation_expired} /></td>
    </tr>;
  })}</tbody></table></div></>;
}
