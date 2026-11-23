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

function readCustomerPhotoGroups(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const details = value as Record<string, unknown>;
  const groups = Array.isArray(details.customer_photo_groups)
    ? details.customer_photo_groups.flatMap(group => {
      if (!group || typeof group !== "object" || Array.isArray(group)) return [];
      const entry = group as Record<string, unknown>;
      const paths = Array.isArray(entry.paths) ? entry.paths.filter((path): path is string => typeof path === "string" && path.startsWith("orders/")) : [];
      if (!paths.length) return [];
      return [{
        productId: typeof entry.product_id === "string" ? entry.product_id : null,
        productName: typeof entry.product_name === "string" ? entry.product_name : null,
        paths,
      }];
    })
    : [];
  if (groups.length) return groups;
  const paths = Array.isArray(details.customer_photo_paths)
    ? details.customer_photo_paths.filter((path): path is string => typeof path === "string" && path.startsWith("orders/"))
    : [];
  return paths.length ? [{ productId: null, productName: null, paths }] : [];
}

export default async function AdminOrdersPage() {
  await requireAdminPage();
  const db = createAdminClient();
  const { error: expiryError } = await db.rpc("expire_pending_order_reservations");
  if (expiryError) throw new Error(`Unable to expire pending order reservations: ${expiryError.message}`);
  const { data, error } = await db.from("orders").select("*, customers(full_name,email,phone), order_items(product_name,quantity,unit_price)").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load orders: ${error.message}`);
  const orders = await Promise.all((data ?? []).map(async order => {
    const photoGroups = readCustomerPhotoGroups(order.payment_details);
    const photoPaths = photoGroups.flatMap(group => group.paths);
    if (!photoPaths.length) return { order, photoGroups: [] as { productId: string | null; productName: string | null; photoUrls: string[] }[] };
    const { data: photos, error: photosError } = await db.storage.from("customer-order-photos").createSignedUrls(photoPaths, 60 * 60);
    const photoUrls = photos?.flatMap(photo => typeof photo.signedUrl === "string" ? [photo.signedUrl] : []) ?? [];
    if (photosError || photoUrls.length !== photoPaths.length) throw new Error(`Unable to load customer photos for order ${order.order_number}.`);
    let offset = 0;
    const signedPhotoGroups = photoGroups.map(group => {
      const urls = photoUrls.slice(offset, offset + group.paths.length);
      offset += group.paths.length;
      return { productId: group.productId, productName: group.productName, photoUrls: urls };
    });
    return { order, photoGroups: signedPhotoGroups };
  }));
  return <><span className="eyebrow">From their door to yours</span><h1 style={{ fontSize: 38 }}>Orders</h1><div className="table-scroll"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status & tracking</th></tr></thead><tbody>{orders.map(({ order, photoGroups }) => {
    const address = order.shipping_address as { name?: string; phone?: string; email?: string } | null;
    const custom = readCustomOrderDetails(order.custom_details);
    const whatsappOrder = (order.payment_details as { payment_flow?: unknown } | null)?.payment_flow === "whatsapp";
    const fulfillmentAllowed = whatsappOrder || order.payment_status === "paid";
    return <tr key={order.id}>
      <td>{order.order_number}<br /><small>ID: {order.id}</small><br /><small>{new Date(order.created_at).toLocaleDateString("en-IN")}</small></td>
      <td>{order.customers?.full_name || address?.name || "—"}<br />{order.customers?.email || address?.email}<br />{order.customers?.phone || address?.phone}</td>
      <td>
        {order.order_items.map((i: { product_name: string; quantity: number }) => `${i.product_name} ×${i.quantity}`).join(", ")}
        {photoGroups.map(group => <div key={group.productId ?? "order"}><small>{group.productName ? `Customer photos for ${group.productName}: ` : "Customer photos: "}{group.photoUrls.map((url, index) => <span key={url}><a href={url} target="_blank" rel="noreferrer">Photo {index + 1}</a>{index < group.photoUrls.length - 1 ? " · " : ""}</span>)}</small></div>)}
        {custom && <details><summary>Custom gift details</summary><dl>
          {custom.recipient && <div><dt>Recipient</dt><dd>{custom.recipient}</dd></div>}
          {custom.occasion && <div><dt>Occasion</dt><dd>{custom.occasion}</dd></div>}
          {custom.colour && <div><dt>Box colour</dt><dd>{custom.colour}</dd></div>}
          {custom.note && <div><dt>Personal message</dt><dd>{custom.note}</dd></div>}
          {custom.instructions && <div><dt>Instructions</dt><dd>{custom.instructions}</dd></div>}
        </dl></details>}
      </td>
      <td>₹{Number(order.total).toLocaleString("en-IN")}</td>
      <td><AdminOrderActions id={order.id} status={order.order_status} tracking={order.tracking_number} fulfillmentAllowed={fulfillmentAllowed} reservationExpired={order.reservation_expired} /></td>
    </tr>;
  })}</tbody></table></div></>;
}
