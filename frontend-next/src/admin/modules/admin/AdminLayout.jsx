// frontend/apps/admin/src/modules/admin/AdminLayout.jsx
import { useEffect, useRef, useState } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { useAdminAuth } from "../auth/AuthContext";

const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 min neaktivity

export default function AdminLayout() {
  const { user, logout, loading } = useAdminAuth();
  const location = useLocation();

  const idleTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search, location.hash]);

  // === AUTO LOGOUT ===
  useEffect(() => {
    if (!user) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return undefined;
    }

    const reset = () => {
      lastActivityRef.current = Date.now();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        const diff = Date.now() - lastActivityRef.current;
        if (diff >= IDLE_TIMEOUT_MS) logout();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ["click", "mousemove", "keydown", "scroll", "touchstart", "touchmove"];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();

    return () => {
      events.forEach(ev => window.removeEventListener(ev, reset));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [logout, user]);

  return (
    <div className="min-h-screen flex flex-col">

      {/* === TOP NAV === */}
      <header className="sticky top-0 z-40 bg-gray-900 text-white border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

          <div className="flex items-center gap-3">
            {/* DESKTOP NAV */}
            <nav className="hidden md:flex items-center gap-4 ml-6">
              <NavLink to="/admin" end className="hover:underline">Dashboard</NavLink>
              <NavLink to="/admin/products" className="hover:underline">Products</NavLink>
              <NavLink to="/admin/categories" className="hover:underline">Categories</NavLink>
              <NavLink to="/admin/orders" className="hover:underline">Orders</NavLink>
              <NavLink to="/admin/users" className="hover:underline">Users</NavLink>
              <NavLink to="/admin/artists" className="hover:underline">Artists</NavLink>
              <NavLink to="/admin/reports/sold-products" className="hover:underline">Reports</NavLink>
              <NavLink to="/admin/sold-products" className="hover:underline">Sold products</NavLink>
              <NavLink to="/admin/coupons" className="hover:underline">Coupons</NavLink>
              <NavLink to="/admin/media" className="hover:underline">Media</NavLink>
              <NavLink to="/admin/media-inbox" className="hover:underline">Media Inbox</NavLink>
              <NavLink to="/admin/blog" className="hover:underline">Blog</NavLink>
            </nav>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="text-sm text-gray-400">Načítám…</span>
            ) : user ? (
              <>
                <span className="text-sm">{user.email}</span>
                <button onClick={logout} className="rounded bg-white text-black px-3 py-1 text-sm">
                  Odhlásit
                </button>
              </>
            ) : (
              <Link to="/admin/login" className="rounded bg-white text-black px-3 py-1 text-sm">
                Přihlásit
              </Link>
            )}

            {/* MOBILE HAMBURGER */}
            <button
              className="md:hidden border border-gray-700 px-2 py-1 rounded"
              onClick={() => setOpen(o => !o)}
            >
              <svg width="22" height="22" fill="white" viewBox="0 0 24 24">
                <path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {open && (
          <div className="md:hidden bg-gray-800 border-t border-gray-700 px-4 py-3 space-y-2">
            <NavLink to="/admin" end onClick={() => setOpen(false)} className="block py-1">Dashboard</NavLink>
            <NavLink to="/admin/products" onClick={() => setOpen(false)} className="block py-1">Products</NavLink>
            <NavLink to="/admin/categories" onClick={() => setOpen(false)} className="block py-1">Categories</NavLink>
            <NavLink to="/admin/orders" onClick={() => setOpen(false)} className="block py-1">Orders</NavLink>
            <NavLink to="/admin/users" onClick={() => setOpen(false)} className="block py-1">Users</NavLink>
            <NavLink to="/admin/artists" onClick={() => setOpen(false)} className="block py-1">Artists</NavLink>
            <NavLink to="/admin/reports/sold-products" onClick={() => setOpen(false)} className="block py-1">Reports</NavLink>
            <NavLink to="/admin/sold-products" onClick={() => setOpen(false)} className="block py-1">Sold products</NavLink>
            <NavLink to="/admin/coupons" onClick={() => setOpen(false)} className="block py-1">Coupons</NavLink>
            <NavLink to="/admin/media" onClick={() => setOpen(false)} className="block py-1">Media</NavLink>
            <NavLink to="/admin/media-inbox" onClick={() => setOpen(false)} className="block py-1">Media Inbox</NavLink>
            <NavLink to="/admin/blog" onClick={() => setOpen(false)} className="block py-1">Blog</NavLink>
          </div>
        )}
      </header>

      {/* MAIN */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
