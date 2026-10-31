import { existsSync } from "node:fs";
import path from "node:path";

// Only the project root has this folder, so it identifies the root
const ROOT_MARKER = path.join("src", "db", "migrations");

/**
 * Project root, also when running under `mastra dev`, whose working
 * directory is a build folder inside the project, not the project itself.
 */
export function getProjectRoot(
  cwd: string = process.cwd(),
  exists: (target: string) => boolean = existsSync,
): string {
  for (let dir = cwd; ; dir = path.dirname(dir)) {
    if (exists(path.join(dir, ROOT_MARKER))) return dir;
    if (path.dirname(dir) === dir) return cwd;
  }
}

/**
 * Makes relative `file:` database URLs point to the project root, so the app
 * and Mastra Studio open the same file. Remote URLs are returned unchanged.
 */
export function resolveDatabaseUrl(url: string, root: string = getProjectRoot()): string {
  if (!url.startsWith("file:")) return url;
  const filePath = url.slice("file:".length);
  if (filePath === ":memory:" || path.isAbsolute(filePath)) return url;
  // libSQL does not accept Windows backslashes in file URLs
  return `file:${path.join(/*turbopackIgnore: true*/ root, filePath).replaceAll("\\", "/")}`;
}
