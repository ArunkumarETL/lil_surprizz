import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(100), description: z.string().max(1000), image_url: z.string().url().nullable(), active: z.boolean() });
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function POST(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please enter a valid category name." }, { status: 400 });
  const { id: _id, ...data } = parsed.data;
  const { error } = await createAdminClient().from("categories").insert({ ...data, slug: slugify(data.name) });
  if (error) return Response.json({ error: error.code === "23505" ? "A category with this name already exists." : "Unable to save category." }, { status: 400 });
  return Response.json({ saved: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const parsed = schema.extend({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please enter a valid category." }, { status: 400 });
  const { id, ...data } = parsed.data;
  const { error } = await createAdminClient().from("categories").update({ ...data, slug: slugify(data.name) }).eq("id", id);
  if (error) return Response.json({ error: error.code === "23505" ? "A category with this name already exists." : "Unable to update category." }, { status: 400 });
  return Response.json({ saved: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid category." }, { status: 400 });
  const { error } = await createAdminClient().from("categories").update({ active: false }).eq("id", id);
  if (error) return Response.json({ error: "Unable to deactivate category." }, { status: 500 });
  return Response.json({ saved: true });
}
