import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRequestHandler<P = unknown, ResBody = unknown, ReqBody = unknown, ReqQuery = unknown> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<unknown> | unknown;

/**
 * Wraps an async controller so any thrown/rejected error is forwarded to
 * Express's error pipeline instead of crashing the process. Eliminates the
 * boilerplate try/catch that every controller had in the JS version.
 */
export const asyncHandler =
  <P = unknown, ResBody = unknown, ReqBody = unknown, ReqQuery = unknown>(
    handler: AsyncRequestHandler<P, ResBody, ReqBody, ReqQuery>
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
