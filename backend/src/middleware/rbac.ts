import { Request, Response, NextFunction } from 'express';

const ROLE_HIERARCHY: Record<string, number> = {
  Admin: 4,
  Manager: 3,
  Auditor: 2,
  Viewer: 1,
};

/**
 * Require the user to have one of the specified roles.
 * Roles are checked by exact match OR by hierarchy if useHierarchy is true.
 */
export function requireRole(roles: string[], useHierarchy = false) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userRole = req.user.role;

    const allowed = useHierarchy
      ? roles.some(r => (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[r] ?? 0))
      : roles.includes(userRole);

    if (!allowed) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: userRole,
      });
      return;
    }

    next();
  };
}

// Shorthand helpers
export const requireAdmin    = requireRole(['Admin']);
export const requireManager  = requireRole(['Admin', 'Manager']);
export const requireAuditor  = requireRole(['Admin', 'Manager', 'Auditor']);
export const requireViewer   = requireRole(['Admin', 'Manager', 'Auditor', 'Viewer']);
