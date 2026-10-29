import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/db/test-database";
import { createEmployeeService, type EmployeeService } from "./employee-service";

describe("employee service", () => {
  let employees: EmployeeService;

  beforeEach(async () => {
    employees = createEmployeeService({ db: await createTestDatabase(new Date()) });
  });

  it("finds an employee by corporate e-mail, ignoring case and spaces", async () => {
    const employee = await employees.findByEmail("  Ana.Souza@NEXO.com.br ");
    expect(employee?.id).toBe("emp-ana");
    expect(employee?.role).toBe("employee");
  });

  it("finds the analyst", async () => {
    expect((await employees.findByEmail("marina.alves@nexo.com.br"))?.role).toBe("analyst");
  });

  it("returns null for unknown e-mails and ids", async () => {
    expect(await employees.findByEmail("alguem@gmail.com")).toBeNull();
    expect(await employees.getById("emp-unknown")).toBeNull();
  });
});
