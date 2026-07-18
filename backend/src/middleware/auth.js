const jwt = require("jsonwebtoken");

/**
 * Verifies the bearer JWT and attaches the decoded identity to req.user:
 *   { id, tenantId, branchId, role }
 * Every downstream query MUST filter by req.user.tenantId (and usually
 * branchId for non-admin/accountant roles) — this is what makes the
 * system safely multi-tenant. See spec §10 Multi-Tenancy & Security.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, tenantId, branchId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Restrict a route to a set of roles, e.g. requireRole("admin","accountant") */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(" or ")}` });
    }
    next();
  };
}

/**
 * Scopes a Prisma `where` clause to the caller's tenant, and to their
 * branch unless they are admin/accountant (who can see all branches).
 */
function scopeToUser(req, extra = {}) {
  const where = { tenantId: req.user.tenantId, ...extra };
  if (!["admin", "accountant"].includes(req.user.role) && req.user.branchId) {
    where.branchId = req.user.branchId;
  }
  return where;
}

module.exports = { requireAuth, requireRole, scopeToUser };
