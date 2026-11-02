
import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";

const router = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

// ADMIN LOGIN
router.post("/login", adminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 255 ||
      password.length > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid login details."
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !passwordHash) {
      return res.status(503).json({
        success: false,
        message: "Admin login is not configured."
      });
    }

    const emailMatches = email.trim().toLowerCase() === adminEmail;
    const passwordMatches = await bcrypt.compare(
      password,
      passwordHash
    );

    if (!emailMatches || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({
          success: false,
          message: "Unable to create admin session."
        });
      }

      req.session.role = "admin";
      req.session.adminEmail = adminEmail;

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({
            success: false,
            message: "Unable to save admin session."
          });
        }

        return res.json({
          success: true,
          message: "Admin login successful."
        });
      });
    });

  } catch (error) {
    console.error("Admin login error:", error.message);

    res.status(500).json({
      success: false,
      message: "Admin login failed."
    });
  }
});

// ADMIN LOGOUT
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

    res.clearCookie("prince.sid");

    return res.json({
      success: true,
      message: "Admin logged out successfully."
    });
  });
});

export default router;
