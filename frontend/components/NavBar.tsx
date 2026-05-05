"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearTokens } from "../lib/auth";


const links = [
  { href: "/", label: "Dashboard" },
  { href: "/study", label: "Study" },
  { href: "/dictionary", label: "Dictionary" },
  { href: "/admin/import", label: "Admin Import" },
  { href: "/profile", label: "Profile" },
];


export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-b border-slate-800 bg-slate-950/80">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold">Lak Learn</span>
          <div className="hidden gap-2 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded px-3 py-1 text-sm ${
                  pathname === link.href ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <button
          className="rounded bg-slate-800 px-3 py-1 text-sm text-slate-100 hover:bg-slate-700"
          onClick={() => {
            clearTokens();
            router.push("/login");
          }}
        >
          Logout
        </button>
      </nav>
    </header>
  );
}
