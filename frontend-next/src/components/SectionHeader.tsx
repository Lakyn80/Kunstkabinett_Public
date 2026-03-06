interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}

const SectionHeader = ({ title, subtitle, align = "left", className = "" }: SectionHeaderProps) => {
  return (
    <div className={`mb-10 md:mb-14 ${align === "center" ? "text-center" : ""} ${className}`}>
      <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-muted-foreground text-base md:text-lg max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionHeader;
