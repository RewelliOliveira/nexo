import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { employees, type Employee } from "@/db/schema";

/** Company directory: who can sign in and with which role. */
export function createEmployeeService({ db }: { db: Database }) {
  return {
    async findByEmail(email: string): Promise<Employee | null> {
      const employee = await db.query.employees.findFirst({
        where: eq(employees.email, email.trim().toLowerCase()),
      });
      return employee ?? null;
    },

    async getById(id: string): Promise<Employee | null> {
      const employee = await db.query.employees.findFirst({
        where: eq(employees.id, id),
      });
      return employee ?? null;
    },
  };
}

export type EmployeeService = ReturnType<typeof createEmployeeService>;
