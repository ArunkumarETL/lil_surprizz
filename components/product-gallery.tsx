"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductImage } from "@/lib/types";

export function ProductGallery({ name, images }: { name: string; images: ProductImage[] }) {
  const [selected, setSelected] = useState(images[0]);
  const [lightboxImage, setLightboxImage] = useState<ProductImage | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (lightboxImage && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [lightboxImage]);

  function closeLightbox() {
    if (dialogRef.current?.open) dialogRef.current.close();
    else setLightboxImage(null);
  }

  return <>
    <div>
      <div className="gallery-main">{selected
        ? <button className="gallery-image-button" type="button" aria-label={`View full-size image of ${selected.alt_text ?? name}`} onClick={() => setLightboxImage(selected)}><img src={selected.image_url} alt={selected.alt_text ?? name} /></button>
        : <span className="product-placeholder">🎁</span>}
      </div>
      {images.length > 1 && <div className="thumbs">{images.map(img => <button key={img.id} type="button" aria-label={`View ${img.alt_text ?? name}`} onClick={() => setSelected(img)} style={{ border: selected?.id === img.id ? "2px solid var(--pink-dark)" : "2px solid transparent", padding: 0, borderRadius: 10, background: "none" }}><img src={img.image_url} alt={img.alt_text ?? name} /></button>)}</div>}
    </div>
    {lightboxImage && <dialog
      ref={dialogRef}
      className="product-lightbox"
      aria-label={`Full-size image of ${name}`}
      onClose={() => setLightboxImage(null)}
      onClick={event => { if (event.target === dialogRef.current) closeLightbox(); }}
    >
      <div className="product-lightbox-content">
        <button className="product-lightbox-close" type="button" aria-label="Close full-size image" onClick={closeLightbox}>×</button>
        <img src={lightboxImage.image_url} alt={lightboxImage.alt_text ?? name} />
      </div>
    </dialog>}
  </>;
}
