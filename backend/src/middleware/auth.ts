import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Extend Express Request to include decoded user
declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        email: string;
        tenantId: string;
        role: string;
      };
    }
  }
}

const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;

// Lazy-initialize verifier so it doesn't fail at module load in local dev
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    if (!userPoolId || !clientId) {
      throw new Error('COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set');
    }
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId,
    });
  }
  return verifier;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Allow local dev bypass with X-Dev-User header
  if (process.env.NODE_ENV === 'development' && req.headers['x-dev-user']) {
    try {
      req.user = JSON.parse(req.headers['x-dev-user'] as string);
      next();
      return;
    } catch {
      // fall through to normal auth
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await getVerifier().verify(token);

    req.user = {
      sub: payload.sub,
      email: (payload as Record<string, unknown>)['email'] as string ?? '',
      tenantId: (payload as Record<string, unknown>)['custom:tenantId'] as string ?? '',
      role: (payload as Record<string, unknown>)['custom:role'] as string ?? 'Viewer',
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
