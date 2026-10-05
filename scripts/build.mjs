import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { render } from "../src/render.mjs";
import { resolve } from "node:path";
const root = new URL("../", import.meta.url);
const dest = new URL("dist/", root);
await mkdir(new URL("fonts/", dest), { recursive: true });
for (const file of ["styles.css", "app.js"])
  await copyFile(new URL(`src/${file}`, root), new URL(file, dest));
for (const weight of [400, 500, 600, 700])
  await copyFile(
    new URL(
      `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`,
      root,
    ),
    new URL(`fonts/inter-latin-${weight}-normal.woff2`, dest),
  );
await copyFile(
  new URL("node_modules/material-symbols/material-symbols-rounded.woff2", root),
  new URL("fonts/material-symbols-rounded.woff2", dest),
);
let siteUrl = process.env.SITE_URL || "";
if (siteUrl) {
  const parsed = new URL(siteUrl);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("SITE_URL must be an HTTP(S) origin");
  siteUrl = parsed.origin;
}
for (const lang of ["en", "es"]) {
  await mkdir(new URL(`${lang}/terms/`, dest), { recursive: true });
  await writeFile(
    new URL(`${lang}/index.html`, dest),
    render(lang, { siteUrl }),
  );
  await writeFile(
    new URL(`${lang}/terms/index.html`, dest),
    render(lang, { terms: true, siteUrl }),
  );
}
await writeFile(
  new URL("favicon.svg", dest),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 44"><path fill="#0D2C54" d="M20 1 37 7v16c0 10-9 17-17 20C12 40 3 33 3 23V7Z"/><rect x="11" y="11" width="18" height="21" rx="4" fill="none" stroke="white" stroke-width="2.5"/><path d="M12 23h16M20 12v11" stroke="white" stroke-width="2.5"/><g fill="white"><circle cx="15" cy="28" r="1.5"/><circle cx="25" cy="28" r="1.5"/></g></svg>',
);
await writeFile(
  new URL("robots.txt", dest),
  `User-agent: *\nAllow: /\nDisallow: /api/\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ""}`,
);
await writeFile(
  new URL("sitemap.xml", dest),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${siteUrl ? ["en/", "es/", "en/terms/", "es/terms/"].map((p) => `<url><loc>${siteUrl}/${p}</loc></url>`).join("") : ""}</urlset>`,
);
console.log(`Built English and Spanish pages in ${resolve("dist")}.`);
