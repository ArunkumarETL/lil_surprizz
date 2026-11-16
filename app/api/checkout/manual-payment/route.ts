import { z } from "zod";
import { canAccessOrder } from "@/lib/guest-order-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  const orderId = new URL(request.url).searchParams.get("order_id");
  if (!orderId || !z.string().uuid().safeParse(orderId).success) return Response.json({ error: "Invalid order." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("id,customer_id,order_number,total,order_status,payment_status,payment_method,payment_details,shipping_address,order_items(product_name,quantity,unit_price)")
    .eq("id", orderId).maybeSingle();
  if (error) return Response.json({ error: "Unable to load payment details." }, { status: 500 });
  if (!order || order.payment_method !== "manual_upi" || !canAccessOrder(order, user?.id ?? null, request.headers.get("x-order-access-token"))) {
    return Response.json({ error: "Order not found or payment link is invalid." }, { status: 404 });
  }

  const details = order.payment_details as { upi_id?: unknown; qr_url?: unknown } | null;
  const shippingAddress = order.shipping_address as { name?: unknown } | null;
  if (!details || typeof details.upi_id !== "string") return Response.json({ error: "UPI details are unavailable for this order." }, { status: 503 });
  return Response.json({
    order: {
      id: order.id,
      orderNumber: order.order_number,
      customerName: typeof shippingAddress?.name === "string" ? shippingAddress.name : "",
      total: Number(order.total),
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      items: order.order_items,
    },
    payment: {
      upiId: details.upi_id,
      qrUrl: typeof details.qr_url === "string" ? details.qr_url : null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
