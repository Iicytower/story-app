// Pure parts of the home page rankings (D80, task 84); the database side is ranking-queries.ts.

export const RANKING_STORED = 30;
export const RANKING_SHOWN = 10;
export const RANKING_MAX_AGE_MS = 60 * 60 * 1000;
export const RANKING_LEASE_MS = 5 * 60 * 1000;
export const RANKING_WEEK_DAYS = 7;
// Books with fewer ratings are not ranked; also the weight of the global mean.
export const MIN_RATINGS = 5;

export interface ScoredBook {
  folderId: string;
  score: number;
}

// Pulls a book's mean towards the mean of all books, the less so the more ratings it has.
export function bayesianAverage(
  sum: number,
  count: number,
  globalMean: number,
  weight = MIN_RATINGS,
): number {
  return (globalMean * weight + sum) / (weight + count);
}

const byScore = (a: ScoredBook, b: ScoredBook) =>
  b.score - a.score || a.folderId.localeCompare(b.folderId);

// The global mean counts every book's ratings, also of books below the threshold.
export function rankTopRated(
  books: { folderId: string; count: number; sum: number }[],
): ScoredBook[] {
  const count = books.reduce((total, book) => total + book.count, 0);
  if (count === 0) return [];
  const globalMean = books.reduce((total, book) => total + book.sum, 0) / count;
  return books
    .filter((book) => book.count >= MIN_RATINGS)
    .map((book) => ({
      folderId: book.folderId,
      score: bayesianAverage(book.sum, book.count, globalMean),
    }))
    .toSorted(byScore);
}

export function rankByScore(books: ScoredBook[]): ScoredBook[] {
  return books.toSorted(byScore);
}

export function isRankingStale(computedAt: Date, now: Date): boolean {
  return now.getTime() - computedAt.getTime() >= RANKING_MAX_AGE_MS;
}
