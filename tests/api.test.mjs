import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.mjs";
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${server.address().port}`),
    ),
  );
const close = (server) => new Promise((resolve) => server.close(resolve));
const valid = () => ({
  submissionId: randomUUID(),
  company: "Test transport",
  name: "Test contact",
  email: "contact@example.com",
  consent: true,
});
test("US15: validation, durable receipts, idempotency and private storage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "safebus-test-"));
  let server = createApp({ dbPath: join(dir, "test.sqlite") });
  let base = await listen(server);
  const send = (body) =>
    fetch(`${base}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    for (const patch of [
      { company: " " },
      { name: "" },
      { email: "bad@" },
      { consent: false },
    ]) {
      const response = await send({ ...valid(), ...patch });
      assert.equal(response.status, 422);
      assert.ok((await response.json()).fields.length);
    }
    assert.equal((await send({ ...valid(), submissionId: "bad" })).status, 422);
    const body = valid();
    const first = await send(body);
    assert.equal(first.status, 201);
    const receipt = await first.json();
    assert.match(receipt.reference, /^SB-/);
    assert.ok(Date.parse(receipt.receivedAt));
    const retry = await send(body);
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), receipt);
    assert.equal(
      (await send({ ...body, name: "Different contact" })).status,
      409,
    );
    await close(server);
    server = createApp({ dbPath: join(dir, "test.sqlite") });
    base = await listen(server);
    assert.deepEqual(await (await send(body)).json(), receipt);
    assert.equal((await fetch(`${base}/data/contacts.sqlite`)).status, 404);
    assert.equal((await fetch(`${base}/api/contact`)).status, 405);
    const foreign = await fetch(`${base}/api/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://unrelated.example",
      },
      body: JSON.stringify(valid()),
    });
    assert.equal(foreign.status, 403);
    const malformed = await fetch(`${base}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    for (let i = 0; i < 10; i++)
      assert.equal((await send(valid())).status, 201);
    assert.equal((await send(valid())).status, 429);
    assert.deepEqual(
      await (await send(body)).json(),
      receipt,
      "Retry still works after rate limit",
    );
  } finally {
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});
