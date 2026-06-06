import type { Metadata } from "next";
import { Spectral, Golos_Text, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// ── Шрифты загружаются на сервере, без мигания при загрузке страницы ─────────
const spectral = Spectral({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-spectral",
  display: "swap",
});

const golosText = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-golos",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lak Learn",
  description: "Личный кабинет и SRS-повторение для изучения лакского языка",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${spectral.variable} ${golosText.variable} ${ibmPlexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}