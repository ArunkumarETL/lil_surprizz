import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  recipient: z.string().trim().min(1).max(100),
  occasion: z.string().trim().min(1).max(80),
  colour: z.string().trim().min(1).max(60),
  note: z.string().max(500),
  instructions: z.string().max(1000),
  estimatedTotal: z.number().nonnegative().max(1000000),
  items: z.array(z.object({ productId: z.string().uuid(), name: z.string().max(150), quantity: z.number().int().min(1).max(25), unitPrice: z.number().nonnegative() })).min(1).max(30)
    .refine(items => new Set(items.map(item => item.productId)).size === items.length, "Duplicate products are not allowed."),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Please add a recipient and at least one gift item." }, { status: 400 });
  const admin = createAdminClient();
  if (body.data.colour !== "Surprise me") {
    const { data: colour, error: colourError } = await admin.from("box_colours")
      .select("id")
      .eq("name", body.data.colour)
      .eq("active", true)
      .maybeSingle();
    if (colourError) return Response.json({ error: "Could not validate the selected box colour." }, { status: 500 });
    if (!colour) return Response.json({ error: "That box colour is no longer available. Please choose another." }, { status: 400 });
  }
  const ids = [...new Set(body.data.items.map(item => item.productId))];
  const { data: products, error } = await admin.from("products").select("id,name,price,stock,available,archived").in("id", ids);
  if (error) return Response.json({ error: "Could not validate hamper items." }, { status: 500 });
  const byId = new Map((products ?? []).map(product => [product.id, product]));
  let total = 0;
  for (const item of body.data.items) {
    const product = byId.get(item.productId);
    if (!product || !product.available || product.archived || product.stock < item.quantity) return Response.json({ error: "A selected gift is unavailable or has insufficient stock." }, { status: 409 });
    total += Number(product.price) * item.quantity;
  }
  const { data: { user } } = await (await createClient()).auth.getUser();
  const payload = body.data;
  if (user) {
    const { error: customerError } = await admin.from("customers").upsert({ id: user.id, full_name: user.email ?? payload.recipient, email: user.email ?? null });
    if (customerError) return Response.json({ error: "Unable to save customer details." }, { status: 500 });
  }
  const { error: saveError } = await admin.from("custom_enquiries").insert({
    customer_id: user?.id ?? null,
    recipient_name: payload.recipient, occasion: payload.occasion, box_colour: payload.colour,
    personal_message: payload.note || null, special_instructions: payload.instructions || null,
    selected_items: payload.items.map(item => {
      const product = byId.get(item.productId)!;
      return { productId: product.id, name: product.name, quantity: item.quantity, unitPrice: Number(product.price) };
    }),
    estimated_total: Math.round(total * 100) / 100,
  });
  if (saveError) return Response.json({ error: "Unable to save your custom hamper enquiry." }, { status: 500 });
  return Response.json({ saved: true }, { status: 201 });
}
