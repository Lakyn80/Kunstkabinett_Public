export function normalizeArtistName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

export function getArtistNameParts(name) {
  const raw = normalizeArtistName(name);
  if (!raw) return { raw: "", given: "", surname: "" };

  if (raw.includes(",")) {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) {
      const surname = parts[0] || "";
      const given = parts.slice(1).join(" ").trim();
      return { raw, given, surname: surname || raw };
    }
  }

  const bits = raw.split(" ").filter(Boolean);
  if (bits.length <= 1) return { raw, given: "", surname: raw };
  const surname = bits.pop();
  return { raw, given: bits.join(" "), surname };
}

export function isUnknownArtistName(name, unknowns = []) {
  const raw = normalizeArtistName(name);
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return (unknowns || []).some((u) => String(u || "").trim().toLowerCase() === lower);
}

export function formatArtistDisplayName(name, { unknowns = [] } = {}) {
  const raw = normalizeArtistName(name);
  if (!raw) return "";
  if (isUnknownArtistName(raw, unknowns)) return raw;
  const { given, surname } = getArtistNameParts(raw);
  if (!surname) return raw;
  if (!given) return surname;
  return `${surname} ${given}`;
}

export function sortArtistsBySurname(list, getName, locale) {
  const items = Array.isArray(list) ? [...list] : [];
  const collator = new Intl.Collator(locale || undefined, { sensitivity: "base" });
  items.sort((a, b) => {
    const aName = getName ? getName(a) : a;
    const bName = getName ? getName(b) : b;
    const aParts = getArtistNameParts(aName);
    const bParts = getArtistNameParts(bName);
    const s = collator.compare(aParts.surname, bParts.surname);
    if (s !== 0) return s;
    return collator.compare(aParts.given, bParts.given);
  });
  return items;
}
