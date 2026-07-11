import type { Metadata, Viewport } from "next";
import "./globals.css";
import IdleLogoutGuard from "@/components/IdleLogoutGuard";

export const metadata: Metadata = {
  title: "발주 시스템",
  description: "뼈다귀연구소 / 돈골 사골순대국밥 식자재 발주 웹앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <IdleLogoutGuard />
      </body>
    </html>
  );
}
