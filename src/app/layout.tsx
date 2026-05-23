import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "mana-font/css/mana.css";
import "keyrune/css/keyrune.css";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

// Rename the loader variables so they do NOT collide with the theme tokens
// of the same name in globals.css. Previously --font-display referenced
// itself via @theme inline, which collapsed the family to serif fallback.
const display = Space_Grotesk({
  variable: "--font-display-loaded",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const body = Inter({
  variable: "--font-body-loaded",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-loaded",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MTG Vault",
  description:
    "Personal Magic: The Gathering inventory and Commander deckbuilding tool.",
  applicationName: "MTG Vault",
  appleWebApp: {
    capable: true,
    title: "MTG Vault",
    statusBarStyle: "black-translucent",
  },
  // Linking the manifest here lets Next's typed metadata pipeline emit the
  // <link rel="manifest"> without us hand-rolling it.
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1c1d22" },
    { media: "(prefers-color-scheme: light)", color: "#f5f4f0" },
  ],
  // Prevent the iOS double-tap zoom on form inputs so the deckbuilder feels
  // native when installed. Users can still pinch-zoom.
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  // Read the v2 cookie so prior "theme=light" sticky-toggle preferences from
  // the previous design system don't carry through. Dark is unequivocally the
  // default unless the user has explicitly opted into light in the new system.
  const theme =
    cookieStore.get("mtgv-theme")?.value === "light" ? "light" : "dark";
  return (
    <html
      lang="en"
      data-theme={theme}
      // Inline color-scheme + background so the browser paints dark BEFORE
      // any CSS loads — eliminates the white flash when navigating to a new
      // tab (target="_blank" links). The CSS overrides this once it lands.
      style={{
        colorScheme: theme === "light" ? "light" : "dark",
        backgroundColor: theme === "light" ? "#f5f4f0" : "#1c1d22",
      }}
      className={`${display.variable} ${body.variable} ${mono.variable} ${theme === "light" ? "light" : ""} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
