import { cookies } from "next/headers";
import { readSessionSecret, signSessionToken, verifySessionToken } from "./session-token";

/** Signed (HMAC) token holding the logged-in employee id. */
export const SESSION_COOKIE = "nexo_session";

const HOUR = 60 * 60 * 1000;
/** Without "keep me signed in": browser-session cookie, token valid for a workday */
const SHORT_SESSION_MS = 12 * HOUR;
/** With "keep me signed in" */
const LONG_SESSION_MS = 30 * 24 * HOUR;

/**
 * Id of the logged-in employee, or null when there is no valid session. This
 * is the only source of identity for the agent: never the request body.
 */
export async function getSessionEmployeeId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token, readSessionSecret(), new Date())?.sub ?? null;
}

export async function createSession(
  employeeId: string,
  { remember }: { remember: boolean },
): Promise<void> {
  const duration = remember ? LONG_SESSION_MS : SHORT_SESSION_MS;
  const token = signSessionToken(
    { sub: employeeId, exp: Date.now() + duration },
    readSessionSecret(),
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? duration / 1000 : undefined,
  });
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
