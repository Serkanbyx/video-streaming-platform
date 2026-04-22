import type { UserDoc } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user: UserDoc | null;
    }
  }
}

export {};
