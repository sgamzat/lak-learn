import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lak Learn",
  description: "Личный кабинет и SRS-повторение для изучения лакского языка"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

