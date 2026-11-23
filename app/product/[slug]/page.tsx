import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/catalog";
import { ProductActions } from "@/components/product-actions";
import { ProductGallery } from "@/components/product-gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return product ? { title: product.name, description: product.description.slice(0, 155), openGraph: { title: product.name, description: product.description.slice(0, 155), images: product.product_images?.[0]?.image_url ? [product.product_images[0].image_url] : [] } } : { title: "Gift not found" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const images = product.product_images?.sort((a, b) => a.position - b.position) ?? [];
  return <main className="wrap product-detail">
    <ProductGallery name={product.name} images={images} />
    <div className="details"><h1 style={{ fontSize: 40, margin: "10px 0" }}>{product.name}</h1>
      <div className="price">₹{product.price.toLocaleString("en-IN")}{product.compare_at_price && product.compare_at_price > product.price ? <span className="old-price">₹{product.compare_at_price.toLocaleString("en-IN")}</span> : null}</div>
      <p style={{ marginTop: 18 }}>{product.description}</p>
      {product.customer_photo_mode === "required" && <p className="notice">At least one customer photo is required at checkout (up to {product.customer_photo_limit}).</p>}
      {product.customer_photo_mode === "optional" && <p className="muted">You can add up to {product.customer_photo_limit} customer photo{product.customer_photo_limit === 1 ? "" : "s"} at checkout.</p>}
      {product.hamper_items.length > 0 && <><h3>Inside your box</h3><ul>{product.hamper_items.map(item => <li key={item}>{item}</li>)}</ul></>}
      {product.features.length > 0 && <ul>{product.features.map(item => <li key={item}>{item}</li>)}</ul>}
      <ProductActions product={product} />
      {product.size && <p className="muted" style={{ marginTop: 20 }}>Size: {product.size}{product.weight_grams ? ` · ${product.weight_grams} g` : ""}</p>}
    </div>
  </main>;
}
