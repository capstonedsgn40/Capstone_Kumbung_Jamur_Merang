import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mist Control — Kumbung Jamur",
  description:
    "Dashboard pemantauan dan kontrol mist nozzle berbasis Arduino Cloud",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
