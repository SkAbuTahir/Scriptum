import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
};

export const generateToken = (payload: JwtPayload): string => {
  const secret = getSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    { userId: payload.userId, email: payload.email },
    secret,
    { expiresIn } as jwt.SignOptions
  );
};

export const verifyToken = (token: string): JwtPayload => {
  const secret = getSecret();
  return jwt.verify(token, secret) as JwtPayload;
};

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
};
