"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";

type SortOrder = "newest" | "price-low" | "price-high" | "name";

export function CatalogBrowser({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = products.filter(product =>
      [product.name, product.description, ...product.features, ...product.hamper_items]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );

    if (sortOrder === "newest") return filtered;
    return filtered.sort((a, b) => {
      if (sortOrder === "price-low") return a.price - b.price;
      if (sortOrder === "price-high") return b.price - a.price;
      return a.name.localeCompare(b.name);
    });
  }, [products, search, sortOrder]);

  if (!products.length) {
    return <div className="banner"><h2>The shelves are waiting ✨</h2><p>Our gift collection is being curated. Please check back soon.</p></div>;
  }

  return <>
    <div className="catalog-toolbar">
      <label className="catalog-search">
        <span className="sr-only">Search gifts</span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search gifts and items…" type="search" />
      </label>
      <label className="catalog-sort">
        <span>Sort by</span>
        <select value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)}>
          <option value="newest">Recommended</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="name">Name</option>
        </select>
      </label>
    </div>
    <p className="muted catalog-count" aria-live="polite">{visibleProducts.length} {visibleProducts.length === 1 ? "gift" : "gifts"}</p>
    {visibleProducts.length ? <div className="grid">{visibleProducts.map(product => <ProductCard key={product.id} product={product} />)}</div> : <div className="banner"><h2>No gifts found</h2><p>Try a different search.</p></div>}
  </>;
}
