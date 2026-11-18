import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Social Scheduler",
  description: "Generate AI captions & schedule posts with Google Drive",
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
