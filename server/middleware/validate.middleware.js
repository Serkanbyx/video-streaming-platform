import { validationResult } from 'express-validator';

/**
 * Generic runner for `express-validator` chains. Mounts as the LAST handler in
 * the validator stack on each route so any failed assertion short-circuits
 * with a uniform 422 payload before the controller executes.
 *
 * The error shape (`{ field, msg }[]`) is intentionally flat to make client-side
 * form-binding trivial without leaking internal validator metadata.
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array().map((e) => ({ field: e.path, msg: e.msg })),
  });
};
