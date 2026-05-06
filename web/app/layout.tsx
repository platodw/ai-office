import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Office",
  description: "Set up Claude the right way — guided, connected, and built around your workflow.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
