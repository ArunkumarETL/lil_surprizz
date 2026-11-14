import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { createClient } from "@/lib/supabase/server";
import { getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: category, error } = await supabase.from("categories").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (error) throw new Error(`Unable to load collection: ${error.message}`);
  if (!category) notFound();
  const products = await getProducts({ category: slug });
  return <main><div className="page-head"><div className="wrap"><span className="eyebrow">Curated with love</span><h1 style={{ fontSize: 44, margin: "9px 0" }}>{category.name}</h1><p>{category.description || "Little gifts that say a lot."}</p></div></div><section className="section wrap">{products.length ? <div className="grid">{products.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="banner"><h2>Coming soon</h2><p>We’re putting together something lovely for this collection.</p></div>}</section></main>;
}
