export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
};

export type ProductImage = { id: string; image_url: string; alt_text: string | null; position: number };

export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  category_id: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  features: string[];
  hamper_items: string[];
  size: string | null;
  weight_grams: number | null;
  available: boolean;
  featured: boolean;
  new_arrival: boolean;
  customizable: boolean;
  archived: boolean;
  category?: Category | null;
  product_images?: ProductImage[];
};

export type StoreSettings = {
  brand_name: string;
  logo_url: string | null;
  whatsapp_number: string;
  contact_email: string;
  instagram_url: string;
  shipping_charge: number;
  free_shipping_threshold: number;
  announcement: string;
  social_links: Record<string, string>;
};
