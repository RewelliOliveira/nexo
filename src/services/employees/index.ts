import { getDatabase } from "@/db/client";
import { createEmployeeService, type EmployeeService } from "./employee-service";

export { createEmployeeService, type EmployeeService } from "./employee-service";

let defaultService: EmployeeService | undefined;

/** Employee directory bound to the application database. */
export function getEmployeeService(): EmployeeService {
  defaultService ??= createEmployeeService({ db: getDatabase() });
  return defaultService;
}
