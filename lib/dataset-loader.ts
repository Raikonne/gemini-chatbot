interface CachedDataset {
  url: string;
  data: any[];
  loadedAt: number;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let _cache: CachedDataset | null = null;

export async function loadDataset(url: string): Promise<any[]> {
  const now = Date.now();
  if (_cache && _cache.url === url && now - _cache.loadedAt < CACHE_TTL) {
    return _cache.data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`);
  const data = await res.json();
  _cache = { url, data, loadedAt: now };
  return data;
}
