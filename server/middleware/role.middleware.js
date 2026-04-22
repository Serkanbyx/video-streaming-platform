const denyWith = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

export const adminOnly = (req, _res, next) => {
  if (!req.user) return next(denyWith(401, 'Authentication required'));
  if (req.user.role !== 'admin') return next(denyWith(403, 'Admin access required'));
  next();
};

export const creatorOrAdmin = (req, _res, next) => {
  if (!req.user) return next(denyWith(401, 'Authentication required'));
  if (!['creator', 'admin'].includes(req.user.role)) {
    return next(denyWith(403, 'Creator access required'));
  }
  next();
};
