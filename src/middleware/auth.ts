import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser, getUserByUid } from '../db/repository.ts';

export interface AuthenticatedUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  roleCode: 'SUPER_ADMIN' | 'ADMIN_GA_HRD' | 'STAFF' | 'AUDITOR';
  departmentId: number | null;
  isActive: boolean;
  isDemo: boolean;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Tidak terautentikasi: Token akses tidak ditemukan.' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  const demoRoleHeader = req.headers['x-demo-uid'] as string | undefined;

  try {
    // 1. Handle Demo / Credential Session Token (`demo_session:<uid>`)
    if (token.startsWith('demo_session:')) {
      const targetUid = token.replace('demo_session:', '').trim();
      const dbUser = await getUserByUid(targetUid);
      if (!dbUser || !dbUser.isActive) {
        return res.status(401).json({ error: 'Akun pengguna tidak ditemukan atau nonaktif.' });
      }
      req.authUser = {
        id: dbUser.id,
        uid: dbUser.uid,
        name: dbUser.name,
        email: dbUser.email,
        roleCode: dbUser.roleCode as AuthenticatedUser['roleCode'],
        departmentId: dbUser.departmentId,
        isActive: dbUser.isActive,
        isDemo: dbUser.isDemo,
      };
      return next();
    }

    // 2. Standard Firebase ID Token verification
    const decodedToken = await adminAuth.verifyIdToken(token);

    // If the user selected a demo role account in the UI switcher while signed in
    if (demoRoleHeader) {
      const switchedUser = await getUserByUid(demoRoleHeader);
      if (switchedUser && switchedUser.isActive) {
        req.authUser = {
          id: switchedUser.id,
          uid: switchedUser.uid,
          name: switchedUser.name,
          email: switchedUser.email,
          roleCode: switchedUser.roleCode as AuthenticatedUser['roleCode'],
          departmentId: switchedUser.departmentId,
          isActive: switchedUser.isActive,
          isDemo: switchedUser.isDemo,
        };
        return next();
      }
    }

    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || `${decodedToken.uid}@nusantaratek.co.id`,
      decodedToken.name
    );

    if (!dbUser.isActive) {
      return res.status(403).json({ error: 'Akun Anda berstatus nonaktif. Hubungi Super Admin.' });
    }

    req.authUser = {
      id: dbUser.id,
      uid: dbUser.uid,
      name: dbUser.name,
      email: dbUser.email,
      roleCode: dbUser.roleCode as AuthenticatedUser['roleCode'],
      departmentId: dbUser.departmentId,
      isActive: dbUser.isActive,
      isDemo: dbUser.isDemo,
    };
    return next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
  }
};

export const requireRoles = (allowedRoles: Array<'SUPER_ADMIN' | 'ADMIN_GA_HRD' | 'STAFF' | 'AUDITOR'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Tidak terautentikasi.' });
    }
    if (!allowedRoles.includes(req.authUser.roleCode)) {
      return res.status(403).json({
        error: `Akses ditolak: Peran Anda (${req.authUser.roleCode}) tidak memiliki kewenangan untuk tindakan ini.`,
      });
    }
    return next();
  };
};
