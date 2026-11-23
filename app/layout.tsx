import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kumbung Jamur Merang | Sistem Monitoring IoT",
  description:
    "Dashboard monitoring real-time suhu, kelembapan, dan pengkabutan otomatis Kumbung Jamur Merang berbasis ESP32 dan EMQX.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
