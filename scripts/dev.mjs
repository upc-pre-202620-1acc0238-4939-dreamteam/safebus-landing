import { watch } from "node:fs";
import { execFileSync } from "node:child_process";
import { createApp } from "../server.mjs";
function build() {
  execFileSync(process.execPath, ["scripts/build.mjs"], {
    stdio: "inherit",
    windowsHide: true,
  });
}
build();
const server = createApp();
const port = Number(process.env.PORT || 3000),
  host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () =>
  console.log(
    `SafeBus dev: http://${host}:${port} — source changes rebuild automatically; refresh the browser.`,
  ),
);
let timer;
const watcher = watch("src", { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      build();
    } catch {
      console.error("Build failed. Fix the source and save again.");
    }
  }, 150);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearTimeout(timer);
    watcher.close();
    server.close(() => process.exit(0));
  });
