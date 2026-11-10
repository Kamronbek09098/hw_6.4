import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";

let server;
let baseUrl;
let dir;

before(async () => {
    dir = await mkdtemp(join(tmpdir(), "users-test-"));
    const filePath = join(dir, "users.json");
    await writeFile(filePath, "[]", "utf-8");

    const app = createApp({ filePath });
    await new Promise(resolve => {
        server = app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
});

const json = (method, body) => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

test("GET /health returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
});

test("full CRUD flow", async () => {
    let res = await fetch(`${baseUrl}/users`);
    assert.deepEqual(await res.json(), []);

    res = await fetch(`${baseUrl}/users`, json("POST", { name: " Ali ", email: "ali@mail.com" }));
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.deepEqual(created, { id: 1, name: "Ali", email: "ali@mail.com" });

    res = await fetch(`${baseUrl}/users/1`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), created);

    res = await fetch(`${baseUrl}/users/1`, json("PUT", { name: "Vali", email: "vali@mail.com" }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { id: 1, name: "Vali", email: "vali@mail.com" });

    res = await fetch(`${baseUrl}/users/1`, { method: "DELETE" });
    assert.equal(res.status, 204);

    res = await fetch(`${baseUrl}/users/1`);
    assert.equal(res.status, 404);
});

test("POST validates required fields", async () => {
    const res = await fetch(`${baseUrl}/users`, json("POST", { name: "NoEmail" }));
    assert.equal(res.status, 400);
});

test("POST rejects duplicate email", async () => {
    await fetch(`${baseUrl}/users`, json("POST", { name: "A", email: "dup@mail.com" }));
    const res = await fetch(`${baseUrl}/users`, json("POST", { name: "B", email: "DUP@mail.com" }));
    assert.equal(res.status, 400);
});

test("PUT / DELETE unknown user returns 404", async () => {
    let res = await fetch(`${baseUrl}/users/999`, json("PUT", { name: "X", email: "x@mail.com" }));
    assert.equal(res.status, 404);
    res = await fetch(`${baseUrl}/users/999`, { method: "DELETE" });
    assert.equal(res.status, 404);
});
