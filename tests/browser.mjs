import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createApp } from "../server.mjs";
const server = createApp({ dbPath: ":memory:" });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
await mkdir("test-results", { recursive: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  for (const lang of ["en", "es"])
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/${lang}/`);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator("h1").count(), 1);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${lang} ${width} horizontal overflow`,
      );
      if (width === 1440 || width === 390) {
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          results.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
          `Accessibility ${lang} ${width}`,
        );
        await page.screenshot({
          path: `test-results/${lang}-${width}.png`,
          fullPage: true,
        });
        await page.screenshot({
          path: `test-results/${lang}-${width}-top.png`,
        });
      }
      if (width === 390) {
        const menu = page.locator(".menu-toggle");
        await menu.click();
        assert.equal(await menu.getAttribute("aria-expanded"), "true");
        await page.keyboard.press("Escape");
        assert.equal(await menu.getAttribute("aria-expanded"), "false");
        await menu.click();
        await page.locator('#mobile-menu a[href="#pricing"]').click();
        assert.equal(await menu.getAttribute("aria-expanded"), "false");
        assert.equal(new URL(page.url()).hash, "#pricing");
      }
    }
  await page.goto(`${base}/en/`);
  await page.locator("#contact-form button").click();
  assert.equal(await page.locator("[aria-invalid=true]").count(), 4);
  await page.locator("#company").fill("Browser test transport");
  await page.locator("#name").fill("Test Contact");
  await page.locator("#email").fill("test@example.com");
  await page.locator("#consent").check();
  let attempt;
  await page.route("**/api/contact", async (route) => {
    attempt = route.request().postDataJSON();
    await route.abort();
  });
  await page.locator("#contact-form button").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#form-status")
      .textContent.includes("could not confirm"),
  );
  assert.equal(
    await page.locator("#company").inputValue(),
    "Browser test transport",
  );
  await page.unroute("**/api/contact");
  const retry = page.waitForRequest("**/api/contact");
  await page.locator("#contact-form button").click();
  assert.equal((await retry).postDataJSON().submissionId, attempt.submissionId);
  await page.waitForFunction(() =>
    document.querySelector("#form-status").textContent.includes("SB-"),
  );
  assert.equal(
    await page.locator("#form-status").getAttribute("role"),
    "status",
  );
  await page.locator(".terms-link").click();
  assert.match(page.url(), /\/en\/terms\/$/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("header .desktop-language a[lang=es]").click();
  assert.match(page.url(), /\/es\/terms\/$/);
  assert.equal(await page.locator("html").getAttribute("lang"), "es-419");
  assert.deepEqual(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
    [],
  );
  await page.route("**/styles.css", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        "\nhtml{font-size:200%} body{font-size:32px} p,a,button,label,input,h1,h2,h3{font-size:inherit!important}",
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/es/`);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "200% text overflow",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: EN/ES, 320–1440px, WCAG automated checks, menu/keyboard, contact errors + retry + receipt, terms, 200% text, no browser errors.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
