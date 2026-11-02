
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "../database.js";

const schemaPath = fileURLToPath(
  new URL("./schema.sql", import.meta.url)
);

async function initializeDatabase() {
  try {
    const schema = await readFile(schemaPath, "utf8");

    await pool.query(schema);

    console.log("PRINCE VPS database initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

initializeDatabase();
