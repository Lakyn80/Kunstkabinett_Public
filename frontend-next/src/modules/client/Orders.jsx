// src/modules/client/Orders.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../common/apiClient'
import { useI18n } from '../../i18n/I18nProvider'

const DEFAULT_SCHEME =
  typeof window !== 'undefined' && window.location?.protocol
    ? window.location.protocol.replace(':', '')
    : 'http'

/* Bezpečné složení obrázku – jen skutečné img soubory */
function buildImgSrc(u) {
  if (!u) return ''
  u = String(u).trim().replace(/\\/g, '/')

  // musí vypadat jako obrázek
  const isImage = /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(u)
  if (!isImage) return ''

  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('//')) return `${DEFAULT_SCHEME}:${u}`
  if (u.startsWith('/')) return u

  const path = (u.startsWith('uploads/') || u.startsWith('media/')) ? `/${u}` : `/uploads/products/${u}`
  return path
}

function fmtCZK(n){
  try { return new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK'}).format(Number(n||0)) }
  catch { return `${Number(n||0).toFixed(2)} Kč` }
}

const NO_REMOVE = new Set([
  'paid',           // zaplaceno
  'refunded',       // vrácené peníze
  'refund',         // alias
  'reclamation',    // reklamace (EN)
  'reklamace',      // reklamace (CZ)
])

export default function ClientOrders(){
  const { t } = useI18n()
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [err,setErr]=useState('')
  const [busy,setBusy]=useState({}) // { [id]: true }

  async function fetchOrders(){
    setLoading(true); setErr('')
    try{
      const { data } = await api.get('/api/client/v1/orders/my')
      const items = Array.isArray(data) ? data : (data?.items || [])
      setRows(items)
    }catch(e){
      setErr(t('orders.errorLoading'))
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ fetchOrders() },[t])

  async function handleRemove(id){
    if(!id) return
    if(!confirm(t('orders.confirmRemove'))) return
    setBusy(b => ({ ...b, [id]: true }))
    try{
      // pokus o přímé smazání
      await api.delete(`/api/client/v1/orders/${id}`)
      setRows(prev => prev.filter(o => String(o.id) !== String(id)))
      return
    }catch{
      // fallback: /cancel
      try{
        await api.post(`/api/client/v1/orders/${id}/cancel`)
        setRows(prev => prev.filter(o => String(o.id) !== String(id)))
        return
      }catch{
        alert(t('orders.removeError'))
      }
    }finally{
      setBusy(b => {
        const n = { ...b }; delete n[id]; return n
      })
    }
  }

  if(loading) return <div className="p-6">{t('orders.loading')}</div>
  if(err) return <div className="p-6 text-red-600">{err}</div>

  return (
    <div className="card p-6 space-y-4">
      <h1 className="text-xl font-semibold">{t('orders.title')}</h1>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="py-2 text-left">{t('orders.order')}</th>
            <th>{t('orders.status')}</th>
            <th className="text-right">{t('orders.total')}</th>
            <th className="text-right">{t('orders.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(o=>{
            const thumb = buildImgSrc(o.first_item_image)
            const removing = !!busy[o.id]
            const showRemove = !NO_REMOVE.has(String(o.status || '').toLowerCase())
            return (
              <tr key={o.id} className="border-t">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-10 w-10 rounded object-cover" />
                    ): null}
                    <div>
                      <div>#{o.id}</div>
                      {o.first_item_title ? (
                        <div className="text-xs text-slate-500 truncate max-w-[220px]">
                          {o.first_item_title}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td>
                  {o.status === 'pending_payment' 
                    ? t('status.pending_payment') || 'pending_payment'
                    : (t(`status.${o.status}`) || o.status)}
                </td>
                <td className="text-right">{fmtCZK(o.total)}</td>
                <td className="text-right space-x-2">
                  <Link className="btn" to={`/account/orders/${o.id}`}>{t('orders.detailPayment')}</Link>
                  {showRemove && (
                    <button
                      className="btn btn-ghost text-red-600"
                      onClick={()=>handleRemove(o.id)}
                      disabled={removing}
                      title={t('orders.removeFromList')}
                    >
                      {removing ? t('orders.removing') : t('orders.remove')}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
          {rows.length===0 && (
            <tr><td colSpan={4} className="py-8 text-center text-gray-500">{t('orders.noOrders')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
