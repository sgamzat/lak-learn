// Скриншоты мобильного интерфейса уроков (390×844)
const { chromium } = require("playwright");
const fs = require("fs");
const base = "http://localhost:3000";
fs.mkdirSync("shots", { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", locale: "ru-RU" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `shots/${name}.png` }); };

  const reg = await page.request.post(base + "/api/auth/register", {
    data: { email: "shots@example.com", password: "Shots-Pass-123456", displayName: "Амина" }
  });
  console.log("register", reg.status());

  await page.goto(base + "/dashboard"); await page.waitForLoadState("networkidle"); await shot("00-dashboard");
  await page.goto(base + "/lessons"); await page.waitForLoadState("networkidle"); await shot("01-lessons");

  for (const n of [1, 9]) {
    await page.goto(`${base}/lessons/${n}`); await page.waitForLoadState("networkidle");
    for (let i = 0; i < 80; i += 1) {
      const tag = `l${n}-${String(i).padStart(2, "0")}`;
      await shot(tag);
      if (await page.getByText(/пройден$/).count()) { await page.waitForTimeout(1200); await shot(tag + "-final"); break; }

      const options = page.locator('[aria-label="Варианты ответа"] button:not([disabled])');
      if (await options.count()) { await options.nth(i % 2).click(); await shot(tag + "-a"); }

      const box = page.locator('[aria-label="Ваш ответ"]');
      if (await box.count()) {
        const toks = box.locator("xpath=following-sibling::div[1]").locator("button:not([disabled])");
        let guard = 0;
        while ((await toks.count()) > 0 && guard++ < 20) await toks.first().click();
        await shot(tag + "-b");
        await page.getByRole("button", { name: "Проверить" }).click();
        await shot(tag + "-a");
      }

      if (await page.getByText("Найдите пары").count()) {
        const cols = page.locator(".grid.grid-cols-2 > div");
        const left = cols.nth(0).locator("button");
        const right = cols.nth(1).locator("button");
        const nL = await left.count();
        for (let k = 0; k < nL; k += 1) {
          for (let r = 0; r < (await right.count()); r += 1) {
            if (await left.nth(k).isDisabled()) break;
            await left.nth(k).click();
            if (await right.nth(r).isDisabled()) continue;
            await right.nth(r).click();
            await page.waitForTimeout(80);
          }
          if (k === 1) await shot(tag + "-m");
        }
        await shot(tag + "-a");
      }

      const bottom = page.locator("div.border-t.border-lk-line.bg-lk-navy2 button").last();
      let guard = 0;
      // Диалог: «Следующая реплика», пока не кончатся реплики
      while ((await bottom.textContent())?.includes("реплика") && guard++ < 30) await bottom.click();
      if (guard) await shot(tag + "-d");
      if (await bottom.isDisabled()) { console.log("stuck at", tag); break; }
      await bottom.click();
      if (n === 9 && i >= 6) break;
    }
  }

  await page.goto(base + "/dashboard"); await page.waitForLoadState("networkidle"); await shot("90-dashboard-after");
  await page.goto(base + "/lessons"); await page.waitForLoadState("networkidle"); await shot("91-lessons-after");
  await page.goto(base + "/review"); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500); await shot("92-review");

  fs.writeFileSync("shots/errors.txt", errors.join("\n"));
  console.log("errors:", errors.length);
  await browser.close();
})();
