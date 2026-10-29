import { cookies } from "next/headers";

/** Set by the login (auth step); holds the logged-in employee id. */
export const SESSION_COOKIE = "nexo_employee_id";

/**
 * Id of the logged-in employee, or null when there is no session. This is
 * the only source of identity for the agent: never the request body.
 */
export async function getSessionEmployeeId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value || null;
}
