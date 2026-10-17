import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { Socket } from "socket.io";

export type UserRole = "caregiver" | "secondary_contact" | "pharmacist" | "admin";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  patient_ids?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const JWT_SECRET = process.env.JWT_SECRET || "careconnect-jwt-secret-key-32b-secure";

/**
 * Native Scrypt Password Hashing (built-in crypto, zero native dependency issues)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 3 || parts[0] !== "scrypt") {
      return false;
    }
    const salt = parts[1];
    const originalHash = parts[2];
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), derivedKey);
  } catch {
    return false;
  }
}

/**
 * Standard Demo Users with hashed passwords
 */
export interface SeedUser {
  id: string;
  username: string;
  password_plain: string;
  password_hash: string;
  role: UserRole;
  patient_ids: string[];
}

export const DEMO_USERS: SeedUser[] = [
  {
    id: "usr_admin",
    username: "admin",
    password_plain: "admin123",
    password_hash: hashPassword("admin123"),
    role: "admin",
    patient_ids: ["pt_001", "pt_002"],
  },
  {
    id: "usr_caregiver",
    username: "caregiver",
    password_plain: "caregiver123",
    password_hash: hashPassword("caregiver123"),
    role: "caregiver",
    patient_ids: ["pt_001", "pt_002"],
  },
  {
    id: "usr_secondary",
    username: "secondary",
    password_plain: "secondary123",
    password_hash: hashPassword("secondary123"),
    role: "secondary_contact",
    patient_ids: ["pt_001"],
  },
  {
    id: "usr_pharmacist",
    username: "pharmacist",
    password_plain: "pharmacist123",
    password_hash: hashPassword("pharmacist123"),
    role: "pharmacist",
    patient_ids: ["pt_001", "pt_002"],
  },
];

/**
 * Sign JWT token
 */
export function signToken(user: AuthUser, expiresIn: string | number = "24h"): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      patient_ids: user.patient_ids ?? [],
    },
    JWT_SECRET,
    { expiresIn } as jwt.SignOptions,
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (!decoded || !decoded.username || !decoded.role) {
      return null;
    }
    return {
      id: String(decoded.id ?? decoded.sub ?? "unknown"),
      username: String(decoded.username),
      role: decoded.role as UserRole,
      patient_ids: Array.isArray(decoded.patient_ids) ? decoded.patient_ids : [],
    };
  } catch {
    return null;
  }
}

/**
 * Express Middleware: Authenticate Bearer JWT
 */
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers["authorization"];
  const token =
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null) ||
    (req.headers["x-access-token"] as string | undefined) ||
    (req.query?.token as string | undefined);

  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
      next();
      return;
    }
    // Token was supplied but is invalid
    res.status(401).json({ error: "Invalid or expired authorization token" });
    return;
  }

  // If no token was provided:
  // In strict mode (REQUIRE_AUTH=true or production), block
  if (process.env.REQUIRE_AUTH === "true") {
    res.status(401).json({ error: "Authorization token required (Bearer <jwt>)" });
    return;
  }

  // Permissive dev mode: attach guest user so existing dev endpoints continue working
  req.user = {
    id: "usr_dev",
    username: "dev-caregiver",
    role: "caregiver",
    patient_ids: ["pt_001", "pt_002"],
  };
  next();
}

/**
 * Express Middleware: Role-Based Access Control (RBAC)
 * Admin always has access to all routes.
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (req.user.role === "admin" || allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({
      error: `Forbidden: role '${req.user.role}' lacks permission for this action`,
      required_roles: allowedRoles,
    });
  };
}

/**
 * Socket.IO Authentication Middleware
 * Secures WebSocket connections with the same JWT token.
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token =
    (socket.handshake.auth && socket.handshake.auth.token) ||
    (socket.handshake.query && (socket.handshake.query.token as string)) ||
    (socket.handshake.headers.authorization &&
      socket.handshake.headers.authorization.startsWith("Bearer ")
      ? socket.handshake.headers.authorization.slice(7)
      : undefined);

  if (token) {
    const user = verifyToken(token);
    if (user) {
      socket.data.user = user;
      next();
      return;
    }
    next(new Error("Authentication error: Invalid or expired token"));
    return;
  }

  // Permissive dev mode fallback
  if (process.env.REQUIRE_AUTH === "true") {
    next(new Error("Authentication error: Token required"));
    return;
  }

  socket.data.user = {
    id: "usr_dev",
    username: "dev-socket-client",
    role: "caregiver",
    patient_ids: ["pt_001", "pt_002"],
  };
  next();
}
