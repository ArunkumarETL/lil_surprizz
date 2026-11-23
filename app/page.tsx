import { CatalogBrowser } from "@/components/catalog-browser";
import { getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts();
  return <main>
    <div className="page-head"><div className="wrap"><span className="eyebrow">Find your perfect surprise</span><h1 style={{ fontSize: 44, margin: "9px 0" }}>All products</h1><p>Browse every available gift in one place.</p></div></div>
    <section className="section wrap"><CatalogBrowser products={products} /></section>
  </main>;
}
