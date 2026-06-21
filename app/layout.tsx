import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phishing Triage Analyzer",
  description:
    "Paste a suspicious email, message, or URL and get an explainable threat report — every verdict backed by concrete evidence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
