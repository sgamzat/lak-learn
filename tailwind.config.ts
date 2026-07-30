import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        lk: {
          bg: "var(--lk-bg)",
          navy: "var(--lk-navy)",
          navy2: "var(--lk-navy2)",
          navy3: "var(--lk-navy3)",
          card: "var(--lk-card)",
          card2: "var(--lk-card2)",
          card3: "var(--lk-card3)",
          line: "var(--lk-line)",
          "line-cool": "var(--lk-line-cool)",
          gold: "var(--lk-gold)",
          "gold-hi": "var(--lk-gold-hi)",
          "gold-dim": "var(--lk-gold-dim)",
          "gold-border": "var(--lk-gold-border)",
          text: "var(--lk-text)",
          muted: "var(--lk-text-muted)",
          faint: "var(--lk-text-faint)",
          green: "var(--lk-green)",
          "green-dim": "var(--lk-green-dim)",
          blue: "var(--lk-blue)",
          red: "var(--lk-red)",
          "red-dim": "var(--lk-red-dim)",
          snow: "var(--lk-snow)"
        }
      },
      fontFamily: {
        serif: ["var(--lk-font-serif)", "Georgia", "serif"],
        sans: ["var(--lk-font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--lk-font-mono)", "ui-monospace", "monospace"]
      },
      boxShadow: {
        lk: "var(--lk-shadow)"
      }
    }
  },
  plugins: []
};

export default config;
