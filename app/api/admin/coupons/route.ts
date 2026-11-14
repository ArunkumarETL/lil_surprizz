import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ id: z.string().uuid().optional(), code: z.string().trim().min(3).max(40).transform(v => v.toUpperCase()), discount_type: z.enum(["percent", "fixed"]), discount_value: z.number().positive().max(100000), minimum_order: z.number().nonnegative(), active: z.boolean(), expires_at: z.string().datetime().nullable() });

export async function GET() {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const { data, error } = await createAdminClient().from("coupons").select("*").order("created_at", { ascending: false });
  if (error) return Response.json({ error: "Unable to load coupons." }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid coupon values." }, { status: 400 });
  if (body.data.discount_type === "percent" && body.data.discount_value > 100) return Response.json({ error: "Percent discounts cannot exceed 100%." }, { status: 400 });
  const { id: _id, ...data } = body.data;
  const { error } = await createAdminClient().from("coupons").insert(data);
  if (error) return Response.json({ error: error.code === "23505" ? "Coupon code already exists." : "Unable to create coupon." }, { status: 400 });
  return Response.json({ saved: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const body = schema.extend({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid coupon values." }, { status: 400 });
  if (body.data.discount_type === "percent" && body.data.discount_value > 100) return Response.json({ error: "Percent discounts cannot exceed 100%." }, { status: 400 });
  const { id, ...data } = body.data;
  const { error } = await createAdminClient().from("coupons").update(data).eq("id", id);
  if (error) return Response.json({ error: "Unable to update coupon." }, { status: 400 });
  return Response.json({ saved: true });
}
