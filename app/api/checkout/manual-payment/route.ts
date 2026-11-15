import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const referenceSchema = z.object({
  orderId: z.string().uuid(),
  reference: z.string().trim().min(6).max(100).regex(/^[A-Za-z0-9-]+$/, "Enter the UPI transaction reference using letters and numbers only."),
});

export async function GET(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return Response.json({ error: "Sign in to view this payment." }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("order_id");
  if (!orderId || !z.string().uuid().safeParse(orderId).success) return Response.json({ error: "Invalid order." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("id,customer_id,order_number,total,order_status,payment_status,payment_method,payment_details,payment_claim_reference,order_items(product_name,quantity,unit_price)")
    .eq("id", orderId).eq("customer_id", user.id).maybeSingle();
  if (error) return Response.json({ error: "Unable to load payment details." }, { status: 500 });
  if (!order || order.payment_method !== "manual_upi") return Response.json({ error: "Order not found." }, { status: 404 });

  const details = order.payment_details as { upi_id?: unknown; qr_url?: unknown } | null;
  if (!details || typeof details.upi_id !== "string") return Response.json({ error: "UPI details are unavailable for this order." }, { status: 503 });
  return Response.json({
    order: {
      id: order.id,
      orderNumber: order.order_number,
      total: Number(order.total),
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      paymentClaimReference: order.payment_claim_reference,
      items: order.order_items,
    },
    payment: {
      upiId: details.upi_id,
      qrUrl: typeof details.qr_url === "string" ? details.qr_url : null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return Response.json({ error: "Sign in to submit a payment reference." }, { status: 401 });
  const parsed = referenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid UPI transaction reference." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order, error: readError } = await admin.from("orders")
    .select("id,order_status,payment_status,payment_method")
    .eq("id", parsed.data.orderId).eq("customer_id", user.id).maybeSingle();
  if (readError) return Response.json({ error: "Unable to verify this order." }, { status: 500 });
  if (!order || order.payment_method !== "manual_upi") return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status !== "pending" || order.order_status !== "Pending") {
    return Response.json({ error: "This order is no longer waiting for a UPI payment." }, { status: 409 });
  }

  const { data: updated, error: updateError } = await admin.from("orders")
    .update({ payment_claim_reference: parsed.data.reference, updated_at: new Date().toISOString() })
    .eq("id", order.id).eq("customer_id", user.id).eq("payment_status", "pending").eq("order_status", "Pending")
    .select("id").maybeSingle();
  if (updateError?.code === "23505") return Response.json({ error: "That transaction reference was already submitted for another order." }, { status: 409 });
  if (updateError) return Response.json({ error: "Unable to save the payment reference." }, { status: 500 });
  if (!updated) return Response.json({ error: "This order changed while you were submitting the reference. Refresh and check its status." }, { status: 409 });
  return Response.json({ submitted: true, paymentStatus: "pending" });
}
