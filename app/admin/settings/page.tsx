import { createAdminClient } from "@/lib/supabase/admin";
import { AdminSettingsForm } from "@/components/admin-settings-form";
import type { StoreSettings } from "@/lib/types";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  await requireAdminPage();
  const { data, error } = await createAdminClient().from("store_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Unable to load store settings: ${error.message}`);
  const settings: StoreSettings = { brand_name: data?.brand_name ?? "LILSURPRIZ", logo_url: data?.logo_url ?? null, business_phone: data?.business_phone ?? "9585664547", business_address: data?.business_address ?? "41/A Rajiv Gandhi street, Pallikaranai, Chennai", whatsapp_number: data?.whatsapp_number ?? "9585664547", contact_email: data?.contact_email ?? "lilsurpriz@gmail.com", instagram_url: data?.instagram_url ?? "", shipping_charge: Number(data?.shipping_charge ?? 60), free_shipping_threshold: Number(data?.free_shipping_threshold ?? 999), upi_id: data?.upi_id ?? "", upi_qr_url: data?.upi_qr_url ?? null, announcement: data?.announcement ?? "Little gifts, big surprises.", social_links: data?.social_links ?? {} };
  return <><span className="eyebrow">Your store, your way</span><h1 style={{ fontSize: 38 }}>Website settings</h1><AdminSettingsForm settings={settings} /></>;
}
