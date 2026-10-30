import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { kbArticles, type KbArticle, type TicketCategory } from "@/db/schema";
import { extractKeywords } from "@/lib/keywords";

const DEFAULT_LIMIT = 3;

// Tags are curated by the service desk, so a tag hit weighs more than a word
// that only shows up in the article body
const TITLE_WEIGHT = 3;
const TAG_WEIGHT = 3;
const CONTENT_WEIGHT = 1;

export type KbSearchQuery = {
  query: string;
  category?: TicketCategory;
  limit?: number;
};

export type KbSearchResult = KbArticle & {
  /** Relevance score; only articles with score > 0 are returned */
  score: number;
};

/** Help center articles. Public to every employee, no ownership checks. */
export function createKbService({ db }: { db: Database }) {
  return {
    async search({
      query,
      category,
      limit = DEFAULT_LIMIT,
    }: KbSearchQuery): Promise<KbSearchResult[]> {
      const keywords = extractKeywords(query);
      if (keywords.size === 0) return [];

      const articles = await db.query.kbArticles.findMany({
        where: category ? eq(kbArticles.category, category) : undefined,
      });

      return articles
        .map((article) => ({ ...article, score: scoreArticle(article, keywords) }))
        .filter((article) => article.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}

export type KbService = ReturnType<typeof createKbService>;

function scoreArticle(article: KbArticle, keywords: Set<string>): number {
  const title = extractKeywords(article.title);
  const tags = extractKeywords(article.tags.join(" "));
  const content = extractKeywords(article.content);

  let score = 0;
  for (const word of keywords) {
    if (title.has(word)) score += TITLE_WEIGHT;
    if (tags.has(word)) score += TAG_WEIGHT;
    if (content.has(word)) score += CONTENT_WEIGHT;
  }
  return score;
}
