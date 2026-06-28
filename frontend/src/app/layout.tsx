import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERP-AI — ระบบจัดการและโพสต์อัตโนมัติด้วย AI สำหรับ SMEs",
  description: "แพลตฟอร์มการตลาดอัจฉริยะ เชื่อมต่อ Facebook Page และ LINE มุ่งเน้นการจัดการง่าย ปลดล็อกพลัง AI ให้เติบโตอย่างยั่งยืน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`dark ${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
