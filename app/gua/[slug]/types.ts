export type AccountVariant = "main" | "active" | "flagged" | "private";

/** Plain, serialisable row the server hands to the client card. */
export type AccountView = {
  id: string;
  handle: string;
  /** Pre-formatted YYYY-MM-DD verification date. */
  verifiedAt: string;
  /** Live platform profile URL, or null when the row is flagged (no click-out). */
  profileUrl: string | null;
  variant: AccountVariant;
  flagged: boolean;
};

/** The four render buckets for the card. */
export type AccountGroups = {
  main: AccountView | null;
  active: AccountView[];
  flagged: AccountView[];
  private: AccountView[];
};
