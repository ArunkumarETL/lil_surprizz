import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  orderId: z.string().uuid(),
  verifiedReference: z.string().trim().min(6).max(100).regex(/^[A-Za-z0-9-]+$/),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid order." }, { status: 400 });

  const db = createAdminClient();
  const { data: order, error: readError } = await db.from("orders")
    .select("payment_method,payment_status,order_status,reservation_expired")
    .eq("id", parsed.data.orderId).maybeSingle();
  if (readError) return Response.json({ error: "Unable to load this order." }, { status: 500 });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_method !== "manual_upi") return Response.json({ error: "Only manual UPI payments can be confirmed here." }, { status: 409 });
  if (order.payment_status === "paid") return Response.json({ verified: true, alreadyVerified: true });
  const expiredReservation = order.payment_status === "failed" && order.order_status === "Cancelled" && order.reservation_expired;
  if ((order.payment_status !== "pending" && !expiredReservation) || (order.order_status === "Cancelled" && !expiredReservation)) {
    return Response.json({ error: "This order is not waiting for payment verification." }, { status: 409 });
  }
  const { data: verified, error } = await db.rpc("complete_manual_upi_payment", {
    p_order_id: parsed.data.orderId,
    p_reference: parsed.data.verifiedReference,
  });
  if (error) {
    console.error("Unable to confirm manual UPI payment", parsed.data.orderId, error.message);
    if (error.code === "23505") return Response.json({ error: "This transaction reference is already linked to another order." }, { status: 409 });
    return Response.json({ error: "Payment could not be confirmed. Check current stock and try again." }, { status: 409 });
  }
  if (!verified) return Response.json({ error: "The reservation expired and the item is no longer available. Contact the customer to arrange a refund or replacement." }, { status: 409 });
  return Response.json({ verified: true });
}
