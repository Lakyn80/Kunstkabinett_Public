// apps/admin/src/modules/admin/ProductDetail.jsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api, { backendUrl } from "../../shared/adminApiClient";

// Funkce pro získání kurzu EUR z backend API
async function getEurRate() {
  try {
    const response = await fetch(backendUrl('/api/admin/v1/exchange-rate/eur'));

    if (!response.ok) {
      throw new Error(`Failed to fetch rate: ${response.status}`);
    }

    const data = await response.json();
    return data.rate || 25.0;
  } catch (error) {
    console.error('Error fetching EUR rate:', error);
    // Fallback na přibližný kurz
    return 25.0;
  }
}

// Helper pro získání správné URL pro média
// Použij relativní cestu přes Nginx proxy (ne přímý backend)
function getMediaUrl(url) {
  if (!url) return '';
  // Pokud už je absolutní URL, použij ji
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Jinak použij backend URL (funguje jak přes reverse proxy, tak v lokálním Next dev)
  return backendUrl(url.startsWith('/') ? url : `/${url}`);
}

function slugify(input) {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [price, setPrice] = useState('');
  const [priceEur, setPriceEur] = useState('');
  const [stock, setStock] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [eurRate, setEurRate] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true);
  const [description, setDescription] = useState('');
  const [year, setYear] = useState('');
  const [technique, setTechnique] = useState('');
  const [materials, setMaterials] = useState('');
  const [dimensions, setDimensions] = useState('');

  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [catErr, setCatErr] = useState('');

  const [artistId, setArtistId] = useState('');
  const [artistQuery, setArtistQuery] = useState('');
  const [artists, setArtists] = useState([]);
  const [artistLoading, setArtistLoading] = useState(false);

  const [media, setMedia] = useState([]);
  const [aiDescribeLoading, setAiDescribeLoading] = useState(false);
  const [aiDescribeErr, setAiDescribeErr] = useState('');
  const [aiImageKey, setAiImageKey] = useState('');
  const fileInputRef = useRef(null);

  // Translation states
  const [translations, setTranslations] = useState({});
  const [selectedLang, setSelectedLang] = useState('en');
  const [translationTitle, setTranslationTitle] = useState('');
  const [translationDescription, setTranslationDescription] = useState('');
  const [savingTranslation, setSavingTranslation] = useState(false);

  const AVAILABLE_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ru', name: 'Русский' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'it', name: 'Italiano' },
    { code: 'pl', name: 'Polski' }
  ];

  const setFormFrom = (data) => {
    setTitle(data.title || '');
    setSlug(data.slug || '');
    setPrice(data.price ?? '');
    setPriceEur(data.price_eur ?? '');
    setStock(data.stock ?? '');
    setIsActive(data.is_active ?? true);
    setFeatured(!!data.featured);
    setDescription(data.description || '');
    setYear(data.year == null ? '' : String(data.year));
    setTechnique(data.technique || '');
    setMaterials(data.materials || '');
    setDimensions(data.dimensions || '');
    setCategoryId(data.category_id == null ? '' : String(data.category_id));
    setArtistId(data.artist_id == null ? '' : String(data.artist_id));
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/admin/v1/products/${id}`);
      setFormFrom(data);
    } finally {
      setLoading(false);
    }
    await loadMedia();
    await loadTranslations();
  };

  const loadMedia = async () => {
    try {
      const { data } = await api.get(`/api/admin/v1/products/${id}/media`);
      setMedia(data.items || []);
    } catch {
      setMedia([]);
    }
  };

  const loadTranslations = async () => {
    try {
      const { data } = await api.get(`/api/admin/v1/products/${id}/translations`);
      setTranslations(data || {});

      // Load current language translation if exists
      if (data[selectedLang]) {
        setTranslationTitle(data[selectedLang].title || '');
        setTranslationDescription(data[selectedLang].description || '');
      }
    } catch (err) {
      console.error('Failed to load translations:', err);
      setTranslations({});
    }
  };

  const loadCategories = async () => {
    setCatErr('');
    try {
      const { data } = await api.get('/api/admin/v1/categories/', {
        params: { limit: 200, offset: 0 },
      });
      const items = data.items || data || [];
      setCategories(items);
    } catch {
      setCategories([]);
      setCatErr('Nelze načíst seznam kategorií – zkontroluj /api/admin/v1/categories/.');
    }
  };

  const loadArtists = async () => {
    setArtistLoading(true);
    try {
      const params = { limit: 50, offset: 0 };
      if (artistQuery.trim()) params.q = artistQuery.trim();
      const { data } = await api.get('/api/admin/v1/artists/', { params });
      setArtists(data.items || data || []);
    } catch {
      setArtists([]);
    } finally {
      setArtistLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
      await loadCategories();
      await loadArtists();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setAiImageKey('');
  }, [id]);

  // Načti kurz EUR při načtení komponenty
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoadingRate(true);
      try {
        const rate = await getEurRate();
        if (!ignore) setEurRate(rate);
      } catch (error) {
        console.error('Failed to load EUR rate:', error);
        if (!ignore) setEurRate(25.0); // Fallback
      } finally {
        if (!ignore) setLoadingRate(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (autoSlug) setSlug(slugify(title));
  }, [title, autoSlug]);

  // Load translation when language changes
  useEffect(() => {
    if (translations[selectedLang]) {
      setTranslationTitle(translations[selectedLang].title || '');
      setTranslationDescription(translations[selectedLang].description || '');
    } else {
      setTranslationTitle('');
      setTranslationDescription('');
    }
  }, [selectedLang, translations]);

  // Automatický přepočet CZK -> EUR při změně CZK ceny
  useEffect(() => {
    if (autoConvert && eurRate && price && !isNaN(parseFloat(price))) {
      const czkValue = parseFloat(price);
      if (czkValue > 0) {
        const eurValue = czkValue / eurRate;
        setPriceEur(eurValue.toFixed(2));
      }
    }
  }, [price, eurRate, autoConvert]);

  useEffect(() => { loadArtists(); /* eslint-disable-next-line */ }, [artistQuery]);

  const onSaveTranslation = async (e) => {
    e.preventDefault();
    if (!translationTitle.trim()) {
      alert('Title is required');
      return;
    }
    setSavingTranslation(true);
    try {
      await api.post(`/api/admin/v1/products/${id}/translations/${selectedLang}`, {
        title: translationTitle,
        description: translationDescription || null
      });
      await loadTranslations();
      alert('Translation saved successfully!');
    } catch (error) {
      console.error('Failed to save translation:', error);
      alert('Failed to save translation');
    } finally {
      setSavingTranslation(false);
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: title || null,
        slug: slug || null,
        price: price === '' ? null : Number(price),
        price_eur: priceEur === '' ? null : Number(priceEur),
        stock: stock === '' ? null : Number(stock),
        description: description || null,
        year: year === '' ? null : Number(year),
        technique: technique || null,
        materials: materials || null,
        dimensions: dimensions || null,
        category_id: categoryId ? Number(categoryId) : null,
        artist_id: artistId ? Number(artistId) : null,
        is_active: isActive,
        featured: featured,
      };
      await api.patch(`/api/admin/v1/products/${id}`, payload);
      await load();
      await loadCategories();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirm('Opravdu smazat tento produkt včetně médií?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/v1/products/${id}`);
      nav('/admin/products', { replace: true });
    } finally {
      setDeleting(false);
    }
  };

  const onUploadFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    try {
      const res = await fetch(backendUrl(`/api/admin/v1/products/${id}/media`), {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${localStorage.getItem('am_admin_token') || ''}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload selhal');
      await loadMedia();
      setAiImageKey('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      alert('Upload se nepovedl.');
    }
  };

  const onDeleteMedia = async (mid) => {
    if (!confirm('Smazat soubor?')) return;
    try {
      await api.delete(`/api/admin/v1/products/${id}/media/${mid}`);
      await loadMedia();
      setAiImageKey('');
    } catch {
      alert('Smazání se nepovedlo.');
    }
  };

  const onSlugChange = (e) => {
    setAutoSlug(false);
    setSlug(e.target.value);
  };

  const requestBaseDescription = async () => {
    const firstImage = (media || []).find((m) => m?.kind === 'image' && m?.url);
    if (!firstImage) {
      throw new Error('Produkt nemá nahranou žádnou fotku.');
    }

    const form = new FormData();
    form.append('image_url', firstImage.url);
    form.append('art_type', 'auto');
    form.append('save_to_rag', 'true');
    if (String(id || '').trim()) {
      form.append('product_id', String(id).trim());
    }
    const imageAssetKey = String(firstImage?.id ?? firstImage?.filename ?? '').trim();
    if (imageAssetKey) {
      form.append('image_asset_key', imageAssetKey);
    }

    const response = await fetch(backendUrl('/api/admin/v1/ai/art/describe-upload'), {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${localStorage.getItem('am_admin_token') || ''}` },
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data?.detail === 'string' ? data.detail : 'AI popis se nepodařilo získat.');
    }
    return data;
  };

  const requestRewrite = async (imageKey, mode) => {
    const response = await fetch(backendUrl('/api/admin/v1/ai/art/rewrite'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('am_admin_token') || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_key: imageKey,
        mode,
        save_to_rag: true,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data?.detail === 'string' ? data.detail : 'AI úprava popisu se nepodařila.');
    }
    return data;
  };

  const ensureAiImageKey = async () => {
    if (aiImageKey) return aiImageKey;
    const base = await requestBaseDescription();
    const key = String(base?.image_key || '').trim();
    if (!key) throw new Error('AI nevrátilo image_key.');
    setAiImageKey(key);
    if (!title.trim() && typeof base?.title === 'string' && base.title.trim()) {
      setTitle(base.title.trim());
    }
    return key;
  };

  const onAiDescribeFromFirstPhoto = async () => {
    setAiDescribeLoading(true);
    setAiDescribeErr('');
    try {
      if (!aiImageKey) {
        const base = await requestBaseDescription();
        const key = String(base?.image_key || '').trim();
        if (!key) throw new Error('AI nevrátilo image_key.');
        setAiImageKey(key);
        if (!title.trim() && typeof base?.title === 'string' && base.title.trim()) {
          setTitle(base.title.trim());
        }
        if (typeof base?.description === 'string' && base.description.trim()) {
          setDescription(base.description.trim());
        }
      } else {
        const rewritten = await requestRewrite(aiImageKey, 'regenerate');
        if (typeof rewritten?.description === 'string' && rewritten.description.trim()) {
          setDescription(rewritten.description.trim());
        }
      }
    } catch (e) {
      setAiDescribeErr(e?.message || 'AI popis se nepodařilo získat.');
    } finally {
      setAiDescribeLoading(false);
    }
  };

  const onShortenDescription = async () => {
    setAiDescribeErr('');
    setAiDescribeLoading(true);
    try {
      const key = await ensureAiImageKey();
      const rewritten = await requestRewrite(key, 'shorten');
      if (typeof rewritten?.description === 'string' && rewritten.description.trim()) {
        setDescription(rewritten.description.trim());
      }
    } catch (e) {
      setAiDescribeErr(e?.message || 'AI úprava popisu se nepodařila.');
    } finally {
      setAiDescribeLoading(false);
    }
  };

  const onMarketingDescription = async () => {
    setAiDescribeErr('');
    setAiDescribeLoading(true);
    try {
      const key = await ensureAiImageKey();
      const rewritten = await requestRewrite(key, 'marketing');
      if (typeof rewritten?.description === 'string' && rewritten.description.trim()) {
        setDescription(rewritten.description.trim());
      }
    } catch (e) {
      setAiDescribeErr(e?.message || 'AI úprava popisu se nepodařila.');
    } finally {
      setAiDescribeLoading(false);
    }
  };

  const onLyricDescription = async () => {
    setAiDescribeErr('');
    setAiDescribeLoading(true);
    try {
      const key = await ensureAiImageKey();
      const rewritten = await requestRewrite(key, 'lyric');
      if (typeof rewritten?.description === 'string' && rewritten.description.trim()) {
        setDescription(rewritten.description.trim());
      }
    } catch (e) {
      setAiDescribeErr(e?.message || 'AI úprava popisu se nepodařila.');
    } finally {
      setAiDescribeLoading(false);
    }
  };

  if (loading) return <div className="p-6">Načítám…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <Link to="/admin/products" className="underline hover:opacity-80">← Zpět na seznam</Link>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={onDelete} disabled={deleting}>
            {deleting ? 'Mažu…' : 'Smazat produkt'}
          </button>
        </div>
      </div>

      <form className="card p-6 space-y-4" onSubmit={onSave}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Produkt #{id}</h2>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Ukládám…' : 'Uložit změny'}
          </button>
        </div>

        <div>
          <label className="block text-sm mb-1">Kategorie</label>
          {categories.length > 0 ? (
            <select
              className="input w-full max-w-lg"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">(bez kategorie)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || c.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <div className="text-sm text-gray-600"><i>(žádná kategorie)</i></div>
              {catErr && <div className="text-xs text-red-600 mt-1">{catErr}</div>}
            </>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1">Umělec</label>
          <div className="flex items-center gap-2 max-w-xl">
            <input
              className="input flex-1"
              placeholder="Hledej umělce podle jména…"
              value={artistQuery}
              onChange={(e)=>setArtistQuery(e.target.value)}
            />
            <select
              className="input w-72"
              value={artistId}
              onChange={(e)=>setArtistId(e.target.value)}
            >
              <option value="">(bez umělce)</option>
              {artists.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          {artistLoading && <div className="text-xs text-gray-500 mt-1">Načítám umělce…</div>}
          <div className="text-xs text-gray-500 mt-1">Nech prázdné pro uložení <i>null</i>.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Název</label>
            <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mramorová socha…" />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm mb-1">Slug</label>
              <label className="flex items-center gap-2 text-xs select-none">
                <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} />
                auto z názvu
              </label>
            </div>
            <input className="input w-full" value={slug} onChange={onSlugChange} placeholder="mramorova-socha" />
            <div className="text-xs text-gray-500 mt-1">
              Krátký URL název. Při zapnutém „auto z názvu“ se generuje automaticky.
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1">Cena (CZK)</label>
              <input className="input w-full" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm">Cena (EUR) - volitelné</label>
                <label className="flex items-center gap-2 text-xs select-none">
                  <input 
                    type="checkbox" 
                    checked={autoConvert} 
                    onChange={(e) => setAutoConvert(e.target.checked)} 
                  />
                  auto
                </label>
              </div>
              <div className="flex gap-2">
                <input 
                  className="input w-full flex-1" 
                  type="number" 
                  step="0.01" 
                  value={priceEur} 
                  onChange={(e) => {
                    setPriceEur(e.target.value);
                    setAutoConvert(false);
                  }} 
                  placeholder="0.00" 
                />
                {eurRate && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (price && !isNaN(parseFloat(price))) {
                        setLoadingRate(true);
                        try {
                          const rate = await getEurRate();
                          setEurRate(rate);
                          const eurValue = parseFloat(price) / rate;
                          setPriceEur(eurValue.toFixed(2));
                          setAutoConvert(true);
                        } catch (error) {
                          console.error('Failed to refresh rate:', error);
                        } finally {
                          setLoadingRate(false);
                        }
                      }
                    }}
                    className="px-2 py-1 text-xs rounded border hover:bg-gray-50 whitespace-nowrap"
                    disabled={loadingRate || !price}
                    title="Obnovit kurz a přepočítat"
                  >
                    {loadingRate ? '…' : '🔄'}
                  </button>
                )}
              </div>
              {eurRate && (
                <div className="text-[11px] text-gray-500 mt-1">
                  Kurz: 1 EUR = {eurRate.toFixed(2)} CZK
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1">Sklad</label>
              <input className="input w-full" type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Rok</label>
              <input className="input w-full" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" />
            </div>
            <div>
              <label className="block text-sm mb-1">Technika</label>
              <input className="input w-full" value={technique} onChange={(e) => setTechnique(e.target.value)} placeholder="Kombinovaná technika" />
            </div>
            <div>
              <label className="block text-sm mb-1">Materiály</label>
              <input className="input w-full" value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="Na vyžádání" />
            </div>
            <div>
              <label className="block text-sm mb-1">Rozměry</label>
              <input className="input w-full" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="Na vyžádání" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Aktivní produkt (zobrazí se na eshopu)</span>
            </label>
            <div className="text-[11px] text-gray-500 mt-1 ml-6">
              Neaktivní produkty zůstanou v databázi a na skladě, ale nebudou se zobrazovat na eshopu.
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Vybraná díla (zobrazit na homepage)</span>
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Popis (HTML / prostý text)</label>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                onClick={onShortenDescription}
                disabled={aiDescribeLoading}
              >
                Zkrátit popis
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2 text-sm font-medium text-orange-800 shadow-sm transition hover:from-orange-100 hover:to-amber-100"
                onClick={onMarketingDescription}
                disabled={aiDescribeLoading}
              >
                Více marketingový popis
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-pink-50 px-3 py-2 text-sm font-medium text-fuchsia-800 shadow-sm transition hover:from-fuchsia-100 hover:to-pink-100"
                onClick={onLyricDescription}
                disabled={aiDescribeLoading}
              >
                Více lyrický popis
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onAiDescribeFromFirstPhoto}
                disabled={aiDescribeLoading}
              >
                {aiDescribeLoading ? 'AI analyzuje…' : 'Vygenerovat nový popis'}
              </button>
              <span className="text-xs text-gray-500">Nový popis používá první nahranou fotku produktu.</span>
            </div>
            {aiDescribeErr && <div className="text-red-600 text-sm mb-2">{aiDescribeErr}</div>}
            <textarea 
              className="input w-full text-sm min-h-[220px] font-mono" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sem vlož HTML tagy nebo čistý text…"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Vložené HTML se zobrazí na webu 1:1.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end mt-2">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Ukládám…' : 'Uložit změny'}
          </button>
        </div>
      </form>

      {/* Translations Section */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-lg mb-4">Překlady</h3>

        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-medium">Vyberte jazyk:</label>
          <select
            className="input w-64"
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
          >
            {AVAILABLE_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name} ({lang.code})
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={onSaveTranslation} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">
              Název ({AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name})
            </label>
            <input
              className="input w-full"
              value={translationTitle}
              onChange={(e) => setTranslationTitle(e.target.value)}
              placeholder={`Přeložený název v jazyce ${AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name}`}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              Popis ({AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name})
            </label>
            <textarea
              className="input w-full text-sm min-h-[220px] font-mono"
              value={translationDescription}
              onChange={(e) => setTranslationDescription(e.target.value)}
              placeholder={`Přeložený popis v jazyce ${AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name}`}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {translations[selectedLang] ?
                'Překlad existuje - kliknutím na "Uložit překlad" aktualizujete.' :
                'Překlad neexistuje - kliknutím na "Uložit překlad" vytvoříte nový.'}
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={savingTranslation}
            >
              {savingTranslation ? 'Ukládám…' : 'Uložit překlad'}
            </button>
          </div>
        </form>

        {/* Existing translations list */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-medium text-sm mb-3">Existující překlady:</h4>
          <div className="space-y-2">
            {Object.keys(translations).filter(lang => lang !== 'cs').length === 0 ? (
              <div className="text-sm text-gray-500">Zatím žádné překlady.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.keys(translations).filter(lang => lang !== 'cs').map(lang => (
                  <div key={lang} className="border rounded p-3 text-sm">
                    <div className="font-medium">
                      {AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name || lang} ({lang})
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {translations[lang]?.title?.substring(0, 50)}
                      {translations[lang]?.title?.length > 50 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Média</h3>
          <input ref={fileInputRef} type="file" multiple onChange={onUploadFiles} className="block" />
        </div>

        {media.length === 0 ? (
          <div className="text-sm text-gray-500">Žádné nahrané soubory.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {media.map(m => (
              <div key={m.id} className="border rounded p-2 flex flex-col gap-2">
                <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden rounded relative">
                  {m.kind === 'image' ? (
                    <>
                      <img 
                        src={getMediaUrl(m.url)} 
                        alt={m.filename} 
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          // Fallback pokud se obrázek nenačte
                          e.target.style.display = 'none';
                          const fallback = e.target.parentElement.querySelector('.media-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="media-fallback hidden absolute inset-0 items-center justify-center text-xs text-gray-600 p-2">
                        Obrázek: {m.filename}
                      </div>
                    </>
                  ) : m.kind === 'video' ? (
                    <video controls className="w-full h-full">
                      <source src={getMediaUrl(m.url)} type={m.mime || 'video/mp4'} />
                    </video>
                  ) : (
                    <div className="text-xs text-gray-600 p-2">Soubor: {m.filename}</div>
                  )}
                </div>
                <div className="text-xs break-all">{m.filename}</div>
                <button className="btn" onClick={() => onDeleteMedia(m.id)}>Smazat</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
