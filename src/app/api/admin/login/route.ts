import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminPassword,
  setAdminSession,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginAttempts,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkLoginRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const { password } = await request.json();

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const valid = await verifyAdminPassword(password);
  if (!valid) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  clearLoginAttempts(ip);
  await setAdminSession();
  return NextResponse.json({ success: true });
}
