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
    .select("id,customer_id,order_number,payment_reference_code,total,order_status,payment_status,payment_method,payment_details,payment_claim_reference,shipping_address,reservation_expires_at,reservation_expired,order_items(product_name,quantity,unit_price)")
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
      paymentReference: order.payment_reference_code ?? order.order_number,
      customerName: typeof shippingAddress?.name === "string" ? shippingAddress.name : "",
      total: Number(order.total),
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      paymentClaimReference: order.payment_claim_reference,
      reservationExpiresAt: order.reservation_expires_at,
      reservationExpired: order.reservation_expired,
      items: order.order_items,
    },
    payment: {
      upiId: details.upi_id,
      qrUrl: typeof details.qr_url === "string" ? details.qr_url : null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

const claimSchema = z.object({
  reference: z.string().trim().min(6).max(100).regex(/^[A-Za-z0-9-]+$/),
});

export async function POST(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  const orderId = new URL(request.url).searchParams.get("order_id");
  if (!orderId || !z.string().uuid().safeParse(orderId).success) return Response.json({ error: "Invalid order." }, { status: 400 });
  const parsed = claimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid UPI transaction ID." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order, error: readError } = await admin.from("orders")
    .select("id,customer_id,payment_details,order_status,payment_status,payment_method")
    .eq("id", orderId).maybeSingle();
  if (readError) return Response.json({ error: "Unable to load this order." }, { status: 500 });
  if (!order || order.payment_method !== "manual_upi" || !canAccessOrder(order, user?.id ?? null, request.headers.get("x-order-access-token"))) {
    return Response.json({ error: "Order not found or payment link is invalid." }, { status: 404 });
  }
  if (order.payment_status !== "pending" || order.order_status !== "Pending") {
    return Response.json({ error: "This order is not awaiting a payment reference." }, { status: 409 });
  }

  const { data: updated, error } = await admin.from("orders")
    .update({ payment_claim_reference: parsed.data.reference })
    .eq("id", orderId).eq("payment_status", "pending").eq("order_status", "Pending")
    .select("id").maybeSingle();
  if (error?.code === "23505") return Response.json({ error: "This UPI transaction ID has already been submitted for another order." }, { status: 409 });
  if (error) return Response.json({ error: "Unable to save the transaction ID. Please try again." }, { status: 500 });
  if (!updated) return Response.json({ error: "This order is no longer awaiting payment." }, { status: 409 });
  return Response.json({ submitted: true, paymentStatus: "pending" });
}
