// src/modules/admin/ProductNew.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
    // Fallback na přibližný kurz (např. 25 CZK za 1 EUR)
    return 25.0;
  }
}

function slugify(input) {
  return (input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default function ProductNew() {
  const nav = useNavigate();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [priceEur, setPriceEur] = useState('');
  const [stock, setStock] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [eurRate, setEurRate] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true);

  const [artistQuery, setArtistQuery] = useState('');
  const [artistId, setArtistId] = useState('');
  const [artists, setArtists] = useState([]);
  const [artistLoading, setArtistLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // NOVÉ: lokální výběr souborů pro upload po vytvoření
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [aiImageKey, setAiImageKey] = useState('');

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

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

  useEffect(() => {
    let ignore = false;
    (async () => {
      setArtistLoading(true);
      try {
        const params = { limit: 20, offset: 0 };
        if (artistQuery.trim()) params.q = artistQuery.trim();
        const { data } = await api.get('/api/admin/v1/artists/', { params });
        if (!ignore) setArtists(data.items || data || []);
      } catch {
        if (!ignore) setArtists([]);
      } finally {
        if (!ignore) setArtistLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [artistQuery]);

  const canSubmit = useMemo(() => {
    return title.trim() && slug.trim() && price !== '' && Number(price) >= 0 && Number.isFinite(Number(price));
  }, [title, slug, price]);

  async function uploadMedia(productId) {
    if (!files.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      const res = await fetch(backendUrl(`/api/admin/v1/products/${productId}/media`), {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${localStorage.getItem('am_admin_token') || ''}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload selhal');
    } finally {
      setUploading(false);
    }
  }

  async function requestBaseDescription() {
    if (!files.length) {
      throw new Error('Nejprve vyber alespoň 1 fotku.');
    }

    const form = new FormData();
    form.append('image', files[0]);
    form.append('art_type', 'auto');
    form.append('save_to_rag', 'true');
    const imageAssetKey = String(files?.[0]?.name || '').trim();
    if (imageAssetKey) {
      form.append('image_asset_key', imageAssetKey);
    }

    const res = await fetch(backendUrl('/api/admin/v1/ai/art/describe-upload'), {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${localStorage.getItem('am_admin_token') || ''}` },
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data?.detail === 'string' ? data.detail : 'Nepodařilo se získat AI popis.');
    }
    return data;
  }

  async function requestRewrite(imageKey, mode) {
    const res = await fetch(backendUrl('/api/admin/v1/ai/art/rewrite'), {
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data?.detail === 'string' ? data.detail : 'AI úprava popisu se nepodařila.');
    }
    return data;
  }

  async function ensureAiImageKey() {
    if (aiImageKey) return aiImageKey;
    const base = await requestBaseDescription();
    const key = String(base?.image_key || '').trim();
    if (!key) throw new Error('AI nevrátilo image_key.');
    setAiImageKey(key);
    if (!title.trim() && typeof base?.title === 'string' && base.title.trim()) {
      setTitle(base.title.trim());
    }
    return key;
  }

  async function fillByAiFromFirstImage() {
    setAiLoading(true);
    setAiErr('');
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
      setAiErr(e?.message || 'Nepodařilo se získat AI popis.');
    } finally {
      setAiLoading(false);
    }
  }

  const onShortenDescription = async () => {
    setAiErr('');
    setAiLoading(true);
    try {
      const key = await ensureAiImageKey();
      const rewritten = await requestRewrite(key, 'shorten');
      if (typeof rewritten?.description === 'string' && rewritten.description.trim()) {
        setDescription(rewritten.description.trim());
      }
    } catch (e) {
      setAiErr(e?.message || 'AI úprava popisu se nepodařila.');
    } finally {
      setAiLoading(false);
    }
  };

  const onMarketingDescription = async () => {
    setAiErr('');
    setAiLoading(true);
    try {
      const key = await ensureAiImageKey();
      const rewritten = await requestRewrite(key, 'marketing');
      if (typeof rewritten?.description === 'string' && rewritten.description.trim()) {
        setDescription(rewritten.description.trim());
      }
    } catch (e) {
      setAiErr(e?.message || 'AI úprava popisu se nepodařila.');
    } finally {
      setAiLoading(false);
    }
  };

  const onLyricDescription = async () => {
    setAiErr('');
    setAiLoading(true);
    try {
      const key = await ensureAiImageKey();
      const rewritten = await requestRewrite(key, 'lyric');
      if (typeof rewritten?.description === 'string' && rewritten.description.trim()) {
        setDescription(rewritten.description.trim());
      }
    } catch (e) {
      setAiErr(e?.message || 'AI úprava popisu se nepodařila.');
    } finally {
      setAiLoading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setErr('');
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        price: Number(price),
        price_eur: priceEur !== '' ? Number(priceEur) : null,
        stock: Number(stock) || 0,
        artist_id: artistId ? Number(artistId) : null,
        is_active: isActive,
        featured: featured,
      };

      const { data } = await api.post('/api/admin/v1/products/', payload);
      const newId = data?.id;

      if (newId) {
        // NOVÉ: po vytvoření rovnou nahraj vybrané soubory
        await uploadMedia(newId);
        nav(`/admin/products/${newId}`, { replace: true });
      } else {
        nav('/admin/products', { replace: true });
      }
    } catch (e) {
      let msg = 'Nepodařilo se vytvořit produkt.';
      const detail = e?.response?.data?.detail;
      if (typeof detail === 'string') msg = detail;
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nový produkt</h1>
        <Link to="/admin/products" className="btn">← Zpět na seznam</Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Název</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Např. Abstraktní obraz 50×70"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Slug</label>
              <input
                className="input"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                placeholder="abstraktni-obraz-50x70"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Umělec (volitelné)</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Hledej umělce podle jména…"
                  value={artistQuery}
                  onChange={(e)=>setArtistQuery(e.target.value)}
                />
                <select
                  className="input w-64"
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
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1">Cena (CZK)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
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
                  type="number"
                  min="0"
                  step="0.01"
                  className="input flex-1"
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
              <label className="block text-sm mb-1">Sklad (ks)</label>
              <input
                type="number"
                min="0"
                step="1"
                className="input"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
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

          <div>
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

          <div>
            <label className="block text-sm mb-1">Popis (HTML / prostý text)</label>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                onClick={onShortenDescription}
                disabled={aiLoading}
              >
                Zkrátit popis
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2 text-sm font-medium text-orange-800 shadow-sm transition hover:from-orange-100 hover:to-amber-100"
                onClick={onMarketingDescription}
                disabled={aiLoading}
              >
                Více marketingový popis
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-pink-50 px-3 py-2 text-sm font-medium text-fuchsia-800 shadow-sm transition hover:from-fuchsia-100 hover:to-pink-100"
                onClick={onLyricDescription}
                disabled={aiLoading}
              >
                Více lyrický popis
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={fillByAiFromFirstImage}
                disabled={!files.length || aiLoading}
              >
                {aiLoading ? 'AI analyzuje…' : 'Vygenerovat nový popis'}
              </button>
              <span className="text-xs text-gray-500">Nový popis využije první vybranou fotku.</span>
            </div>
            {aiErr && <div className="text-red-600 text-sm mb-2">{aiErr}</div>}
            <textarea
              className="input text-sm min-h-[220px] font-mono"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sem vlož HTML tagy nebo čistý text…"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Vložené HTML se zobrazí na webu 1:1.
            </div>
          </div>
        </div>

        {/* NOVÉ: výběr fotek pro nahrání po vytvoření */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Fotky / soubory (volitelné)</label>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.avif"
            className="block"
            onChange={(e) => {
              setFiles(Array.from(e.target.files || []));
              setAiImageKey('');
            }}
          />
          {files.length > 0 && (
            <div className="text-xs text-gray-600">
              Vybráno: {files.length} souborů. Nahraje se po vytvoření produktu.
            </div>
          )}
          <div className="text-xs text-gray-500">Pro AI nový popis vyber alespoň 1 fotku.</div>
        </div>

        {err && <div className="text-red-600 text-sm">{err}</div>}

        <div className="flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={!canSubmit || loading || uploading}>
            {loading ? 'Vytvářím…' : uploading ? 'Nahrávám soubory…' : 'Vytvořit produkt'}
          </button>
          <Link to="/admin/products" className="btn">Zrušit</Link>
        </div>
      </form>
    </div>
  );
}
