import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const input = z.object({ code: z.string().trim().min(1).max(40), subtotal: z.number().positive().max(10000000) }).safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Enter a valid coupon code." }, { status: 400 });
  const { data: coupon, error } = await createAdminClient().from("coupons").select("*").eq("code", input.data.code.toUpperCase()).eq("active", true).maybeSingle();
  if (error) return Response.json({ error: "Unable to validate this coupon right now." }, { status: 500 });
  if (!coupon || (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) || input.data.subtotal < Number(coupon.minimum_order)) {
    return Response.json({ error: "That coupon is invalid or does not apply to this order." }, { status: 400 });
  }
  const rawDiscount = coupon.discount_type === "percent" ? input.data.subtotal * Number(coupon.discount_value) / 100 : Number(coupon.discount_value);
  const discount = Math.min(input.data.subtotal, Math.round(rawDiscount * 100) / 100);
  return Response.json({ code: coupon.code, discount });
}
