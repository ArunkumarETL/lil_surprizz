import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ id: z.string().uuid(), order_status: z.enum(["Pending", "Paid", "Processing", "Packed", "Shipped", "Delivered", "Cancelled"]), tracking_number: z.string().trim().max(150).nullable() });

export async function PATCH(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid order update." }, { status: 400 });
  const db = createAdminClient();
  const { data: order, error: readError } = await db.from("orders").select("payment_status,order_status").eq("id", parsed.data.id).maybeSingle();
  if (readError || !order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (parsed.data.order_status === "Pending" && (order.payment_status !== "pending" || order.order_status !== "Pending")) return Response.json({ error: "Only an unpaid order can remain pending." }, { status: 409 });
  if (!["Cancelled", "Pending"].includes(parsed.data.order_status) && order.payment_status !== "paid") return Response.json({ error: "Only a verified paid order can move to fulfilment." }, { status: 409 });
  const { error } = await db.from("orders").update({ order_status: parsed.data.order_status, tracking_number: parsed.data.tracking_number, updated_at: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) return Response.json({ error: "Unable to update order." }, { status: 500 });
  return Response.json({ saved: true });
}
