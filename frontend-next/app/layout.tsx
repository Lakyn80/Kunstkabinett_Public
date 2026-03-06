import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

const ICONS_VERSION = "20260304-1";

export const metadata: Metadata = {
  metadataBase: new URL("https://kunstkabinett.cz"),
  title: "Kunstkabinett",
  description: "Galerie soucasneho umeni v Brne.",
  applicationName: "Kunstkabinett",
  manifest: `/manifest.webmanifest?v=${ICONS_VERSION}`,
  icons: {
    icon: [
      { url: `/kunstkabinett_favicon_32x32.png?v=${ICONS_VERSION}`, sizes: "32x32", type: "image/png" },
      { url: `/kunstkabinett_favicon_48x48.png?v=${ICONS_VERSION}`, sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: `/kunstkabinett_logo_150x150.png?v=${ICONS_VERSION}`, sizes: "150x150", type: "image/png" }],
    shortcut: [`/kunstkabinett_favicon_32x32.png?v=${ICONS_VERSION}`],
  },
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    url: "https://kunstkabinett.cz",
    siteName: "Kunstkabinett",
    title: "Kunstkabinett",
    description: "Galerie soucasneho umeni v Brne.",
    images: [
      {
        url: "/kunstkabinett_hero_image_1200x628.png",
        width: 1200,
        height: 628,
        alt: "Kunstkabinett",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kunstkabinett",
    description: "Galerie soucasneho umeni v Brne.",
    images: ["/kunstkabinett_hero_image_1200x628.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
