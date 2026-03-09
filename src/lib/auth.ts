import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

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
