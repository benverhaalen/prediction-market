import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { getBaseUrl } from "./utils";

const COOKIE_NAME = "admin_session";
const SESSION_TOKEN = "prediction-market-admin-session";

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
  });
  if (!settings) return false;

  // If password is still the default plaintext, compare directly
  if (settings.adminPassword === "changeme") {
    return password === "changeme";
  }

  // Otherwise compare against hashed password
  return bcrypt.compare(password, settings.adminPassword);
}

export async function setAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, SESSION_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60, // 60 seconds — just enough for the redirect
    path: "/",
  });
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  return session?.value === SESSION_TOKEN;
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Check that the request Origin/Referer matches our domain.
 * Returns true if safe, false if cross-origin.
 */
export function checkCsrfOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const allowedHost = new URL(getBaseUrl()).host;

  if (origin) {
    try {
      return new URL(origin).host === allowedHost;
    } catch {
      return false;
    }
  }
  if (referer) {
    try {
      return new URL(referer).host === allowedHost;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * In-memory login rate limiter.
 * Blocks an IP after 5 failed attempts within 15 minutes.
 */
const loginAttempts = new Map<
  string,
  { count: number; firstAttempt: number }
>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry) return true;

  // Reset if window expired
  if (now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return true;
  }

  return entry.count < MAX_ATTEMPTS;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count++;
  }
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}
