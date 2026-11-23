import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monitoring Kumbung Jamur",
  description: "Dashboard monitoring suhu, kelembapan, dan mist nozzle",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
