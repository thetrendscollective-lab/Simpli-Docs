import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        currentPlan: 'free' | 'standard' | 'pro' | 'family';
        subscriptionStatus: string | null;
      };
    }
  }
}
