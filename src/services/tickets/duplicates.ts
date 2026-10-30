import type { TicketCategory } from "@/db/schema";
import { extractKeywords } from "@/lib/keywords";

// Share of the shorter title's keywords that must appear in the other title
const SIMILARITY_THRESHOLD = 0.5;

export function titleSimilarity(a: string, b: string): number {
  const wordsA = extractKeywords(a);
  const wordsB = extractKeywords(b);
  const smaller = Math.min(wordsA.size, wordsB.size);
  if (smaller === 0) return 0;
  const shared = [...wordsA].filter((word) => wordsB.has(word)).length;
  return shared / smaller;
}

/**
 * Two tickets describe the same problem when they share the category and
 * most of the title keywords.
 */
export function isSameProblem(
  candidate: { title: string; category: TicketCategory },
  existing: { title: string; category: TicketCategory },
): boolean {
  return (
    candidate.category === existing.category &&
    titleSimilarity(candidate.title, existing.title) >= SIMILARITY_THRESHOLD
  );
}
