
import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/", requireAuth, (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "dashboard.html")
  );
});

export default router;
