export type AccountVariant = "main" | "active" | "flagged" | "private";

/** Plain, serialisable row the server hands to the client card. */
export type AccountView = {
  id: string;
  /** Platform-authoritative account id (lowercased handle for Threads) — scopes re-verify. */
  accountId: string;
  handle: string;
  /** Platform key (e.g. "threads") — drives the icon. */
  platform: string;
  /** Human label for the platform (e.g. "Threads"), from the adapter. */
  platformLabel: string;
  /** Pre-formatted YYYY-MM-DD verification date. */
  verifiedAt: string;
  /** Live platform profile URL, or null when the row is flagged (no click-out). */
  profileUrl: string | null;
  variant: AccountVariant;
  flagged: boolean;
  /** Trust state — drives the flagged-row warning wording (盜用 vs 停權). */
  condition: "active" | "banned" | "hacked";
};

/** The four render buckets for the card. */
export type AccountGroups = {
  main: AccountView | null;
  active: AccountView[];
  flagged: AccountView[];
  private: AccountView[];
};
