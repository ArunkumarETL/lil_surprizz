import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const body = z.object({ id: z.string().uuid(), status: z.enum(["New", "Contacted", "Completed", "Closed"]) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid enquiry update." }, { status: 400 });
  const { error } = await createAdminClient().from("custom_enquiries").update({ status: body.data.status }).eq("id", body.data.id);
  if (error) return Response.json({ error: "Unable to update enquiry." }, { status: 500 });
  return Response.json({ saved: true });
}
