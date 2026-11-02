
import express from "express";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";

import { pool } from "./database.js";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import { requireAuth } from "./middleware/requireAuth.js";

dotenv.config();

const app = express();
const PgStore = connectPgSimple(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";

app.disable("x-powered-by");

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({
  extended: false,
  limit: "20kb"
}));

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing.");
}

app.use(session({
  store: new PgStore({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  name: "prince.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

// Authentication
app.use("/api/auth", authLimiter, authRoutes);

// Protected dashboard routes
app.use("/dashboard", dashboardRoutes);

// Protect direct dashboard file access too
app.get("/dashboard.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Current customer
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, created_at
       FROM customers
       WHERE id = $1`,
      [req.session.customerId]
    );

    if (!result.rowCount) {
      return res.status(401).json({
        success: false,
        message: "Account not found."
      });
    }

    res.json({
      success: true,
      customer: result.rows[0]
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load account."
    });
  }
});

// Website files
app.use(express.static(path.join(__dirname, "public")));

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      name: "PRINCE VPS HOSTING",
      status: "online",
      database: "connected"
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "database unavailable"
    });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Page not found."
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal server error."
  });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("================================");
  console.log(" PRINCE VPS HOSTING");
  console.log(` Server running on port ${PORT}`);
  console.log("================================");
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
