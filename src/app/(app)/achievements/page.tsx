"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const T = {
  ink:   "#0E1B2E", navy: "#13243B", navy2: "#1A2E49",
  line:  "rgba(212,165,55,0.16)", gold: "#D4A537",
  text:  "#F4EFE6", textMut: "#9DB0C7", textFaint: "#5E728C",
  serif: "'Spectral', Georgia, serif",
  sans:  "'Golos Text', system-ui, sans-serif",
};

export default function AchievementsPage() {
  return (
    <div style={{ minHeight: "100vh", background: T.ink, fontFamily: T.sans, color: T.text }}>
      <div style={{ background: "rgba(14,27,46,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.line}`, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px", height: 52, display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 6, color: T.textMut, textDecoration: "none", fontSize: 13 }}>
            <ArrowLeft size={15} /> Главная
          </Link>
          <span style={{ color: T.textFaint }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Достижения</span>
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 20px", textAlign: "center" as const }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Достижения</div>
        <div style={{ fontSize: 14, color: T.textMut }}>Раздел в разработке. Возвращайтесь позже!</div>
      </div>
    </div>
  );
}