// apps/admin/src/modules/admin/ArtistNew.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from "../../shared/adminApiClient";
import useAutoSlug from '../../shared/useAutoSlug';

function ensureHttps(url) {
  if (!url) return '';
  let u = String(url).trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return 'https://' + u;
}
function normalizeInstagram(input) {
  let v = (input || '').trim();
  if (!v) return '';
  v = v.replace(/^@+/, '');
  const m = v.match(/^https?:\/\/(www\.)?instagram\.com\/([^/?#]+)\/?/);
  if (m) return `https://instagram.com/${m[2]}`;
  return `https://instagram.com/${v}`;
}
function normalizeFacebook(input) {
  let v = (input || '').trim();
  if (!v) return '';
  const m = v.match(/^https?:\/\/(www\.)?facebook\.com\/([^/?#]+)\/?/);
  if (m) return `https://facebook.com/${m[2]}`;
  return `https://facebook.com/${v}`;
}
const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,image/avif,image/svg+xml';

export default function ArtistNew() {
  const nav = useNavigate();

  const [name, setName] = useState('');
  const [slug, setSlug, slugTouched, setSlugTouched, onTitleChangeProxy] = useAutoSlug('', '');
  const [bio, setBio] = useState('');

  const [portraitUrl, setPortraitUrl] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');

  const onNameChange = (v) => { setName(v); onTitleChangeProxy(v); };
  const onSlugChange = (v) => { if (!slugTouched) setSlugTouched(true); setSlug(v); };

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
      setPortraitUrl(nextUrl);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadErr('Nahrávání selhalo. Zkus jiné URL nebo kontaktuj admina.');
    } finally {
      setUploadBusy(false);
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    const websiteNorm = ensureHttps(website);
    const instagramNorm = normalizeInstagram(instagram);
    const facebookNorm = normalizeFacebook(facebook);

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      bio: bio || null,
      portrait_url: (portraitUrl || '').trim() || null,
      website: websiteNorm || null,
      instagram: instagramNorm || null,
      facebook: facebookNorm || null,
    };

    const { data } = await api.post('/api/admin/v1/artists/', payload);
    // Počkej chvíli na dokončení automatických překladů na pozadí
    setTimeout(() => {
      nav(`/admin/artists/${data.id}`, { replace: true });
    }, 2000);
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nový umělec</h1>
        <Link to="/admin/artists" className="btn">Zpět</Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Jméno</label>
            <input
              className="input"
              value={name}
              onChange={(e)=>onNameChange(e.target.value)}
              placeholder="Např. František Kupka"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Slug</label>
            <input
              className="input"
              value={slug}
              onChange={(e)=>onSlugChange(e.target.value)}
              placeholder="frantisek-kupka"
              required
            />
            {!slugTouched && (
              <div className="text-xs text-gray-500 mt-1">
                Slug se generuje automaticky ze jména. Jakmile jej upravíš ručně, už se sám nepřegeneruje.
              </div>
            )}
          </div>
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
            {portraitUrl && (
              <div className="flex-shrink-0">
                <div className="text-xs text-gray-500 mb-1">Náhled:</div>
                <img
                  src={portraitUrl}
                  alt="Náhled portrétu"
                  className="h-32 w-32 object-cover rounded-lg border"
                  onError={(e)=>{ e.currentTarget.style.display='none'; }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Opravdu chcete smazat portrét?')) {
                      setPortraitUrl('');
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
          <input
            className="input"
            value={website}
            onChange={(e)=>setWebsite(e.target.value)}
            onBlur={()=> setWebsite(ensureHttps(website))}
            placeholder="https://autor.cz"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Instagram</label>
            <input
              className="input"
              value={instagram}
              onChange={(e)=>setInstagram(e.target.value)}
              onBlur={()=> setInstagram(normalizeInstagram(instagram))}
              placeholder="@autor nebo https://instagram.com/autor"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Facebook</label>
            <input
              className="input"
              value={facebook}
              onChange={(e)=>setFacebook(e.target.value)}
              onBlur={()=> setFacebook(normalizeFacebook(facebook))}
              placeholder="https://facebook.com/autor"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Bio</label>
          <textarea
            className="input min-h-[140px]"
            value={bio}
            onChange={(e)=>setBio(e.target.value)}
            placeholder="Krátké představení autora, kariéra, výstavy…"
          />
        </div>

        <div className="flex items-center gap-3">
          <button className="btn btn-primary" type="submit">Vytvořit</button>
          <Link to="/admin/artists" className="btn">Zrušit</Link>
        </div>
      </form>
    </div>
  );
}
