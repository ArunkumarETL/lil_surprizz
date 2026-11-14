import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const parsed = z.object({ ids: z.array(z.string().uuid()).max(30) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid cart." }, { status: 400 });
  if (!parsed.data.ids.length) return Response.json([]);
  const { data, error } = await createAdminClient().from("products").select("*, category:categories(*), product_images(*)").in("id", [...new Set(parsed.data.ids)]);
  if (error) return Response.json({ error: "Unable to refresh your bag." }, { status: 500 });
  return Response.json((data ?? []).filter(product => product.available && !product.archived));
}
