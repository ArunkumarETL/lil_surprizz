import type { Metadata } from "next";
import { ProductCard } from "@/components/product-card";
import { getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shop all gifts", description: "Explore personalised gift boxes and ready-made hampers from LILSURPRIZ." };

export default async function ShopPage() {
  const products = await getProducts();
  return <main><div className="page-head"><div className="wrap"><span className="eyebrow">Find your perfect surprise</span><h1 style={{ fontSize: 44, margin: "9px 0" }}>Shop all gifts</h1><p>Little joys for birthdays, besties, and just-because days.</p></div></div>
    <section className="section wrap">{products.length ? <div className="grid">{products.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="banner"><h2>The shelves are waiting ✨</h2><p>Our gift collection is being curated. Please check back soon.</p></div>}</section></main>;
}
