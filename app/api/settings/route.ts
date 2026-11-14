import { getStoreSettings } from "@/lib/catalog";

export async function GET() {
  const settings = await getStoreSettings();
  return Response.json(settings, { headers: { "Cache-Control": "no-store" } });
}
