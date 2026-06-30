// src/types/product.ts

export type Product = {
  id: string;
  slug: string;
  title: string;
  shortDescription?: string;
  description?: string;
  category?: string;
  price: number;
  image?: string;
  images?: string[];
  stock?: number;
  featured?: boolean;
  active?: boolean;
};