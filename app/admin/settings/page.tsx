import { createAdminClient } from "@/lib/supabase/admin";
import { AdminSettingsForm } from "@/components/admin-settings-form";
import type { StoreSettings } from "@/lib/types";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  await requireAdminPage();
  const { data, error } = await createAdminClient().from("store_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Unable to load store settings: ${error.message}`);
  const settings: StoreSettings = { brand_name: data?.brand_name ?? "LILSURPRIZ", logo_url: data?.logo_url ?? null, whatsapp_number: data?.whatsapp_number ?? "", contact_email: data?.contact_email ?? "", instagram_url: data?.instagram_url ?? "", shipping_charge: Number(data?.shipping_charge ?? 60), free_shipping_threshold: Number(data?.free_shipping_threshold ?? 999), announcement: data?.announcement ?? "Little gifts, big surprises.", social_links: data?.social_links ?? {} };
  return <><span className="eyebrow">Your store, your way</span><h1 style={{ fontSize: 38 }}>Website settings</h1><AdminSettingsForm settings={settings} /></>;
}
