// src/modules/admin/components/CategoryEditor.jsx
import { useEffect, useMemo, useState } from 'react'
import api from '../../../shared/adminApiClient'

// Prizpusobitelne cesty pres env (jinak defaulty nize)
const CATEGORIES_PATH = process.env.NEXT_PUBLIC_CATEGORIES_PATH || '/api/admin/v1/categories/'
const PRODUCTS_PATH = process.env.NEXT_PUBLIC_PRODUCTS_PATH || '/api/admin/v1/products'

function getCategoryId(product) {
  // pokud BE vracĂ­ jinak, uprav tady
  return product?.category_id ?? product?.category?.id ?? null
}
function setCategoryOnProduct(product, catObjOrId) {
  if (typeof catObjOrId === 'object' && catObjOrId) {
    return { ...product, category_id: catObjOrId.id, category: catObjOrId }
  }
  const idNum = Number(catObjOrId)
  return { ...product, category_id: idNum, category: { ...(product?.category || {}), id: idNum } }
}

export default function CategoryEditor({ product, onChange }) {
  const [categories, setCategories] = useState([])
  const [catId, setCatId] = useState('')
  const [loadingCats, setLoadingCats] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // pĹ™edvyplnit aktuĂˇlnĂ­ hodnotu
  useEffect(() => {
    const id = getCategoryId(product)
    setCatId(id ? String(id) : '')
  }, [product])

  // naÄŤĂ­st kategorie
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoadingCats(true)
      try {
        const { data } = await api.get(CATEGORIES_PATH)
        if (!alive) return
        const list = Array.isArray(data) ? data : (data?.items || [])
        setCategories(list)
      } catch {
        setCategories([])
      } finally {
        if (alive) setLoadingCats(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const canSave = useMemo(() => !!catId && !!product?.id, [catId, product?.id])

  async function save() {
    if (!canSave) return
    setSaving(true); setMsg('')
    try {
      // pokud BE bere jinĂ˝ payload (tĹ™eba { category: 'slug' }), uprav tady:
      await api.patch(`${PRODUCTS_PATH}/${encodeURIComponent(product.id)}`, { category_id: Number(catId) })
      const catObj = categories.find(c => String(c.id) === String(catId)) || null
      onChange?.(prev => setCategoryOnProduct(prev || product, catObj || Number(catId)))
      setMsg('UloĹľeno.')
    } catch {
      setMsg('UloĹľenĂ­ se nepodaĹ™ilo.')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 2000)
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="font-semibold mb-2">Kategorie</h3>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input h-10 min-w-[220px]"
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          disabled={loadingCats}
        >
          <option value="">â€” vyber kategorii â€”</option>
          {categories.map(c => (
            <option key={c.id} value={String(c.id)}>
              {c.name || c.title || `#${c.id}`}
            </option>
          ))}
        </select>

        <button className="btn" onClick={save} disabled={!canSave || saving}>
          {saving ? 'UklĂˇdĂˇmâ€¦' : 'UloĹľit'}
        </button>

        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>

      {!categories.length && !loadingCats && (
        <p className="mt-2 text-xs text-red-600">
          Nelze naÄŤĂ­st seznam kategoriĂ­ â€“ zkontroluj {CATEGORIES_PATH}.
        </p>
      )}
    </div>
  )
}

