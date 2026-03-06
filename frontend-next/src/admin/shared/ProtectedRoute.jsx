// src/shared/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../modules/auth/AuthContext' // ADMIN AuthContext

/**
 * Ochrana admin rout:
 * - ÄŤekĂˇ na naÄŤtenĂ­ (loading)
 * - pokud nenĂ­ pĹ™ihlĂˇĹˇenĂ˝ admin -> /admin/login
 * - jinak vyrenderuje children (napĹ™. <AdminLayout />)
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-6">NaÄŤĂ­tĂˇmâ€¦</div>
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return children
}

