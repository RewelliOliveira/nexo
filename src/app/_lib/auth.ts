import { redirect } from "next/navigation";
import type { Employee, EmployeeRole } from "@/db/schema";
import { getSessionEmployeeId } from "@/lib/session";
import { getEmployeeService } from "@/services/employees";

/** Where each role lands after signing in. */
export function homePathFor(role: EmployeeRole): "/chat" | "/console" {
  return role === "analyst" ? "/console" : "/chat";
}

/** The logged-in employee, or null. Reads the session cookie, so the caller is dynamic. */
export async function getCurrentEmployee(): Promise<Employee | null> {
  const employeeId = await getSessionEmployeeId();
  if (!employeeId) return null;
  return getEmployeeService().getById(employeeId);
}

/** Sends visitors without a session to the login and the wrong role to its own home. */
export async function requireEmployee(role: EmployeeRole): Promise<Employee> {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== role) redirect(homePathFor(employee.role));
  return employee;
}
