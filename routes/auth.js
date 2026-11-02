
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../database.js";

const router = Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72)
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72)
});

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid registration details."
      });
    }

    const { fullName, email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await pool.query(
      "SELECT id FROM customers WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO customers (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, created_at`,
      [fullName, normalizedEmail, passwordHash]
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      customer: result.rows[0]
    });

  } catch (error) {
    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Registration failed."
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid login details."
      });
    }

    const { email, password } = validation.data;

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash
       FROM customers
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const customer = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      customer.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    if (!req.session) {
      return res.status(500).json({
        success: false,
        message: "Session system is not configured."
      });
    }

    req.session.customerId = customer.id;

    return res.json({
      success: true,
      message: "Login successful.",
      customer: {
        id: customer.id,
        fullName: customer.full_name,
        email: customer.email
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
});

// LOGOUT
router.post("/logout", (req, res) => {
  if (!req.session) {
    return res.json({ success: true });
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Logout failed."
      });
    }

    res.clearCookie("connect.sid");

    return res.json({
      success: true,
      message: "Logged out successfully."
    });
  });
});

export default router;
