/* eslint-disable @typescript-eslint/no-namespace */

import type { RoleName } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedUser {
  userId: string;
  role: RoleName;
}

export {};
