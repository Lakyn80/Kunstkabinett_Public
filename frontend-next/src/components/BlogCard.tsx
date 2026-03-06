import { Link } from "react-router-dom";
import { type BlogPost } from "@/data/blog";
import { useI18n } from "@/i18n/I18nProvider";
import { getLocaleForLang, pickByLang } from "@/i18n/config";

interface BlogCardProps {
  post: BlogPost;
}

const BlogCard = ({ post }: BlogCardProps) => {
  const { lang } = useI18n();
  const locale = getLocaleForLang(lang);
  const readTime = Math.max(2, Math.ceil(post.content.split(/\s+/).length / 200));
  const cover =
    post.coverImage ||
    "/placeholder.svg";
  const readLabel = pickByLang(lang, {
    en: "min read",
    cs: "min čtení",
    fr: "min de lecture",
    de: "Min. Lesezeit",
    ru: "мин чтения",
    zh: "分钟阅读",
    ja: "分で読める",
    it: "min di lettura",
    pl: "min czytania",
  });

  return (
    <Link to={`/blog/${post.slug}`} className="group block">
      <div className="relative overflow-hidden aspect-[16/10] bg-secondary/50">
        <img
          src={cover}
          alt={post.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <time>{new Date(post.publishedAt).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}</time>
          <span>·</span>
          <span>{readTime} {readLabel}</span>
        </div>
        <h3 className="font-serif text-lg text-foreground group-hover:text-accent transition-colors duration-200 line-clamp-2">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
      </div>
    </Link>
  );
};

export default BlogCard;
