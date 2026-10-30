import { getDatabase } from "@/db/client";
import { createKbService, type KbService } from "./kb-service";

export {
  createKbService,
  type KbSearchQuery,
  type KbSearchResult,
  type KbService,
} from "./kb-service";

let defaultService: KbService | undefined;

/** Help center service bound to the application database. */
export function getKbService(): KbService {
  defaultService ??= createKbService({ db: getDatabase() });
  return defaultService;
}
