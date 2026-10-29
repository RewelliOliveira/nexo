import type { Employee } from "@/db/schema";
import { getCurrentEmployee } from "../../_lib/auth";
import type { ConsoleError } from "./console-state";

type AnalystSession =
  | { ok: true; analyst: Employee }
  | { ok: false; status: 401 | 403; error: ConsoleError };

/** The logged-in analyst; employees never reach other people's conversations. */
export async function getAnalystSession(): Promise<AnalystSession> {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return {
      ok: false,
      status: 401,
      error: { code: "unauthenticated", message: "Entre com seu e-mail corporativo." },
    };
  }
  if (employee.role !== "analyst") {
    return {
      ok: false,
      status: 403,
      error: { code: "forbidden", message: "O console é só para analistas do service desk." },
    };
  }
  return { ok: true, analyst: employee };
}
