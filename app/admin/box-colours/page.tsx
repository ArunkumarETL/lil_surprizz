import { AdminBoxColourManager } from "@/components/admin-box-colour-manager";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BoxColour } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminBoxColoursPage() {
  await requireAdminPage();
  const { data, error } = await createAdminClient().from("box_colours").select("*").order("sort_order").order("name");
  if (error) throw new Error(`Unable to load box colours: ${error.message}`);
  return <><span className="eyebrow">Personalise each surprise</span><h1 style={{ fontSize: 38 }}>Box colours</h1><p className="muted">Active colours appear in the customer gift builder. “Surprise me” is always available.</p><AdminBoxColourManager colours={(data ?? []) as BoxColour[]} /></>;
}
