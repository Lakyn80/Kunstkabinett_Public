import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import BlogCard from "@/components/BlogCard";
import { fetchBlogPostBySlug, fetchPublishedPosts } from "@/data/blog";
import { useI18n } from "@/i18n/I18nProvider";
import { getLocaleForLang, pickByLang } from "@/i18n/config";

const BlogPostPage = () => {
  const { lang } = useI18n();
  const locale = getLocaleForLang(lang);
  const { slug = "" } = useParams<{ slug: string }>();

  const postQuery = useQuery({
    queryKey: ["blog", slug, lang],
    queryFn: () => fetchBlogPostBySlug(slug, lang),
    enabled: !!slug,
  });

  const listQuery = useQuery({
    queryKey: ["blog", "published", lang],
    queryFn: () => fetchPublishedPosts(lang),
  });

  const post = postQuery.data;
  const allPosts = useMemo(() => listQuery.data || [], [listQuery.data]);
  const postSlug = post?.slug || "";
  const postTags = post?.tags || [];

  const { prev, next, related } = useMemo(() => {
    if (!postSlug) return { prev: null, next: null, related: [] };
    const currentIndex = allPosts.findIndex((p) => p.slug === postSlug);
    const previous = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;
    const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
    const relatedPosts = allPosts
      .filter((p) => p.slug !== postSlug && p.tags.some((t) => postTags.includes(t)))
      .slice(0, 3);
    return { prev: previous, next: nextPost, related: relatedPosts };
  }, [allPosts, postSlug, postTags]);

  if (postQuery.isLoading) {
    return (
      <Layout>
        <div className="pt-32 container mx-auto px-6 py-20 text-muted-foreground">{pickByLang(lang, { en: "Loading post...", cs: "Načítám článek..." })}</div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="pt-32 container mx-auto px-6 text-center py-20">
          <h1 className="font-serif text-3xl mb-4">{pickByLang(lang, { en: "Post not found", cs: "Článek nebyl nalezen" })}</h1>
          <Link to="/blog" className="text-accent">
            ← {pickByLang(lang, { en: "Back to Journal", cs: "Zpět na blog" })}
          </Link>
        </div>
      </Layout>
    );
  }

  const readTime = Math.max(2, Math.ceil(post.content.split(/\s+/).length / 200));

  return (
    <Layout>
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-6">
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-accent transition-colors mb-8 inline-block">
            ← {pickByLang(lang, { en: "Back to Journal", cs: "Zpět na blog" })}
          </Link>

          <article className="max-w-3xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                <time>{new Date(post.publishedAt).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}</time>
                <span>·</span>
                <span>{readTime} {pickByLang(lang, { en: "min read", cs: "min čtení" })}</span>
              </div>
              <h1 className="font-serif text-3xl md:text-5xl text-foreground leading-tight mb-6">{post.title}</h1>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] uppercase tracking-widest bg-secondary text-secondary-foreground rounded-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="aspect-[2/1] overflow-hidden bg-secondary/50 mb-10">
              <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
            </div>

            <div className="prose prose-neutral max-w-none">
              {post.content.split("\n\n").map((paragraph, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>

          <div className="max-w-3xl mx-auto mt-16 flex justify-between border-t border-border pt-8">
            {prev ? (
              <Link to={`/blog/${prev.slug}`} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                ← {prev.title}
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link to={`/blog/${next.slug}`} className="text-sm text-muted-foreground hover:text-accent transition-colors text-right">
                {next.title} →
              </Link>
            ) : (
              <div />
            )}
          </div>

          {related.length > 0 && (
            <section className="mt-20">
              <h3 className="font-serif text-2xl mb-8 text-center">{pickByLang(lang, { en: "Related Articles", cs: "Podobné články" })}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
                {related.map((p) => (
                  <BlogCard key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default BlogPostPage;
