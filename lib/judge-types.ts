/** Shapes returned by /api/judge/* (shared by server and judge pages). */

export type WinnerRank = 1 | 2 | 3;

export type FeedItem = {
  id: string;
  code: string;
  categoryId: string;
  createdAt: string;
  weightLbs: number | null;
  teamName: string | null;
  hidden: boolean;
  winnerRank: WinnerRank | null;
  /** This judge's score, if they've voted. */
  myScore: number | null;
  avgScore: number | null;
  voteCount: number;
  /** Signed, short-lived. Thumbnail when available, else the full photo. */
  thumbUrl: string | null;
};

export type SubmissionDetail = FeedItem & {
  photoUrl: string | null;
  note: string | null;
  zone: string | null;
  lat: number | null;
  lng: number | null;
  isMinor: boolean;
  photoConsent: boolean;
  /** Only present for winners / runners-up. */
  contact: {
    name: string | null;
    phone: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
  } | null;
};

export const RANK_LABEL: Record<WinnerRank, string> = { 1: "🥇 Winner", 2: "🥈 2nd", 3: "🥉 3rd" };

/** Leaderboard order: average score, then vote count, then earliest entry. */
export function compareByScore(a: FeedItem, b: FeedItem): number {
  return (
    (b.avgScore ?? -1) - (a.avgScore ?? -1) ||
    b.voteCount - a.voteCount ||
    Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
}
