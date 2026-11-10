import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function createApp({ filePath = process.env.DATA_FILE || join(process.cwd(), "users.json") } = {}) {
    const app = express();

    app.use(express.json());

    async function readUsers() {
        try {
            const data = await readFile(filePath, "utf-8");
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    async function writeUsers(users) {
        await writeFile(filePath, JSON.stringify(users, null, 2), "utf-8");
    }

    app.get("/health", (req, res) => {
        res.json({ status: "ok" });
    });

    app.get("/users", async (req, res) => {
        const users = await readUsers();
        res.json(users);
    });

    app.get("/users/:id", async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const users = await readUsers();
        const user = users.find(u => u.id === id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
    });

    app.post("/users", async (req, res) => {
        const { name, email } = req.body ?? {};

        if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required" });
        }

        const users = await readUsers();

        const emailExists = users.some(user => user.email.toLowerCase() === email.trim().toLowerCase());
        if (emailExists) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const nextId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
        const newUser = { id: nextId, name: name.trim(), email: email.trim() };

        users.push(newUser);
        await writeUsers(users);

        res.status(201).json(newUser);
    });

    app.put("/users/:id", async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const { name, email } = req.body ?? {};

        if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required" });
        }

        const users = await readUsers();
        const index = users.findIndex(u => u.id === id);

        if (index === -1) {
            return res.status(404).json({ message: "User not found" });
        }

        const emailExists = users.some(user => user.id !== id && user.email.toLowerCase() === email.trim().toLowerCase());

        if (emailExists) return res.status(400).json({ message: "Email already exists" });

        users[index] = { id, name: name.trim(), email: email.trim() };
        await writeUsers(users);

        res.json(users[index]);
    });

    app.delete("/users/:id", async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const users = await readUsers();
        const index = users.findIndex(u => u.id === id);

        if (index === -1) {
            return res.status(404).json({ message: "User not found" });
        }

        users.splice(index, 1);
        await writeUsers(users);

        res.status(204).send();
    });

    return app;
}
