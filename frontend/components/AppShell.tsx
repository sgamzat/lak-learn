"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { AuthGuard } from "./AuthGuard";
import { NavBar } from "./NavBar";


const publicRoutes = ["/login", "/register"];


export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = publicRoutes.includes(pathname);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <AuthGuard>
      {!isPublic ? <NavBar /> : null}
      {children}
    </AuthGuard>
  );
}

