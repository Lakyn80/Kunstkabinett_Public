// Odstraní diakritiku, zmenší na lowercase, mezery a ne-alnum -> '-'
export default function slugify(input) {
  if (!input) return "";
  return input
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // diakritika
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")   // vše mimo a-z0-9 -> '-'
    .replace(/^-+|-+$/g, "")       // ořízni '-'
    .substring(0, 80);             // rozumný strop
}
