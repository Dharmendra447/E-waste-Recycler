import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Define a custom request type that includes our user payload
export interface AuthRequest extends Request {
  userId?: number;
  userRole?: 'user' | 'vendor' | 'admin';
}

// This is now a factory function. It takes the secret and returns the middleware.
// This ensures the same secret is always used.
export function createAuthMiddleware(secret: string) {
  return function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.cookies.token;

    if (!token) {
      return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, secret, (err: any, payload: any) => {
      if (err) {
        // This log will now clearly show the error, like "invalid signature"
        console.error('JWT verification error:', err);
        return res.sendStatus(403); // Forbidden
      }
      
      // The payload from our login endpoint is { userId, role }
      if (payload.userId && payload.role) {
        req.userId = payload.userId;
        req.userRole = payload.role;
        next();
      } else {
        // Invalid token payload
        return res.sendStatus(403);
      }
    });
  }
}
