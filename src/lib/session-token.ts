import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const MIN_SECRET_LENGTH = 32;

const payloadSchema = z.object({
  /** Employee id */
  sub: z.string().min(1),
  /** Expiry, epoch milliseconds */
  exp: z.number().int(),
});

export type SessionPayload = z.infer<typeof payloadSchema>;

/** Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256). */
export function signSessionToken(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** The payload when the signature matches and the token has not expired. */
export function verifySessionToken(
  token: string,
  secret: string,
  now: Date,
): SessionPayload | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(body, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const payload = payloadSchema.safeParse(json);
  if (!payload.success || payload.data.exp <= now.getTime()) return null;
  return payload.data;
}

/** SESSION_SECRET from the environment; fails loudly instead of signing with a weak key. */
export function readSessionSecret(value = process.env.SESSION_SECRET): string {
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be set to a random string of at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
  return value;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}
