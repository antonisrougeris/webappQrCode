import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skanare | QR Clothing & Accessories",
  description:
    "Skanare creates QR clothing and accessories that connect your style with your digital identity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Header />
        {children}
        <Footer />
        <CartDrawer />
      </body>
    </html>
  );
}