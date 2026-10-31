// Скриншоты главной страницы: новичок и ученик после урока и повторений
const { chromium } = require("playwright");
const fs = require("fs");
const base = "http://localhost:3000";
fs.mkdirSync("shots", { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async (w, h, mode, seen) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: "ru-RU" });
    await ctx.addInitScript(([mode, seen]) => {
      try { localStorage.setItem("laklearn-theme-mode", mode); localStorage.setItem("lk-mode", mode); if (seen) localStorage.setItem("laklearn_onboarding_done", "1"); } catch {}
    }, [mode, seen]);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    return { ctx, p };
  };
  const login = async (p, email) => {
    let r = await p.request.post(base + "/api/auth/register", { data: { email, password: "Shots-Pass-123456", displayName: "Амина" } });
    if (r.status() >= 400) r = await p.request.post(base + "/api/auth/login", { data: { email, password: "Shots-Pass-123456" } });
    console.log(email, r.status());
  };
  const shot = async (p, name, full = true) => {
    await p.goto(base + "/dashboard"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(800);
    await p.screenshot({ path: `shots/${name}.png`, fullPage: full });
  };

  // 1. Новичок: с онбордингом и без
  for (const [w, h, tag] of [[390, 844, "m"], [1280, 900, "d"]]) {
    const a = await mk(w, h, "dark", false); await login(a.p, "new@example.com"); await shot(a.p, `01-new-onboarding-${tag}`, false); await a.ctx.close();
    const b = await mk(w, h, "dark", true); await login(b.p, "new@example.com"); await shot(b.p, `02-new-${tag}`); await b.ctx.close();
  }

  // 2. Ученик: прошёл урок 1, ответил на часть карточек
  const s = await mk(390, 844, "dark", true);
  await login(s.p, "student@example.com");
  console.log("lesson", (await s.p.request.post(base + "/api/lessons/1/progress", { data: { completed: true, score: 80 } })).status());
  await s.p.request.post(base + "/api/lessons/2/progress", { data: { step: 5 } });
  const q = await (await s.p.request.get(base + "/api/srs/queue")).json();
  const cards = q.queue ?? [];
  console.log("queue", cards.length);
  for (const [i, c] of cards.slice(0, 8).entries()) {
    await s.p.request.post(base + "/api/srs/review", { data: { wordId: c.id, rating: i % 4 === 3 ? "forgot" : "know", exercise: "flashcard", timeZone: "Europe/Moscow" } });
  }
  await shot(s.p, "03-student-m");
  await s.ctx.close();
  const d = await mk(1280, 900, "dark", true); await login(d.p, "student@example.com"); await shot(d.p, "04-student-d"); await d.ctx.close();
  const l = await mk(390, 844, "light", true); await login(l.p, "student@example.com"); await shot(l.p, "05-student-light-m"); await l.ctx.close();

  fs.writeFileSync("shots/errors.txt", errors.join("\n"));
  console.log("errors:", errors.length);
  await browser.close();
})();
