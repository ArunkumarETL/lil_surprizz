import type { Metadata } from "next";
import { CatalogBrowser } from "@/components/catalog-browser";
import { getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shop all gifts", description: "Explore personalised gift boxes and thoughtful surprises from LILSURPRIZ." };

export default async function ShopPage() {
  const products = await getProducts();
  return <main><div className="page-head"><div className="wrap"><span className="eyebrow">Find your perfect surprise</span><h1 style={{ fontSize: 44, margin: "9px 0" }}>Shop all gifts</h1><p>Explore all our gifts in one place. Search, compare, and open any gift to see all the details.</p></div></div>
    <section className="section wrap"><CatalogBrowser products={products} /></section></main>;
}
