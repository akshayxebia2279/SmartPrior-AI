import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.config';

export interface AuthenticatedUser {
  userId: string;
  role: RoleName;
}

export interface PublicUserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: {
    id: string;
    name: RoleName;
  };
}

export const createAuthError = (statusCode: number, message: string): Error & { statusCode: number } => {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
};

export class AuthService {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  public async login(email: string, password: string): Promise<{ accessToken: string; user: PublicUserProfile }> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      throw createAuthError(401, 'Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true },
    });

    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw createAuthError(401, 'Invalid credentials');
    }

    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role.name,
      },
      env.JWT_ACCESS_SECRET as jwt.Secret,
      {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        algorithm: 'HS256',
      }
    );

    return {
      accessToken,
      user: this.mapUser(user),
    };
  }

  public async getCurrentUser(userId: string): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw createAuthError(401, 'Authentication failed');
    }

    return this.mapUser(user);
  }

  public async loadAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      userId: user.id,
      role: user.role.name,
    };
  }

  public verifyAccessToken(token: string): AuthenticatedUser {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as JwtPayload;

      if (!payload || typeof payload.userId !== 'string' || typeof payload.role !== 'string') {
        throw createAuthError(401, 'Invalid token');
      }

      return {
        userId: payload.userId,
        role: payload.role as RoleName,
      };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw createAuthError(401, 'Invalid or expired token');
    }
  }

  private mapUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: { id: string; name: RoleName };
  }): PublicUserProfile {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
    };
  }
}
