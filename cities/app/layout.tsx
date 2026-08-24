import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prime Communes",
  description: "Observatoire du marché communal suisse par Prime technologies.",
  
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
icons: {
    icon: "/favicon-prime-communes.png",
    shortcut: "/favicon-prime-communes.png",
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
