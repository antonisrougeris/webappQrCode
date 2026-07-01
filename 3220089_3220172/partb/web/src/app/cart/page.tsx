"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCart,
  removeCartItem,
  updateCartItem,
  type Cart,
  type CartItem,
} from "@/lib/cart";

export default function CartPage() {
  return (
    <main className="container page-content">
      <h1 className="section-title">Your Cart</h1>
      <p className="meta">Open the cart icon to view your cart drawer.</p>
    </main>
  );
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}