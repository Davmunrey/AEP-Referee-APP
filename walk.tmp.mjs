import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.emulateMedia({ media: "print" });
await page.goto("file:///tmp/claude-0/-home-user-AEP-Referee-APP/f0caaebc-da66-5861-8591-8984a4741dfe/scratchpad/q.html", { waitUntil: "load" });
await page.waitForTimeout(500);
const m = await page.evaluate(() => {
  const doc = document.documentElement;
  const tablas = [...document.querySelectorAll("table")].map((t) => ({
    w: Math.round(t.getBoundingClientRect().width),
    cols: t.querySelector("tr")?.children.length ?? 0,
  }));
  return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, alto: doc.scrollHeight, tablas };
});
console.log("A4 portrait 794px →", JSON.stringify(m));
const pdf = await page.pdf({ format: "A4", printBackground: true });
console.log("PDF generado:", pdf.length, "bytes");
await browser.close();
