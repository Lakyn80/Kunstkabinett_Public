import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import BlogCard from "@/components/BlogCard";
import { fetchPublishedPosts } from "@/data/blog";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/I18nProvider";
import { getLocaleForLang, pickByLang } from "@/i18n/config";

const BlogPage = () => {
  const { lang } = useI18n();
  const locale = getLocaleForLang(lang);
  const [activeTag, setActiveTag] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["blog", "published", lang],
    queryFn: () => fetchPublishedPosts(lang),
  });

  const allTags = useMemo(() => Array.from(new Set(data.flatMap((p) => p.tags))), [data]);
  const filtered = activeTag ? data.filter((p) => p.tags.includes(activeTag)) : data;
  const featured = filtered[0];
  const rest = filtered.slice(1);

  const title = pickByLang(lang, { cs: "Blog", en: "Journal", fr: "Journal", de: "Journal", ru: "Блог", zh: "博客", ja: "ブログ", it: "Blog", pl: "Blog" });
  const subtitle = pickByLang(lang, {
    cs: "Zajímavosti, rozhovory a průvodci ze světa umění.",
    en: "Insights, interviews, and guides from the art world.",
    fr: "Analyses, interviews et guides du monde de l'art.",
    de: "Einblicke, Interviews und Leitfäden aus der Kunstwelt.",
    ru: "Обзоры, интервью и гиды из мира искусства.",
    zh: "来自艺术世界的洞察、访谈与指南。",
    ja: "アート界のインサイト、インタビュー、ガイド。",
    it: "Approfondimenti, interviste e guide dal mondo dell'arte.",
    pl: "Artykuły, wywiady i przewodniki ze świata sztuki.",
  });
  const allLabel = pickByLang(lang, { cs: "Vše", en: "All", fr: "Tout", de: "Alle", ru: "Все", zh: "全部", ja: "すべて", it: "Tutto", pl: "Wszystko" });
  const loadingText = pickByLang(lang, { cs: "Načítám blog...", en: "Loading journal...", fr: "Chargement du journal...", de: "Journal wird geladen...", ru: "Загрузка блога...", zh: "正在加载博客...", ja: "ブログを読み込み中...", it: "Caricamento blog...", pl: "Ładowanie bloga..." });

  return (
    <Layout>
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-6">
          <SectionHeader title={title} subtitle={subtitle} />

          <div className="flex flex-wrap gap-2 mb-10">
            <button
              onClick={() => setActiveTag("")}
              className={`px-3 py-1 text-xs uppercase tracking-wider rounded-sm transition-colors ${
                !activeTag ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {allLabel}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag === activeTag ? "" : tag)}
                className={`px-3 py-1 text-xs uppercase tracking-wider rounded-sm transition-colors ${
                  activeTag === tag ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">{loadingText}</p>
          ) : (
            <>
              {featured && (
                <Link to={`/blog/${featured.slug}`} className="group block mb-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="aspect-[16/10] overflow-hidden bg-secondary/50">
                      <img
                        src={featured.coverImage}
                        alt={featured.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <time>{new Date(featured.publishedAt).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}</time>
                      </div>
                      <h2 className="font-serif text-2xl md:text-3xl text-foreground group-hover:text-accent transition-colors mb-4">{featured.title}</h2>
                      <p className="text-muted-foreground leading-relaxed">{featured.excerpt}</p>
                    </div>
                  </div>
                </Link>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {rest.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default BlogPage;
