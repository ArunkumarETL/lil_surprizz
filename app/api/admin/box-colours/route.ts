import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  active: z.boolean(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a box colour name between 2 and 60 characters." }, { status: 400 });
  const { name, active } = parsed.data;
  const { error } = await createAdminClient().from("box_colours").insert({ name, active });
  if (error) return Response.json({ error: error.code === "23505" ? "That box colour already exists." : "Unable to add box colour." }, { status: error.code === "23505" ? 409 : 500 });
  return Response.json({ saved: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const parsed = schema.extend({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid box colour." }, { status: 400 });
  const { id, name, active } = parsed.data;
  const { error } = await createAdminClient().from("box_colours").update({ name, active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return Response.json({ error: error.code === "23505" ? "That box colour already exists." : "Unable to update box colour." }, { status: error.code === "23505" ? 409 : 500 });
  return Response.json({ saved: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid box colour." }, { status: 400 });
  const { error } = await createAdminClient().from("box_colours")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return Response.json({ error: "Unable to deactivate box colour." }, { status: 500 });
  return Response.json({ saved: true });
}
