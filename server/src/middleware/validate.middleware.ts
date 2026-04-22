import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Generic Zod runner. Replaces the previous `express-validator` chain runner.
 * Validates a chosen request slice and either replaces it with the parsed
 * result (default) or short-circuits with a uniform 422 payload that mirrors
 * the legacy shape ({ success, message, errors[] }).
 *
 * Note: in Express 5 `req.query` is read-only, so we do NOT mutate it.
 * The parsed result is exposed via `(req as any).validated.query` instead.
 */
export const validate =
  <S extends ZodTypeAny>(schema: S, source: Source = 'body'): RequestHandler =>
  (req, res, next) => {
    const target = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const result = schema.safeParse(target);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        msg: issue.message,
      }));
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    if (source === 'body') {
      req.body = result.data;
    } else if (source === 'params') {
      req.params = result.data as typeof req.params;
    } else {
      const bag = (req as unknown as { validated?: Record<string, unknown> }).validated ?? {};
      bag.query = result.data;
      (req as unknown as { validated: Record<string, unknown> }).validated = bag;
    }

    next();
  };
