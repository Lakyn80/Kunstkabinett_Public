import { useEffect, useRef, useState } from 'react'
import api from '../common/apiClient'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider'

// Čte a zapisuje JEN do DB profilu:
//   GET  /api/v1/profile
//   PUT  /api/v1/profile  { full_name, email, phone, address, billing_address, shipping_address, same_as_billing }

function buildAddress({ street, city, zip, country = 'CZ' }) {
  const s = (street || '').trim()
  const c = (city || '').trim()
  const z = (zip || '').replace(/\s+/g,' ').trim()
  const co = (country || '').trim()
  const safeCountry = co || 'CZ'
  if (!s && !c && !z && (!co || safeCountry === 'CZ')) return null
  const cityZip = [c, z].filter(Boolean).join(' ')
  const joined = [s, cityZip, safeCountry].filter(Boolean).join(', ')
  return joined || null
}

// Flags + masked preview from /api/v1/profile (no PII in frontend)
async function fetchProfileSummary() {
  try {
    const { data } = await api.get('/api/v1/profile') // JWT
    return {
      flags: {
        has_profile: !!data?.has_profile,
        has_name: !!data?.has_name,
        has_email: !!data?.has_email,
        has_phone: !!data?.has_phone,
        has_billing: !!data?.has_billing,
        has_shipping: !!data?.has_shipping,
        same_as_billing: data?.same_as_billing != null ? !!data.same_as_billing : true,
      },
      masked: data?.masked || null,
    }
  } catch {
    return {
      flags: {
        has_profile: false,
        has_name: false,
        has_email: false,
        has_phone: false,
        has_billing: false,
        has_shipping: false,
        same_as_billing: true,
      },
      masked: null,
    }
  }
}

const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AX', name: 'Aland Islands' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AQ', name: 'Antarctica' },
  { code: 'AG', name: 'Antigua & Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BQ', name: 'Bonaire, Sint Eustatius and Saba' },
  { code: 'BA', name: 'Bosnia & Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BV', name: 'Bouvet Island' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IO', name: 'British Indian Ocean Territory' },
  { code: 'VG', name: 'British Virgin Islands' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'CC', name: 'Cocos (Keeling) Islands' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo (DRC)' },
  { code: 'CK', name: 'Cook Islands' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Cote d'Ivoire" },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CW', name: 'Curacao' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FK', name: 'Falkland Islands' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GF', name: 'French Guiana' },
  { code: 'PF', name: 'French Polynesia' },
  { code: 'TF', name: 'French Southern Territories' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GR', name: 'Greece' },
  { code: 'GL', name: 'Greenland' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GU', name: 'Guam' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HM', name: 'Heard Island & McDonald Islands' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong SAR' },
  { code: 'HU', name: 'Hungary' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CX', name: 'Christmas Island' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KR', name: 'Korea' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macao SAR' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NC', name: 'New Caledonia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' },
  { code: 'NF', name: 'Norfolk Island' },
  { code: 'KP', name: 'North Korea' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestinian Authority' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PN', name: 'Pitcairn Islands' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RE', name: 'Reunion' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome & Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SX', name: 'Sint Maarten' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'GS', name: 'South Georgia & South Sandwich Islands' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SH', name: 'St Helena, Ascension, Tristan da Cunha' },
  { code: 'BL', name: 'St. Barthelemy' },
  { code: 'KN', name: 'St. Kitts & Nevis' },
  { code: 'LC', name: 'St. Lucia' },
  { code: 'MF', name: 'St. Martin' },
  { code: 'PM', name: 'St. Pierre & Miquelon' },
  { code: 'VC', name: 'St. Vincent & Grenadines' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SJ', name: 'Svalbard & Jan Mayen' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad & Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkiye' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TC', name: 'Turks & Caicos Islands' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UM', name: 'U.S. Outlying Islands' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'WF', name: 'Wallis & Futuna' },
  { code: 'EH', name: 'Western Sahara' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
]

function formatMaskedAddress(addr) {
  if (!addr) return ''
  const cityZip = [addr.city, addr.postal_code].filter(Boolean).join(' ')
  return [addr.street, cityZip, addr.country].filter(Boolean).join(', ')
}

/** Pomocná komponenta: gradientový rámeček a glass v dark modu */
function CardShell({ children }) {
  return (
    <div className="
      rounded-2xl p-[1px]
      dark:bg-gradient-to-br dark:from-sky-400/35 dark:via-cyan-400/25 dark:to-sky-300/35
    ">
      <div className="
        card p-6
        bg-white text-slate-900
        border-slate-200
        dark:bg-slate-900/80 dark:text-slate-100 dark:border-sky-400/30
        backdrop-blur supports-[backdrop-filter]:backdrop-blur-md
      ">
        {children}
      </div>
    </div>
  )
}

export default function Account() {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [flags, setFlags] = useState({
    has_profile: false,
    has_name: false,
    has_email: false,
    has_phone: false,
    has_billing: false,
    has_shipping: false,
    same_as_billing: true,
  })
  const [masked, setMasked] = useState(null)
  const [sameAsBilling, setSameAsBilling] = useState(true)
  const [saveForNext, setSaveForNext] = useState(true)
  const [clearRequested, setClearRequested] = useState(false)

  const formRef = useRef(null)
  const nameRef = useRef(null)
  const emailRef = useRef(null)
  const phoneRef = useRef(null)
  const billingStreetRef = useRef(null)
  const billingCityRef = useRef(null)
  const billingZipRef = useRef(null)
  const billingCountryRef = useRef(null)
  const shippingStreetRef = useRef(null)
  const shippingCityRef = useRef(null)
  const shippingZipRef = useRef(null)
  const shippingCountryRef = useRef(null)

  const loadFlags = async () => {
    setLoading(true)
    const data = await fetchProfileSummary()
    setFlags(data.flags)
    setMasked(data.masked)
    setSameAsBilling(!!data.flags.same_as_billing)
    setClearRequested(false)
    setLoading(false)
  }

  useEffect(() => {
    loadFlags()
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const read = (ref) => (ref.current ? String(ref.current.value || '').trim() : '')
      const fullName = read(nameRef)
      const email = read(emailRef)
      const phone = read(phoneRef)
      const billing = {
        street: read(billingStreetRef),
        city: read(billingCityRef),
        zip: read(billingZipRef),
        country: billingCountryRef.current?.value || 'CZ',
      }
      const shipping = {
        street: read(shippingStreetRef),
        city: read(shippingCityRef),
        zip: read(shippingZipRef),
        country: shippingCountryRef.current?.value || 'CZ',
      }

      const payload = {}
      if (clearRequested) {
        payload.clear_profile = true
      } else {
        if (fullName) payload.full_name = fullName
        if (email) payload.email = email
        if (phone) payload.phone = phone
        const billingAddress = buildAddress(billing)
        if (billingAddress) payload.billing_address = billingAddress
        if (!sameAsBilling) {
          const shippingAddress = buildAddress(shipping)
          if (shippingAddress) payload.shipping_address = shippingAddress
        }
        payload.same_as_billing = sameAsBilling
      }
      await api.put('/api/v1/profile', payload)
      if (formRef.current) formRef.current.reset()
      if (clearRequested) setClearRequested(false)
      await loadFlags()
    } finally {
      setSaving(false)
    }
  }

  const onClearProfile = () => {
    if (formRef.current) formRef.current.reset()
    setSameAsBilling(true)
    setClearRequested(true)
  }

  const statusRows = [
    { key: 'name', label: t('account.name'), ok: flags.has_name, value: masked?.full_name || '' },
    { key: 'email', label: t('account.email'), ok: flags.has_email, value: masked?.email || '' },
    { key: 'phone', label: t('account.phone'), ok: flags.has_phone, value: masked?.phone || '' },
    { key: 'billing', label: t('account.billingAddress'), ok: flags.has_billing, value: formatMaskedAddress(masked?.addresses?.billing) },
    { key: 'shipping', label: t('account.shippingAddress'), ok: flags.has_shipping, value: formatMaskedAddress(masked?.addresses?.shipping) },
  ]

  return (
    <div className="space-y-6 relative">
      {/* dark-only: jemné gradientové pozadí pod stránkou */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden dark:block
                      bg-gradient-to-b from-slate-900 via-slate-950 to-black/95" />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('account.title')}</h1>
        <Link to="/account/orders" className="btn">{t('account.myOrders')}</Link>
      </div>

      <CardShell>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('account.storedDataTitle')}</h2>
        <div className="mt-4 grid gap-2 text-sm">
          {statusRows.map((row) => (
            <div key={row.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-200">{row.label}</span>
                <span className={row.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                  {row.ok ? t('account.stored') : '-'}
                </span>
              </div>
              {row.value ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {row.value}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </CardShell>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
        {/* Základ */}
        <CardShell>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('account.basicInfo')}</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.name')}</label>
              <input
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                ref={nameRef}
                placeholder="Jan Novák"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.email')}</label>
              <input
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                ref={emailRef}
                placeholder="jan.novak@example.com"
                type="email"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.phone')}</label>
              <input
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                ref={phoneRef}
                placeholder="+420 777 888 999"
              />
              <p className="text-xs text-slate-600 mt-1 dark:text-slate-300">
                {t('account.phoneNote')}
              </p>
            </div>
          </div>
        </CardShell>

        {/* Fakturační adresa */}
        <CardShell>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('account.billingAddress')}</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.street')}</label>
              <input
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                ref={billingStreetRef}
                placeholder="U Lišky 12"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.city')}</label>
              <input
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                ref={billingCityRef}
                placeholder="Praha"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.zip')}</label>
              <input
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                ref={billingZipRef}
                placeholder="110 00"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.country')}</label>
              <select
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                defaultValue="CZ"
                ref={billingCountryRef}
              >
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </CardShell>

        {/* Doručovací adresa */}
        <CardShell>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('account.shippingAddress')}</h2>
            <label className="text-sm flex items-center gap-2 text-slate-700 dark:text-sky-100">
              <input
                type="checkbox"
                checked={sameAsBilling}
                onChange={(e)=>setSameAsBilling(e.target.checked)}
              />
              {t('account.sameAsBilling')}
            </label>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.street')}</label>
              <input
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                ref={shippingStreetRef}
                placeholder="U Lišky 12"
                disabled={sameAsBilling}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.city')}</label>
              <input
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                ref={shippingCityRef}
                placeholder="Praha"
                disabled={sameAsBilling}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.zip')}</label>
              <input
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                ref={shippingZipRef}
                placeholder="110 00"
                disabled={sameAsBilling}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-sky-100">{t('account.country')}</label>
              <select
                className="input w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                defaultValue="CZ"
                ref={shippingCountryRef}
                disabled={sameAsBilling}
              >
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </CardShell>

        {/* Uložení – zachován text a struktura UI */}
        <CardShell>
          <label className="flex items-start gap-2 text-sm text-slate-900 dark:text-slate-100">
            <input
              type="checkbox"
              checked={saveForNext}
              onChange={(e)=>setSaveForNext(e.target.checked)}
            />
            <span>{t('account.saveForNext')}</span>
          </label>

          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" disabled={saving || loading}>
              {saving ? t('account.saving') : t('account.save')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={onClearProfile}
            >
              {t('account.clear')}
            </button>
          </div>
        </CardShell>
      </form>
    </div>
  )
}
