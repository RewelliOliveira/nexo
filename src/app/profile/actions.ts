"use server";

import { requireEmployee } from "../_lib/auth";

export type PasswordResetState = { sent: boolean };

/**
 * The prototype has no e-mail delivery or real passwords: this only checks
 * the session and answers as the directory would, so nothing is sent.
 */
export async function requestPasswordReset(): Promise<PasswordResetState> {
  await requireEmployee("employee");
  return { sent: true };
}
