import type { MetadataRoute } from "next";

// PWA manifest. Served at /manifest.webmanifest by Next's typed metadata
// route. Icons reference the existing SVG mark; modern Safari/Chrome handle
// SVG in manifests, and we keep the apple-icon.svg fallback wired in the
// root layout for iOS home-screen tiles.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MTG Vault",
    short_name: "Vault",
    description:
      "Personal Magic: The Gathering inventory and Commander deckbuilding tool.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1c1d22",
    theme_color: "#1c1d22",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    categories: ["productivity", "utilities"],
  };
}
