import Link from "next/link";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const image = product.product_images?.sort((a, b) => a.position - b.position)[0]?.image_url;
  return <Link className="card" href={`/product/${product.slug}`}>
    <div className="product-image">{image ? <img src={image} alt={product.name} loading="lazy" /> : <span className="product-placeholder">🎁</span>}</div>
    <div className="card-info">{product.new_arrival && <span className="pill">NEW ARRIVAL</span>}<h3 style={{ marginTop: product.new_arrival ? 9 : 0 }}>{product.name}</h3>
      <p className="product-card-description">{product.description}</p>
      <div className="price">₹{product.price.toLocaleString("en-IN")}{product.compare_at_price && product.compare_at_price > product.price ? <span className="old-price">₹{product.compare_at_price.toLocaleString("en-IN")}</span> : null}</div>
      <span className="product-card-link">Explore product →</span>
    </div>
  </Link>;
}
