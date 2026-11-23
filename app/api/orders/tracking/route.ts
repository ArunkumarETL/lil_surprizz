import { z } from "zod";
import { canAccessOrder } from "@/lib/guest-order-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!z.string().uuid().safeParse(orderId).success) {
    return Response.json({ error: "Invalid order." }, { status: 400 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = /^Bearer ([a-f0-9]{64})$/i.exec(authorization)?.[1] ?? null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("customer_id,payment_details,order_status,tracking_number")
    .eq("id", orderId)
    .maybeSingle();

  if (error) return Response.json({ error: "Unable to load order tracking." }, { status: 500 });
  if (!order || !canAccessOrder(order, user?.id ?? null, token)) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }

  return Response.json({
    orderStatus: order.order_status,
    trackingNumber: order.tracking_number,
  }, { headers: { "Cache-Control": "no-store" } });
}
