// apps/admin/src/modules/admin/ArtistDetail.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from "../../shared/adminApiClient";

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

export default function ArtistDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [a, setA] = useState(null);
  const [saving, setSaving] = useState(false);

  // Translation states
  const [translations, setTranslations] = useState({});
  const [selectedLang, setSelectedLang] = useState('en');
  const [translationName, setTranslationName] = useState('');
  const [translationBio, setTranslationBio] = useState('');
  const [savingTranslation, setSavingTranslation] = useState(false);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,image/avif,image/svg+xml';

  async function handleUploadPortrait(file) {
    if (!file) return;
    setUploadErr('');
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('scope', 'artists');
      const { data } = await api.post('/api/v1/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const nextUrl = data?.url || data?.path || '';
      if (!nextUrl) throw new Error('Neplatná odpověď uploadu');
      setA({...a, portrait_url: nextUrl});
    } catch (error) {
      console.error('Upload error:', error);
      setUploadErr('Nahrávání selhalo. Zkus jiné URL nebo kontaktuj admina.');
    } finally {
      setUploadBusy(false);
    }
  }

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/admin/v1/artists/${id}`);
      setA(data);
    } finally {
      setLoading(false);
    }
    await loadTranslations();
  };

  const loadTranslations = async () => {
    try {
      const { data } = await api.get(`/api/admin/v1/artists/${id}/translations`);
      setTranslations(data || {});

      // Load current language translation if exists
      if (data[selectedLang]) {
        setTranslationName(data[selectedLang].name || '');
        setTranslationBio(data[selectedLang].bio || '');
      } else {
        setTranslationName('');
        setTranslationBio('');
      }
    } catch (err) {
      console.error('Failed to load translations:', err);
      setTranslations({});
    }
  };

  useEffect(() => { load(); }, [id]);

  // Load translation when language changes
  useEffect(() => {
    if (translations[selectedLang]) {
      setTranslationName(translations[selectedLang].name || '');
      setTranslationBio(translations[selectedLang].bio || '');
    } else {
      setTranslationName('');
      setTranslationBio('');
    }
  }, [selectedLang, translations]);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: a.name, slug: a.slug, bio: a.bio,
        portrait_url: a.portrait_url,
        website: a.website, instagram: a.instagram, facebook: a.facebook,
      };
      await api.patch(`/api/admin/v1/artists/${a.id}`, payload);
      await load();
      // Počkej chvíli na dokončení automatických překladů na pozadí, pak načti překlady
      setTimeout(async () => {
        await loadTranslations();
      }, 3000);
    } finally {
      setSaving(false);
    }
  };

  const onSaveTranslation = async (e) => {
    e.preventDefault();
    if (!translationName.trim()) {
      alert('Name is required');
      return;
    }
    setSavingTranslation(true);
    try {
      await api.post(`/api/admin/v1/artists/${id}/translations/${selectedLang}`, {
        name: translationName,
        bio: translationBio || null
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

  const onDelete = async () => {
    if (!confirm('Smazat umělce? (produkty zůstanou, jen bez přiřazení)')) return;
    await api.delete(`/api/admin/v1/artists/${a.id}`);
    nav('/admin/artists', { replace: true });
  };

  if (loading) return <div className="p-6">Načítám…</div>;
  if (!a) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/admin/artists" className="underline hover:opacity-80">← Zpět</Link>
        <button className="btn" onClick={onDelete}>Smazat</button>
      </div>

      <form className="card p-6 space-y-3" onSubmit={onSave}>
        <h2 className="text-lg font-semibold">Upravit umělce</h2>
        <div>
          <label className="block text-sm mb-1">Jméno</label>
          <input className="input" value={a.name} onChange={e=>setA({...a, name: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm mb-1">Slug</label>
          <input className="input" value={a.slug} onChange={e=>setA({...a, slug: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm mb-1">Portrét</label>
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <input
                type="file"
                accept={ACCEPT}
                onChange={(e)=>e.target.files?.[0] && handleUploadPortrait(e.target.files[0])}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 hover:file:bg-gray-50"
                disabled={uploadBusy}
              />
              {uploadBusy && <div className="text-xs text-gray-500 mt-1">Nahrávám…</div>}
              {uploadErr && <div className="text-xs text-red-600 mt-1">{uploadErr}</div>}
              <div className="text-xs text-gray-500 mt-1">
                Vyberte obrázek z počítače. Podporované formáty: PNG, JPEG, WebP, AVIF.
              </div>
            </div>
            {a.portrait_url && (
              <div className="flex-shrink-0">
                <div className="text-xs text-gray-500 mb-1">Náhled:</div>
                <img
                  src={a.portrait_url}
                  alt="Náhled portrétu"
                  className="h-32 w-32 object-cover rounded-lg border"
                  onError={(e)=>{ e.currentTarget.style.display='none'; }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Opravdu chcete smazat portrét?')) {
                      setA({...a, portrait_url: null});
                    }
                  }}
                  className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                >
                  Smazat portrét
                </button>
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Web</label>
          <input className="input" value={a.website || ''} onChange={e=>setA({...a, website: e.target.value})} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Instagram</label>
            <input className="input" value={a.instagram || ''} onChange={e=>setA({...a, instagram: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm mb-1">Facebook</label>
            <input className="input" value={a.facebook || ''} onChange={e=>setA({...a, facebook: e.target.value})} />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Bio</label>
          <textarea className="input min-h-[140px]" value={a.bio || ''} onChange={e=>setA({...a, bio: e.target.value})} />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
          <Link to="/admin/artists" className="btn">Zpět</Link>
        </div>
      </form>

      {/* Translations Section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Překlady</h3>
          <div className="text-xs text-blue-600 font-medium">
            ℹ️ Automatické překlady přes DeepSeek API se vytváří při uložení změn.
          </div>
        </div>

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
              Jméno ({AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name})
            </label>
            <input
              className="input w-full"
              value={translationName}
              onChange={(e) => setTranslationName(e.target.value)}
              placeholder={`Přeložené jméno v jazyce ${AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name}`}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              Bio ({AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name})
            </label>
            <textarea
              className="input w-full text-sm min-h-[140px] font-mono"
              value={translationBio}
              onChange={(e) => setTranslationBio(e.target.value)}
              placeholder={`Přeložené bio v jazyce ${AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name}`}
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
                      {translations[lang]?.name?.substring(0, 50)}
                      {translations[lang]?.name?.length > 50 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
