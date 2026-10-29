const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "da", "do", "das", "dos", "em",
  "no", "na", "nos", "nas", "para", "pra", "por", "com", "sem", "que", "e",
  "ou", "meu", "minha", "meus", "minhas", "nao", "esta", "estou", "apos",
  "depois", "muito", "mais", "ao", "aos", "se", "foi", "ser", "tem", "ta",
]);

/** Normalized Portuguese keywords: no accents, stopwords or short words. */
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
