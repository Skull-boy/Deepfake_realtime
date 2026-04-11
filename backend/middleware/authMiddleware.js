const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const requireAuth = ClerkExpressRequireAuth({});

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // In development, bypass role check for testing
      if (process.env.NODE_ENV !== 'production') {
        return next();
      }

      const userRole = req.auth?.sessionClaims?.o?.rol;

      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Access denied: insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error);
      res.status(403).json({ error: 'Access denied' });
    }
  };
};

module.exports = {
  requireAuth,
  requireRole
};
