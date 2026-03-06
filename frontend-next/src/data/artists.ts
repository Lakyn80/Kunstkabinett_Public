import api, { absoluteBackendUrl } from "@/lib/api";

export interface Artist {
  id: string;
  name: string;
  slug: string;
  bioShort: string;
  bioFull: string;
  portrait: string;
  country: string;
  productsCount: number;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
}

interface BackendArtist {
  id: number;
  name: string;
  slug: string;
  bio?: string | null;
  portrait_url?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  products_count?: number;
}

function withLangParams(lang?: string, extra: Record<string, unknown> = {}) {
  if (!lang || lang === "cs") return extra;
  return { ...extra, lang };
}

function shortBio(text: string): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "Artist profile is being prepared.";
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157).trimEnd()}...`;
}

function mapArtist(row: BackendArtist): Artist {
  const bio = (row.bio || "").trim();
  const portrait = row.portrait_url ? absoluteBackendUrl(row.portrait_url) : "";
  return {
    id: String(row.id),
    name: row.name || "Unknown artist",
    slug: row.slug || String(row.id),
    bioShort: shortBio(bio),
    bioFull: bio || "Detailed biography is being prepared.",
    portrait,
    country: "Czech Republic",
    productsCount: Number(row.products_count || 0),
    website: row.website || null,
    instagram: row.instagram || null,
    facebook: row.facebook || null,
  };
}

export async function fetchArtists(lang?: string): Promise<Artist[]> {
  const limit = 100;
  let offset = 0;
  const rows: BackendArtist[] = [];
  while (offset < 2000) {
    const { data } = await api.get<BackendArtist[]>("/api/v1/artists/", {
      params: withLangParams(lang, { limit, offset }),
    });
    const chunk = Array.isArray(data) ? data : [];
    rows.push(...chunk);
    if (chunk.length < limit) break;
    offset += limit;
  }
  return rows.map(mapArtist);
}

export async function fetchArtistBySlug(slug: string, lang?: string): Promise<Artist | null> {
  if (!slug) return null;
  try {
    const { data } = await api.get<BackendArtist>(`/api/v1/artists/${encodeURIComponent(slug)}`, {
      params: withLangParams(lang),
    });
    if (!data) return null;
    return mapArtist(data);
  } catch {
    return null;
  }
}
