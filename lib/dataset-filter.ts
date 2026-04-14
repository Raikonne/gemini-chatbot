export type FilterTier = "product" | "family" | "global";

export interface FilterResult {
  json: string;
  tier: FilterTier;
  matchedOn: string | null;
  hasOriginalText: boolean;
}

// Keep a safe margin under 1M tokens for system prompt + history + response
const TOKEN_BUDGET = 700_000;

function roughTokens(str: string): number {
  return Math.ceil(str.length / 4);
}

function stripReviewFields(products: any[], fields: string[]): any[] {
  return products.map(p => ({
    ...p,
    Enriched_Reviews: p.Enriched_Reviews?.map((r: any) => {
      const result = { ...r };
      for (const f of fields) delete result[f];
      return result;
    }),
  }));
}

function deduplicateReviews(products: any[]): any[] {
  const seenTexts = new Set<string>();
  return products.map(p => ({
    ...p,
    Enriched_Reviews: p.Enriched_Reviews?.filter((r: any) => {
      const key = r.original_text || r.reviewer_name || JSON.stringify(r);
      if (seenTexts.has(key)) return false;
      seenTexts.add(key);
      return true;
    }),
  }));
}

function buildPayload(products: any[]): { json: string; hasOriginalText: boolean } {
  // Deduplicate reviews shared across color/size variants before sending
  const deduped = deduplicateReviews(products);

  let json = JSON.stringify(deduped);
  if (roughTokens(json) <= TOKEN_BUDGET) {
    return { json, hasOriginalText: true };
  }

  // Strip original_text and reviewer_name — saves ~80% of token cost
  const stripped = stripReviewFields(deduped, ["original_text", "reviewer_name"]);
  json = JSON.stringify(stripped);
  return { json, hasOriginalText: false };
}

function matchIntent(
  dataset: any[],
  text: string,
): { products: any[]; tier: FilterTier; matchedOn: string } | null {
  const t = text.toLowerCase();

  // 1. Product_Code — 5 or 6 digit number
  const numMatches = [...t.matchAll(/\b(\d{5,6})\b/g)].map(m => parseInt(m[1]));
  if (numMatches.length > 0) {
    const byCode = dataset.filter(p => numMatches.includes(p.Product_Code));
    if (byCode.length > 0) {
      return { products: byCode, tier: byCode.length === 1 ? "product" : "family", matchedOn: `Product_Code: ${numMatches.join(", ")}` };
    }
  }

  // 2. Product_Family
  const families = [...new Set(dataset.map(p => p.Product_Family).filter(Boolean))] as string[];
  const matchedFamily = families
    .filter(f => t.includes(f.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  if (matchedFamily) {
    const matched = dataset.filter(p => p.Product_Family === matchedFamily);
    return { products: matched, tier: matched.length === 1 ? "product" : "family", matchedOn: `Product_Family: ${matchedFamily}` };
  }

  // 3. Product_Description — specific product name, longest match first
  const descMatches = dataset
    .map(p => ({ p, key: (p.Product_Description ?? "").toLowerCase() }))
    .filter(({ key }) => key && t.includes(key))
    .sort((a, b) => b.key.length - a.key.length);
  if (descMatches.length > 0) {
    const matched = descMatches.map(x => x.p);
    return { products: matched, tier: matched.length === 1 ? "product" : "family", matchedOn: "Product_Description" };
  }

  return null;
}

export function filterDataset(
  dataset: any[],
  currentMessage: string,
  recentMessages: string[],
): FilterResult {
  // Try current message first — gives explicit intent priority
  let match = matchIntent(dataset, currentMessage);

  // Fall back to recent history one message at a time (most recent first)
  // so a product change clears the old context instead of merging both
  if (!match) {
    for (const msg of recentMessages) {
      match = matchIntent(dataset, msg);
      if (match) break;
    }
  }

  if (match) {
    const { products, tier, matchedOn } = match;
    const { json, hasOriginalText } = buildPayload(products);
    return { json, tier, matchedOn, hasOriginalText };
  }

  // Global fallback — no product identified anywhere
  // original_text and reviewer_name are stripped to stay within context window
  const { json, hasOriginalText } = buildPayload(dataset);
  return { json, tier: "global", matchedOn: null, hasOriginalText };
}
