import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, IUser } from '../types.js';
import store from '../data/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'edumanage-secret-jwt-key-2026-production';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export function generateToken(user: IUser): string {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function protect(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized: No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: UserRole };
    const user = store.findUserById(decoded.id);

    if (!user) {
      res.status(401).json({ success: false, message: 'User belonging to this token no longer exists' });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({ success: false, message: 'Invalid or expired token', error: err.message });
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Role forbidden: '${req.user.role}' is not authorized to access this resource. Requires one of: [${roles.join(', ')}]`,
      });
      return;
    }

    next();
  };
}
