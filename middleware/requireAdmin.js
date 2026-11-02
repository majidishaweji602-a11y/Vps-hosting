
export function requireAdmin(req, res, next) {
  if (!req.session || req.session.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required."
    });
  }

  next();
}
