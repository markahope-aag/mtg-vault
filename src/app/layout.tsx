import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "mana-font/css/mana.css";
import "keyrune/css/keyrune.css";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MTG Vault",
  description:
    "Personal Magic: The Gathering inventory and Commander deckbuilding tool.",
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
      className={`${display.variable} ${body.variable} ${mono.variable} ${theme === "light" ? "light" : ""} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
