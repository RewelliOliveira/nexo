import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/db/test-database";
import { createEmployeeService, type EmployeeService } from "./employee-service";

describe("employee service", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  let employees: EmployeeService;

  beforeEach(async () => {
    employees = createEmployeeService({ db: await createTestDatabase(now) });
  });

  it("finds an employee by corporate e-mail, ignoring case and spaces", async () => {
    const employee = await employees.findByEmail("  Ana.Souza@NEXO.com.br ");
    expect(employee?.id).toBe("emp-ana");
    expect(employee?.role).toBe("employee");
  });

  it("finds the analyst", async () => {
    expect((await employees.findByEmail("marina.alves@nexo.com.br"))?.role).toBe("analyst");
  });

  it("knows when the password last changed", async () => {
    const employee = await employees.getById("emp-ana");
    expect(employee?.passwordChangedAt).toEqual(new Date("2026-09-09T12:00:00Z"));
  });

  it("returns null for unknown e-mails and ids", async () => {
    expect(await employees.findByEmail("alguem@gmail.com")).toBeNull();
    expect(await employees.getById("emp-unknown")).toBeNull();
  });
});
