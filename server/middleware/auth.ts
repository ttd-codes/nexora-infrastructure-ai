import { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing Bearer token.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty token.' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken.email_verified) {
      res.status(401).json({
        error: 'Authentication requires a verified email address.',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
  }
};
