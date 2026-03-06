# frontend-next

Frontend v `Next.js + TypeScript`.

## Co obsahuje

- klientska cast prevedena do Next shellu
- admin cast pod `/admin`
- napojeni na backend API (`/api/v1/*`, `/api/admin/v1/*`)
- oddelene tokeny pro client/admin zustaly zachovane

## Lokalni spusteni

1. V backendu musi bezet API na `http://localhost:8050`.
2. V tomto adresari:

```bash
npm install
npm run dev
```

3. Otevri `http://localhost:3000`.

## ENV

Vytvor `.env.local` podle `.env.example`:

```env
NEXT_PUBLIC_API_BASE=http://localhost:8050
```

## Build

```bash
npm run build
npm run start
```

## Poznamka k routingu

- klient: `http://localhost:3000/*`
- admin: `http://localhost:3000/admin/*`

Obe casti bezi paralelne.
