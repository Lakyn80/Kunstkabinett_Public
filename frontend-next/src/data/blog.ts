import api, { absoluteBackendUrl } from "@/lib/api";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  authorName: string;
  publishedAt: string;
  tags: string[];
  status: "draft" | "published";
}

interface BackendBlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  content_html?: string | null;
  cover_url?: string | null;
  published_at?: string | null;
  status?: string | null;
}

interface BackendBlogResponse {
  items?: BackendBlogPost[];
}

function withLangParams(lang?: string) {
  if (!lang || lang === "cs") return undefined;
  return { lang };
}

function cleanText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function deriveTags(post: BackendBlogPost): string[] {
  const source = `${post.title || ""} ${post.content || ""}`.toLowerCase();
  const tags = new Set<string>();
  if (source.includes("artist")) tags.add("artists");
  if (source.includes("collect")) tags.add("collecting");
  if (source.includes("exhibit")) tags.add("exhibitions");
  if (source.includes("guide")) tags.add("guides");
  if (tags.size === 0) tags.add("journal");
  return Array.from(tags).slice(0, 3);
}

function mapBlogPost(post: BackendBlogPost): BlogPost {
  const content = cleanText(post.content_html || post.content || "");
  const excerpt = cleanText(post.excerpt || content).slice(0, 220).trim();
  const coverImage = post.cover_url ? absoluteBackendUrl(post.cover_url) : "";
  return {
    id: String(post.id),
    title: post.title || "Untitled",
    slug: post.slug || String(post.id),
    excerpt: excerpt || "Article preview is being prepared.",
    content: content || "Article content is not available yet.",
    coverImage:
      coverImage ||
      "/placeholder.svg",
    authorName: "Kunstkabinett",
    publishedAt: post.published_at || new Date().toISOString(),
    tags: deriveTags(post),
    status: post.status === "draft" ? "draft" : "published",
  };
}

export async function fetchPublishedPosts(lang?: string): Promise<BlogPost[]> {
  const { data } = await api.get<BackendBlogResponse>("/api/v1/blog/", {
    params: withLangParams(lang),
  });
  const rows = Array.isArray(data?.items) ? data.items : [];
  return rows.map(mapBlogPost);
}

export async function fetchBlogPostBySlug(slug: string, lang?: string): Promise<BlogPost | null> {
  if (!slug) return null;
  try {
    const { data } = await api.get<BackendBlogPost>(`/api/v1/blog/${encodeURIComponent(slug)}`, {
      params: withLangParams(lang),
    });
    if (!data) return null;
    return mapBlogPost(data);
  } catch {
    return null;
  }
}
