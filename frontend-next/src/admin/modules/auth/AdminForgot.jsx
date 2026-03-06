// apps/admin/src/modules/auth/AdminForgot.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../shared/adminApiClient";

/*
  Admin password reset endpoint
  Payload: { email }
*/
async function requestReset(email) {
  try {
    await api.post("/api/admin/v1/auth/request-reset", { email });
    return true;
  } catch (e) {
    throw e || new Error("Nepodařilo se odeslat požadavek.");
  }
}

export default function AdminForgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await requestReset(email);
      setSent(true);
    } catch {
      setErr("Odeslání selhalo. Zkontroluj e-mail nebo kontaktuj správce.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6 rounded border bg-white">
        <h1 className="text-lg font-semibold">Obnova hesla</h1>

        {sent ? (
          <div className="text-sm text-green-700">
            Pokud účet existuje, poslal jsem instrukce k obnovení hesla na {email}.
          </div>
        ) : (
          <>
            {err && <div className="text-sm text-red-600">{err}</div>}
            <div className="space-y-1">
              <label className="text-sm text-gray-600">E-mail</label>
              <input
                type="email"
                className="input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? "Odesílám…" : "Odeslat instrukce"}
            </button>
          </>
        )}

        <div className="text-sm text-right">
          <Link to="/admin/login" className="underline hover:opacity-80">
            Zpět na přihlášení
          </Link>
        </div>
      </form>
    </div>
  );
}
