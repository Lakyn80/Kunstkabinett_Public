// apps/admin/src/modules/admin/Blog/BlogList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import blogApi from "./blogApi";

const tinyBtn =
  "inline-flex items-center justify-center px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition whitespace-nowrap min-w-[2.25rem]";
const primaryTiny =
  "inline-flex items-center justify-center px-3 py-1.5 text-xs rounded bg-black text-white hover:opacity-90 active:opacity-80 transition whitespace-nowrap";
const dangerTiny =
  "inline-flex items-center justify-center px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-7 00 active:bg-red-800 transition whitespace-nowrap";

export default function BlogList() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [actingIds, setActingIds] = useState(new Set());

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const params = { q: q || undefined, status_filter: status || undefined, limit, offset };
      const { data } = await blogApi.list(params);
      const items = data?.items || data || [];
      setRows(items);
      if (Array.isArray(data)) {
        setTotal(
          data.length < limit && offset === 0
            ? data.length
            : offset + data.length + (data.length === limit ? limit : 0)
        );
      } else {
        setTotal(Number(data?.total ?? 0));
      }
    } catch {
      setErr("Nepodařilo se načíst blog posty.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // eslint-disable-next-line
  }, [q, status, limit, offset]);

  const changePage = (dir) => {
    if (dir === "prev" && offset > 0) setOffset((o) => Math.max(0, o - limit));
    if (dir === "next" && page < pages) setOffset((o) => o + limit);
  };

  const onDelete = async (id) => {
    if (!window.confirm("Opravdu smazat tento příspěvek?")) return;
    try {
      setActingIds((s) => new Set(s).add(id));
      await blogApi.remove(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch {
      alert("Smazání selhalo.");
    } finally {
      setActingIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const onTogglePublish = async (row) => {
    const id = row.id;
    const isPublished = row.status === "published";
    try {
      setActingIds((s) => new Set(s).add(id));
      const res = isPublished ? await blogApi.unpublish(id) : await blogApi.publish(id);
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: isPublished ? "draft" : "published",
                published_at: isPublished ? null : res?.data?.published_at || new Date().toISOString(),
              }
            : r
        )
      );
    } catch {
      alert("Změna publikace selhala.");
    } finally {
      setActingIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const isActing = (id) => actingIds.has(id);

  return (
    <div className="card rounded-xl border bg-white shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Blog</h1>
        <div className="flex items-center gap-2">
          <button className={tinyBtn} onClick={() => load()} disabled={loading} title="Obnovit">
            ↻ Obnovit
          </button>
          <button className={primaryTiny} onClick={() => nav("/admin/blog/new")}>
            + Nový příspěvek
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="block text-xs mb-1">Hledat</label>
          <input
            className="input h-9 text-sm px-3 min-w-0 w-full"
            placeholder="název/obsah"
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Status</label>
          <select
            className="input h-9 text-sm px-2 pr-8"
            value={status}
            onChange={(e) => {
              setOffset(0);
              setStatus(e.target.value);
            }}
          >
            <option value="">(vše)</option>
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Na stránku</label>
          <select
            className="input h-9 text-sm px-2 pr-8"
            value={limit}
            onChange={(e) => {
              setOffset(0);
              setLimit(Number(e.target.value) || 10);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[50%]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 px-1">Název</th>
              <th className="px-1">Status</th>
              <th className="px-1">Publikováno</th>
              <th className="px-1 text-right">Akce</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2 px-1 min-w-0">
                  <div className="min-w-0 truncate" title={r.title}>{r.title || "–"}</div>
                </td>
                <td className="px-1 whitespace-nowrap">{r.status || "–"}</td>
                <td className="px-1 whitespace-nowrap font-mono tabular-nums min-w-0">
                  <span className="block truncate" title={r.published_at || "–"}>
                    {r.published_at ?? "–"}
                  </span>
                </td>
                <td className="px-1">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Link className={tinyBtn} to={`/admin/blog/${r.id}/edit`}>Edit</Link>
                    <button
                      className={tinyBtn}
                      onClick={() => onTogglePublish(r)}
                      disabled={isActing(r.id)}
                      title={r.status === "published" ? "Unpublish" : "Publish"}
                    >
                      {isActing(r.id) ? "…" : r.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button className={dangerTiny} onClick={() => onDelete(r.id)} disabled={isActing(r.id)}>
                      Smazat
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">Nic tu zatím není.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">
          Strana <span className="font-mono tabular-nums">{page}</span> /{" "}
          <span className="font-mono tabular-nums">{pages}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className={tinyBtn} onClick={() => changePage("prev")} disabled={loading || offset === 0} title="Předchozí">◀</button>
          <button className={tinyBtn} onClick={() => changePage("next")} disabled={loading || page >= pages} title="Další">▶</button>
        </div>
      </div>

      {loading && <div className="text-xs text-gray-500">Načítám…</div>}
    </div>
  );
}
