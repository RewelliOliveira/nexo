import type { TicketCategory } from "@/db/schema";

// Share of the shorter title's keywords that must appear in the other title
const SIMILARITY_THRESHOLD = 0.5;

const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "da", "do", "das", "dos", "em",
  "no", "na", "nos", "nas", "para", "pra", "por", "com", "sem", "que", "e",
  "ou", "meu", "minha", "meus", "minhas", "nao", "esta", "estou", "apos",
  "depois", "muito", "mais", "ao", "aos", "se", "foi", "ser", "tem", "ta",
]);

export function extractKeywords(text: string): Set<string> {
  const words = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
    // Naive plural folding: "senhas" and "senha" count as the same word
    .map((word) => (word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word));
  return new Set(words);
}

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
