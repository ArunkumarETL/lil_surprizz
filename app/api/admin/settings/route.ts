import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  brand_name: z.string().trim().min(2).max(100), logo_url: z.string().url().nullable(),
  business_phone: z.string().trim().max(30), business_address: z.string().trim().max(500),
  whatsapp_number: z.string().trim().max(20), contact_email: z.string().email().or(z.literal("")),
  instagram_url: z.string().url().or(z.literal("")), shipping_charge: z.number().nonnegative().max(100000),
  free_shipping_threshold: z.number().nonnegative().max(10000000), announcement: z.string().max(300),
  social_links: z.record(z.string(), z.string().url().or(z.literal(""))),
});

export async function PATCH(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Please check your settings and try again." }, { status: 400 });
  const { error } = await createAdminClient().from("store_settings").upsert({ id: 1, ...body.data, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: "Unable to save store settings." }, { status: 500 });
  return Response.json({ saved: true });
}
