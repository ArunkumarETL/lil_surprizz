import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts({ featured: true, limit: 4 });
  return <main>
    <section className="hero"><div className="wrap hero-inner">
      <div className="hero-copy"><span className="eyebrow">A little joy, wrapped up</span><h1>Make their day<br />a little more <em>magical.</em></h1>
        <p>Thoughtful gift hampers for your favourite people, made personal and delivered with love.</p><Link className="btn btn-pink" href="/shop">Find the perfect gift &nbsp;→</Link></div>
      <div className="hero-art" aria-label="Gift hamper illustration"><span className="sparkle one">✦</span><div className="giftbox">🎁</div><span className="sparkle two">✧</span></div>
    </div></section>
    <section className="section" style={{ background: "#fffafd" }}><div className="wrap"><div className="section-head"><div><span className="eyebrow">A few lovely picks</span><h2>Explore our gifts</h2></div><Link className="text-link" href="/shop">Browse all gifts →</Link></div>
      {products.length ? <div className="grid">{products.map(product => <ProductCard key={product.id} product={product} />)}</div> : <p className="muted">No featured gifts just yet. Check back soon or browse the full shop.</p>}
    </div></section>
    <section className="section wrap"><div className="banner"><span className="eyebrow">Your gift, your way</span><h2>Dream it. We’ll wrap it.</h2><p>Choose the little things they love, add your own note, and create a hamper that feels like them.</p><Link className="btn" href="/customise">Build your surprise</Link></div></section>
  </main>;
}
