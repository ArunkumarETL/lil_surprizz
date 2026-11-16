import { CustomBuilder } from "@/components/custom-builder";
import { getProducts, getStoreSettings } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export default async function CustomisePage() {
  const [products, settings] = await Promise.all([getProducts(), getStoreSettings()]);
  const { data: colours, error } = await createAdminClient()
    .from("box_colours")
    .select("id,name,active,sort_order")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`Unable to load box colours: ${error.message}`);
  return <main><div className="page-head"><div className="wrap"><span className="eyebrow">A surprise made by you</span><h1 style={{ fontSize: 44, margin: "9px 0" }}>Customise your surprise</h1><p>Choose their favourite things and add a note from you.</p></div></div>
    <section className="section wrap"><CustomBuilder products={products.filter(p => p.stock > 0)} whatsapp={settings.whatsapp_number} colours={(colours ?? []).map(colour => colour.name)} /></section></main>;
}
