const { chromium } = require("playwright");

const baseUrl = process.argv[2] || "http://127.0.0.1:8765/renewal.html";
const widths = [320, 360, 375, 390, 393, 412, 430, 1440];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const results = [];
  const failures = [];

  try {
    for (const width of widths) {
      const height = width === 1440 ? 1000 : 900;
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const consoleErrors = [];
      const failedRequests = [];

      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("requestfailed", (request) => {
        failedRequests.push(`${request.url()} ${request.failure()?.errorText || "failed"}`);
      });

      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts?.ready);
      await page.evaluate(async () => {
        const pause = () => new Promise((resolve) => setTimeout(resolve, 70));
        const previousScrollBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
          scrollTo(0, y);
          await pause();
        }
        scrollTo(0, 0);
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
      });
      await page.waitForTimeout(300);

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const images = [...document.images]
          .filter((image) => image.getBoundingClientRect().width > 0)
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src);
        const viewportViolations = [...document.querySelectorAll("body *")]
          .filter((element) => {
            const style = getComputedStyle(element);
            if (style.position === "fixed" || style.display === "none" || style.visibility === "hidden") return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 1 && (rect.left < -1 || rect.right > root.clientWidth + 1);
          })
          .slice(0, 12)
          .map((element) => ({
            selector: element.className || element.tagName,
            left: Math.round(element.getBoundingClientRect().left),
            right: Math.round(element.getBoundingClientRect().right),
          }));
        return {
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          images,
          viewportViolations,
          title: document.title,
        };
      });

      const overflow = metrics.scrollWidth > metrics.clientWidth + 1;
      results.push({ width, overflow, ...metrics, consoleErrors, failedRequests });
      if (overflow || metrics.images.length || metrics.viewportViolations.length || consoleErrors.length || failedRequests.length) {
        failures.push(results.at(-1));
      }
      process.stdout.write(
        `${width}px client=${metrics.clientWidth} scroll=${metrics.scrollWidth} `
        + `images=${metrics.images.length} bounds=${metrics.viewportViolations.length} `
        + `console=${consoleErrors.length} requests=${failedRequests.length}\n`,
      );

      if (width === 390 || width === 1440) {
        await page.screenshot({ path: `test-artifacts/renewal-lp-${width}.png`, fullPage: true });
      }
      if (width === 390) {
        await page.locator(".feature--calendar").screenshot({ path: "test-artifacts/renewal-lp-calendar-390.png" });
        await page.locator("#line-demo").screenshot({ path: "test-artifacts/renewal-lp-line-demo-390.png" });
      }

      if (width === 390) {
        const lineHref = await page.locator(".button--line").getAttribute("href");
        const dashboardHref = await page.locator(".button--navy").getAttribute("href");
        if (lineHref !== "https://page.line.me/761hgxky") failures.push({ width, reason: `unexpected LINE URL: ${lineHref}` });
        if (dashboardHref !== "https://kokotomo-sns.bantex.jp/yuukichiya") failures.push({ width, reason: `unexpected dashboard URL: ${dashboardHref}` });
        await page.locator("[data-copy-value]").click();
        await page.locator("[data-copy-status]").filter({ hasText: "コピーしました" }).waitFor();

        await page.locator("[data-lightbox-src]").first().click();
        await page.locator("#screen-lightbox[open]").waitFor();
        await page.screenshot({ path: "test-artifacts/renewal-lp-lightbox-390.png", fullPage: false });
        await page.locator(".lightbox__close").click();
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  process.stdout.write(`${failures.length === 0 ? "PASS" : "FAIL"} renewal LP responsive QA\n`);
  for (const result of results) {
    process.stdout.write(
      `${result.width}px client=${result.clientWidth} scroll=${result.scrollWidth} `
      + `images=${result.images.length} bounds=${result.viewportViolations.length} `
      + `console=${result.consoleErrors.length} requests=${result.failedRequests.length}\n`,
    );
  }
  if (failures.length) process.stdout.write(`${JSON.stringify(failures, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})();
