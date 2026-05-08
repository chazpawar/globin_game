import type { Metadata } from "next";
import ConvexClientProvider from "@/components/convex-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goblintown",
  description: "Goblintown",
  icons: {
    icon: "/l3Lw_RQK_400x400.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
