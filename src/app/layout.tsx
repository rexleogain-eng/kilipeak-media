import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KiliPeak Media",
  description:
    "Private media management system for the KiliPeak website.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
