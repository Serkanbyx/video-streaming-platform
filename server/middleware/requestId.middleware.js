import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

export const requestId = (req, res, next) => {
  const incoming = req.get('X-Request-Id');
  req.id =
    typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
      ? incoming
      : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
