
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.customerId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Please login first."
    });
  }

  next();
}
