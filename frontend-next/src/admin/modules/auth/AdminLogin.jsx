// apps/admin/src/modules/auth/AdminLogin.jsx
import { useState } from "react";
import { useAdminAuth } from "./AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function AdminLogin() {
  const nav = useNavigate();
  const { login, loading, user } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      nav("/admin", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Přihlášení selhalo.";
      setErr(msg);
    }
  }

  if (user) {
    nav("/admin", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6 rounded border bg-white">
        <h1 className="text-lg font-semibold">Admin přihlášení</h1>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="space-y-1">
          <label className="text-sm text-gray-600">E-mail</label>
          <input
            type="email"
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-gray-600">Heslo</label>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Přihlašuji…" : "Přihlásit se"}
        </button>

        <div className="text-sm text-center">
          <Link to="/admin/forgot-password" className="underline">Zapomenuté heslo</Link>
        </div>
      </form>
    </div>
  );
}
