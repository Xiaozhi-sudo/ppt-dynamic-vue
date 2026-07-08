import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YiCe AI PPT Generator",
  description: "Template-driven PPT generation MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
