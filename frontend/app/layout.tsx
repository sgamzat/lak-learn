import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "../components/AppShell";


export const metadata: Metadata = {
  title: "Lak Learn",
  description: "Приложение для изучения лакского языка",
  manifest: "/manifest.json",
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
