import api, { absoluteBackendUrl } from "@/lib/api";

export type ArtworkCategory = "painting" | "sculpture" | "graphic";
export type ArtworkAvailability = "available" | "reserved" | "sold";

export interface Artwork {
  id: string;
  title: string;
  slug: string;
  artistSlug: string;
  artistName: string;
  category: ArtworkCategory;
  price: number;
  currency: string;
  availability: ArtworkAvailability;
  year: number;
  technique: string;
  materials: string;
  dimensions: string;
  description: string;
  images: string[];
  featured: boolean;
  createdAt: string;
}

interface BackendProduct {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  price?: number;
  stock?: number;
  available_stock?: number;
  category_id?: number | null;
  artist_id?: number | null;
  artist_name?: string | null;
  artist_slug?: string | null;
  image_url?: string | null;
  featured?: boolean | null;
  year?: number | null;
  technique?: string | null;
  materials?: string | null;
  dimensions?: string | null;
}

interface BackendCategory {
  id: number;
  name?: string;
  slug?: string;
}

interface BackendArtist {
  id: number;
  name?: string;
  slug?: string;
}

interface BackendProductsResponse {
  total?: number;
  limit?: number;
  offset?: number;
  items?: BackendProduct[];
}

function withLangParams(lang?: string, extra: Record<string, unknown> = {}) {
  if (!lang || lang === "cs") return extra;
  return { ...extra, lang };
}

function normalizeCategory(value: string): ArtworkCategory {
  const v = value.toLowerCase();
  if (v.includes("sculpt") || v.includes("statue") || v.includes("statu") || v.includes("socha") || v.includes("soch")) return "sculpture";
  if (v.includes("graph") || v.includes("graf") || v.includes("print")) return "graphic";
  return "painting";
}

function inferAvailability(item: BackendProduct): ArtworkAvailability {
  const available = Number(item.available_stock ?? item.stock ?? 0);
  const stock = Number(item.stock ?? 0);
  if (available > 0) return "available";
  if (stock > 0) return "reserved";
  return "sold";
}

async function fetchCategoriesMap(lang?: string): Promise<Map<number, string>> {
  try {
    const { data } = await api.get<BackendCategory[]>("/api/v1/categories/", {
      params: withLangParams(lang),
    });
    const rows = Array.isArray(data) ? data : [];
    return new Map(rows.map((row) => [row.id, row.slug || row.name || "painting"]));
  } catch {
    return new Map<number, string>();
  }
}

async function fetchArtistsMap(lang?: string): Promise<Map<number, { slug: string; name: string }>> {
  try {
    const limit = 200;
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

    return new Map(
      rows.map((row) => [
        row.id,
        {
          slug: row.slug || String(row.id),
          name: row.name || "Unknown artist",
        },
      ]),
    );
  } catch {
    return new Map<number, { slug: string; name: string }>();
  }
}

async function fetchAllProducts(lang?: string): Promise<BackendProduct[]> {
  const limit = 200;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  const all: BackendProduct[] = [];

  while (offset < total && offset < 1000) {
    const { data } = await api.get<BackendProductsResponse>("/api/v1/products/", {
      params: withLangParams(lang, { limit, offset }),
    });
    const items = Array.isArray(data?.items) ? data.items : [];
    total = Number(data?.total ?? items.length);
    all.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }

  return all;
}

function mapProduct(
  product: BackendProduct,
  categoriesById: Map<number, string>,
  artistsById: Map<number, { slug: string; name: string }>,
): Artwork {
  const fallbackArtistName = String(product.artist_name || "Unknown artist");
  const fallbackArtistSlug = String(product.artist_slug || product.artist_id || "unknown");
  const artistMeta = artistsById.get(Number(product.artist_id)) || {
    slug: fallbackArtistSlug,
    name: fallbackArtistName,
  };
  const categoryRaw = categoriesById.get(Number(product.category_id)) || "painting";
  const category = normalizeCategory(categoryRaw);
  const price = Number(product.price || 0);
  const mainImage = product.image_url ? absoluteBackendUrl(product.image_url) : "";
  const fallbackImage = "/uploads/products/ID_33_S.webp";

  return {
    id: String(product.id),
    title: product.title || "Untitled",
    slug: product.slug || String(product.id),
    artistSlug: artistMeta.slug,
    artistName: artistMeta.name,
    category,
    price,
    currency: "CZK",
    availability: inferAvailability(product),
    year: Number.isFinite(Number(product.year)) ? Number(product.year) : new Date().getFullYear(),
    technique: (product.technique || "Mixed media").trim(),
    materials: (product.materials || "On request").trim(),
    dimensions: (product.dimensions || "On request").trim(),
    description: (product.description || "").trim() || "Description is being prepared.",
    images: [mainImage || fallbackImage],
    featured: !!product.featured,
    createdAt: new Date(2000, 0, Number(product.id || 1)).toISOString(),
  };
}

async function loadMappedProducts(products: BackendProduct[], lang?: string): Promise<Artwork[]> {
  const [categoriesById, artistsById] = await Promise.all([fetchCategoriesMap(lang), fetchArtistsMap(lang)]);
  return products.map((row) => mapProduct(row, categoriesById, artistsById));
}

export async function fetchArtworks(lang?: string): Promise<Artwork[]> {
  const products = await fetchAllProducts(lang);
  const mapped = await loadMappedProducts(products, lang);
  return mapped.sort((a, b) => Number(b.id) - Number(a.id));
}

export async function fetchArtworkBySlug(slug: string, lang?: string): Promise<Artwork | null> {
  if (!slug) return null;
  const artworks = await fetchArtworks(lang);
  return artworks.find((item) => item.slug === slug) || null;
}

export async function fetchArtworksByArtist(artistSlug: string, lang?: string): Promise<Artwork[]> {
  if (!artistSlug) return [];

  const [artistRes, categoriesById, artistsById] = await Promise.all([
    api.get(`/api/v1/artists/${encodeURIComponent(artistSlug)}`, {
      params: withLangParams(lang),
    }),
    fetchCategoriesMap(lang),
    fetchArtistsMap(lang),
  ]);

  const artistId = Number(artistRes?.data?.id || 0);
  if (!artistId) return [];

  const { data } = await api.get<BackendProduct[]>(`/api/v1/artists/${encodeURIComponent(artistSlug)}/products`, {
    params: withLangParams(lang),
  });
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => mapProduct(row, categoriesById, artistsById));
}

export async function fetchFeaturedArtworks(limit = 8, lang?: string): Promise<Artwork[]> {
  const all = await fetchArtworks(lang);
  const featured = all.filter((item) => item.featured);
  if (!featured.length) {
    return all.slice(0, limit).map((item) => ({ ...item, featured: true }));
  }
  return featured.slice(0, limit).map((item) => ({ ...item, featured: true }));
}

export async function fetchArtworksByCategory(category: ArtworkCategory, lang?: string): Promise<Artwork[]> {
  const all = await fetchArtworks(lang);
  return all.filter((item) => item.category === category);
}
