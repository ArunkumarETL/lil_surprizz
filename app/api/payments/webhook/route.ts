import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function cashfreeBase() {
  return process.env.CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  const secret = process.env.CASHFREE_CLIENT_SECRET;
  if (!signature || !timestamp || !secret) return Response.json({ error: "Invalid webhook." }, { status: 400 });
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  let event: { data?: { order?: { order_id?: string }; payment?: { cf_payment_id?: string; payment_status?: string } } };
  try { event = JSON.parse(rawBody) as typeof event; } catch { return Response.json({ error: "Malformed event." }, { status: 400 }); }
  const orderId = event.data?.order?.order_id;
  if (!orderId) return Response.json({ ok: true });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id").eq("cashfree_order_id", orderId).maybeSingle();
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  const verify = await fetch(`${cashfreeBase()}/orders/${encodeURIComponent(orderId)}`, {
    headers: { "x-api-version": process.env.CASHFREE_API_VERSION ?? "2023-08-01", "x-client-id": process.env.CASHFREE_CLIENT_ID!, "x-client-secret": secret },
    cache: "no-store",
  });
  if (!verify.ok) return Response.json({ error: "Payment verification failed." }, { status: 502 });
  const verified = await verify.json() as { order_status?: string };
  if (verified.order_status !== "PAID") return Response.json({ ok: true });
  const reference = event.data?.payment?.cf_payment_id ?? orderId;
  const { error } = await admin.rpc("mark_order_paid", { p_order_id: order.id, p_reference: reference });
  if (error) {
    console.error("Unable to fulfil verified Cashfree payment", orderId, error.message);
    return Response.json({ error: "Payment verified but order fulfilment requires review." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
