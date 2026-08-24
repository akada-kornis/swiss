import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prime Communes",
  description: "Observatoire du marché communal suisse par Prime technologies.",
  icons: {
    icon: "/favicon-prime-communes.svg",
    shortcut: "/favicon-prime-communes.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
