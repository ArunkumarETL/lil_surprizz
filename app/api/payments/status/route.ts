import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function cashfreeBase() {
  return process.env.CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

export async function GET(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return Response.json({ error: "Sign in to view this order." }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("order_id");
  if (!orderId || orderId.length > 40) return Response.json({ error: "Invalid order." }, { status: 400 });
  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders").select("id,customer_id,payment_status,order_status").eq("cashfree_order_id", orderId).maybeSingle();
  if (error || !order || order.customer_id !== user.id) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status === "paid") return Response.json({ status: "paid" });
  if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) return Response.json({ error: "Payment verification is unavailable." }, { status: 503 });

  const verification = await fetch(`${cashfreeBase()}/orders/${encodeURIComponent(orderId)}`, {
    headers: { "x-api-version": process.env.CASHFREE_API_VERSION ?? "2023-08-01", "x-client-id": process.env.CASHFREE_CLIENT_ID, "x-client-secret": process.env.CASHFREE_CLIENT_SECRET },
    cache: "no-store",
  });
  if (!verification.ok) return Response.json({ error: "Could not verify payment yet." }, { status: 502 });
  const payment = await verification.json() as { order_status?: string };
  if (payment.order_status !== "PAID") return Response.json({ status: "pending" });
  const { error: updateError } = await admin.rpc("mark_order_paid", { p_order_id: order.id, p_reference: orderId });
  if (updateError) {
    console.error("Cashfree payment verified but order fulfilment failed", orderId, updateError.message);
    return Response.json({ error: "Payment is verified; the order needs store review." }, { status: 500 });
  }
  return Response.json({ status: "paid" });
}
