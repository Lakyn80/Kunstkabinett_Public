import { useEffect, useRef, useState } from "react";
import slugify from "./slugify";

/**
 * Auto-slug podle title, dokud uživatel "vědomě" neupraví slug ručně.
 * Vrací [slug, setSlug, slugTouched, setSlugTouched, onTitleChangeProxy]
 */
export default function useAutoSlug(initialTitle = "", initialSlug = "") {
  const [slug, setSlug] = useState(initialSlug || "");
  const [slugTouched, setSlugTouched] = useState(false);
  const lastTitleRef = useRef(initialTitle || "");

  // Když se titulek mění a slug není ručně upraven, přegeneruj
  const onTitleChangeProxy = (newTitle) => {
    lastTitleRef.current = newTitle;
    if (!slugTouched) {
      setSlug(slugify(newTitle));
    }
  };

  // Pokud inicializační slug/title dorazí později (edit formulář)
  useEffect(() => {
    if (!slugTouched && !slug && lastTitleRef.current) {
      setSlug(slugify(lastTitleRef.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [slug, setSlug, slugTouched, setSlugTouched, onTitleChangeProxy];
}
