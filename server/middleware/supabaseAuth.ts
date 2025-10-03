import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supa';
import { storage } from '../storage';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    currentPlan: 'free' | 'standard' | 'pro' | 'family';
    subscriptionStatus: string | null;
  };
}

export async function authenticateSupabase(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized', error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    if (!supabase) {
      console.error('Supabase not configured');
      return res.status(500).json({ message: 'Authentication service unavailable' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ message: 'Unauthorized', error: 'Invalid token' });
    }

    let dbUser = await storage.getUser(user.id);
    
    if (!dbUser) {
      dbUser = await storage.upsertUser({
        id: user.id,
        email: user.email || null,
        firstName: user.user_metadata?.first_name || null,
        lastName: user.user_metadata?.last_name || null,
        currentPlan: 'free',
        subscriptionStatus: null,
      });
      console.log(`✅ Created new user in database: ${user.id}`);
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email || user.email || '',
      currentPlan: (dbUser.currentPlan as 'free' | 'standard' | 'pro' | 'family') || 'free',
      subscriptionStatus: dbUser.subscriptionStatus || null,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  authenticateSupabase(req, res, next);
}
