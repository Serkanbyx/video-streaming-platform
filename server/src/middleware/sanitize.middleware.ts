import type { RequestHandler } from 'express';
import mongoSanitize from 'express-mongo-sanitize';

export const sanitizeMongo: RequestHandler = (req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
};
