const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const baseUrl = (process.argv[2] || "http://127.0.0.1:8766/").replace(/\/?$/, "/");
const outputDirectory = path.resolve(__dirname, "../test-artifacts/calendar-dedup");
const widths = [320, 360, 375, 390, 393, 412, 430, 1440];

fs.mkdirSync(outputDirectory, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const failures = [];

  try {
    for (const width of widths) {
      const page = await browser.newPage({
        viewport: { width, height: width === 1440 ? 1000 : 844 },
        deviceScaleFactor: 1,
      });

      await page.addInitScript(() => {
        window.yuukichiyaCalendarBaseDate = "2026-08-01";
      });
      await page.goto(`${baseUrl}index.html`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => (
        [...document.querySelectorAll("[data-store-calendar]")]
          .every((target) => target.dataset.calendarSource === "public-api")
      ));

      const metrics = await page.evaluate(() => {
        const stores = [...document.querySelectorAll("[data-store-calendar]")].map((target) => {
          const august = [...target.querySelectorAll(".shop-month-calendar")]
            .find((calendar) => calendar.querySelector("h4")?.textContent === "2026年8月");
          const days = [...(august?.querySelectorAll("button.shop-month-calendar__day") || [])].map((day) => ({
            day: day.querySelector(".shop-month-calendar__day-number")?.textContent || "",
            labels: [...day.querySelectorAll(".shop-month-calendar__event")]
              .map((label) => label.textContent.trim()),
            more: day.querySelector(".shop-month-calendar__event-more")?.textContent || "",
          }));
          return { store: target.dataset.storeCalendar, days };
        });

        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          stores,
        };
      });

      if (metrics.overflow) failures.push({ width, reason: "document overflow", metrics });
      for (const store of metrics.stores) {
        for (const day of store.days) {
          if (day.labels.length !== new Set(day.labels).size) {
            failures.push({ width, reason: "duplicate calendar label", store: store.store, day });
          }
          if (day.more) {
            failures.push({ width, reason: "unexpected hidden duplicate event", store: store.store, day });
          }
        }
      }

      const mainAugust4 = metrics.stores
        .find((store) => store.store === "main")?.days.find((day) => day.day === "4");
      const mainAugust7 = metrics.stores
        .find((store) => store.store === "main")?.days.find((day) => day.day === "7");
      const mainAugust11 = metrics.stores
        .find((store) => store.store === "main")?.days.find((day) => day.day === "11");
      const takahashiAugust10 = metrics.stores
        .find((store) => store.store === "takahashi")?.days.find((day) => day.day === "10");
      if (mainAugust4?.labels.join("|") !== "休業日") {
        failures.push({ width, reason: "August 4 closure was not deduped", mainAugust4 });
      }
      if (mainAugust7?.labels.join("|") !== "夏季休業") {
        failures.push({ width, reason: "August 7 summer closure was not deduped", mainAugust7 });
      }
      if (mainAugust11?.labels.join("|") !== "休業日") {
        failures.push({ width, reason: "Main store August 11 fallback overlap remained", mainAugust11 });
      }
      if (takahashiAugust10?.labels.join("|") !== "休業日") {
        failures.push({ width, reason: "Takahashi store August 10 fallback overlap remained", takahashiAugust10 });
      }

      if (width === 390 || width === 1440) {
        await page.locator(".home-calendar-column").screenshot({
          path: path.join(outputDirectory, `calendar-${width}.png`),
        });
      }

      process.stdout.write(`${width}px stores=${metrics.stores.length} overflow=${metrics.overflow}\n`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    process.stderr.write(`${JSON.stringify(failures, null, 2)}\n`);
    process.exitCode = 1;
  }
  process.stdout.write(`${failures.length ? "FAIL" : "PASS"} calendar dedup QA\n`);
})();
