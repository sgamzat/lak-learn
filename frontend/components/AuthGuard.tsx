"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { getToken } from "../lib/auth";


const publicRoutes = ["/login", "/register"];


export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const isPublic = publicRoutes.includes(pathname);

    if (!token && !isPublic) {
      router.replace("/login");
    }
    if (token && isPublic) {
      router.replace("/");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
