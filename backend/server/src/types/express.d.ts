/// <reference types="express" />

declare global {
  namespace Express {
    interface Request {
      reqId?: string;
      user?: { id: string; email?: string; emailVerifiedAt?: Date | null };
    }
  }
}

export {};
