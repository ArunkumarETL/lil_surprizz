"use client";

import { useState } from "react";
import type { ProductImage } from "@/lib/types";

export function ProductGallery({ name, images }: { name: string; images: ProductImage[] }) {
  const [selected, setSelected] = useState(images[0]);
  return <div><div className="gallery-main">{selected ? <img src={selected.image_url} alt={selected.alt_text ?? name} /> : <span className="product-placeholder">🎁</span>}</div>
    {images.length > 1 && <div className="thumbs">{images.map(img => <button key={img.id} type="button" aria-label={`View ${img.alt_text ?? name}`} onClick={() => setSelected(img)} style={{ border: selected?.id === img.id ? "2px solid var(--pink-dark)" : "2px solid transparent", padding: 0, borderRadius: 10, background: "none" }}><img src={img.image_url} alt={img.alt_text ?? name} /></button>)}</div>}
  </div>;
}
