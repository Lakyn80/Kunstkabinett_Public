import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../../shared/adminApiClient";

const Ctx = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Získání profilu po přihlášení nebo z uloženého tokenu
  // STRICTLY pro administrátory - vrací pouze adminy
  async function fetchMe() {
    try {
      // preferuj admin endpoint - vrací pouze adminy
      const { data } = await api.get("/api/admin/v1/users/me");
      // Admin endpoint by měl vracet pouze adminy, ale pro jistotu zkontroluj
      if (data && !data.is_admin) {
        return null;
      }
      return data || null;
    } catch {
      // NEPOUŽÍVEJ fallback na /api/v1/auth/me v admin kontextu!
      // Admini se musí přihlásit přes admin endpoint
      return null;
    }
  }

  async function bootstrap() {
    setLoading(true);
    try {
      // Zkontroluj, jestli existuje ADMIN token (IZOLOVANÝ od client tokenu)
      const token = localStorage.getItem("am_admin_token");
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      // pokus o refresh, pokud token expiroval (admin refresh endpoint)
      try {
        await api.post("/api/admin/v1/auth/refresh");
        const me = await fetchMe();
        setUser(me);
      } catch {
        // Pokud refresh selže, zkus fetchMe (možná token je stále platný)
        try {
          const me = await fetchMe();
          // Pokud fetchMe vrátí uživatele, ale není admin, vymaž token
          if (me && !me.is_admin) {
            localStorage.removeItem("am_admin_token");
            setUser(null);
          } else {
            setUser(me);
          }
        } catch {
          // Pokud ani fetchMe nefunguje, vymaž token
          localStorage.removeItem("am_admin_token");
          setUser(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email, password) {
    // Admin login - STRICTLY pro administrátory (is_admin=True)
    // Používá IZOLOVANÝ admin token ('am_admin_token'), NIKDY neovlivní client token
    const res = await api.post("/api/admin/v1/auth/login", { email, password });
    const t = res?.data?.access_token;
    if (t) {
      localStorage.setItem("am_admin_token", t); // IZOLOVANÝ admin token
    }
    let me = res?.data?.user || null;
    if (!me) me = await fetchMe();
    setUser(me);
    return me;
  }

  async function logout() {
    try {
      // Admin logout - maže POUZE admin cookie a token
      await api.post("/api/admin/v1/auth/logout");
    } catch {
      // Ignoruj chyby při logout
    }
    // Vymaž POUZE admin token (NIKDY neovlivní client token)
    localStorage.removeItem("am_admin_token");
    setUser(null);
    // Redirect na admin login po odhlášení
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
  }

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdminAuth must be used within <AdminAuthProvider />");
  return v;
}