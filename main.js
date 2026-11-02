
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

dotenv.config();

const app = express();
const PgStore = connectPgSimple(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";

// ==================================
// BASIC CONFIGURATION
// ==================================

app.disable("x-powered-by");

if (isProduction) {
  app.set("trust proxy", 1);
}

// ==================================
// SECURITY HEADERS
// ==================================

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// ==================================
// REQUEST BODY
// ==================================

app.use(express.json({ limit: "20kb" }));

app.use(
  express.urlencoded({
    extended: false,
    limit: "20kb"
  })
);

// ==================================
// DATABASE SESSION
// ==================================

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing.");
}

app.use(
  session({
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
  })
);

// ==================================
// RATE LIMITER
// ==================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many attempts. Try again later."
  }
});

// ==================================
// AUTHENTICATION API
// ==================================

app.use("/api/auth", authLimiter, authRoutes);

// ==================================
// WEBSITE FILES
// ==================================

app.use(
  express.static(path.join(__dirname, "public"))
);

// ==================================
// HEALTH CHECK
// ==================================

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
    console.error("Health check error:", error.message);

    res.status(503).json({
      success: false,
      name: "PRINCE VPS HOSTING",
      status: "database unavailable"
    });
  }
});

// ==================================
// CURRENT CUSTOMER
// ==================================

app.get("/api/auth/me", async (req, res) => {
  try {
    if (!req.session.customerId) {
      return res.status(401).json({
        success: false,
        message: "Please login first."
      });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, created_at
       FROM customers
       WHERE id = $1`,
      [req.session.customerId]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Customer account not found."
      });
    }

    return res.json({
      success: true,
      customer: result.rows[0]
    });

  } catch (error) {
    console.error("Customer lookup error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load customer account."
    });
  }
});

// ==================================
// HOMEPAGE
// ==================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// ==================================
// 404 HANDLER
// ==================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Page not found."
  });
});

// ==================================
// ERROR HANDLER
// ==================================

app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  res.status(500).json({
    success: false,
    message: "Internal server error."
  });
});

// ==================================
// START SERVER
// ==================================

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("==================================");
  console.log("       PRINCE VPS HOSTING");
  console.log("==================================");
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("==================================");
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down PRINCE VPS HOSTING...");

  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
