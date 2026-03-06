// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// veřejné
import Login from './modules/auth/Login'
import ResetPassword from './pages/ResetPassword'

// ? přidáno: veřejný Home
import Home from './modules/client/Home'

// admin layout
import AdminLayout from './modules/admin/AdminLayout'
import ProtectedRoute from './shared/ProtectedRoute'
import Dashboard from './modules/admin/Dashboard'

// už máš…
import Users from './modules/admin/Users'
import Products from './modules/admin/Products'
import ProductDetail from './modules/admin/ProductDetail'
import ProductNew from './modules/admin/ProductNew'
import UserDetail from './modules/admin/UserDetail'
import Categories from './modules/admin/Categories'
import Orders from './modules/admin/Orders'
import ReportsSoldProducts from './modules/admin/ReportsSoldProducts'

// NOVÉ: Blog
import BlogList from './modules/admin/Blog/BlogList'
import BlogEdit from './modules/admin/Blog/BlogEdit'
import BlogNew from './modules/admin/Blog/BlogNew'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ? veřejný root › Home (žádné přesměrování na admin) */}
        <Route path="/" element={<Home />} />

        {/* veřejné auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* admin */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />

          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductNew />} />
          <Route path="products/:id" element={<ProductDetail />} />

          <Route path="categories" element={<Categories />} />
          <Route path="orders" element={<Orders />} />

          {/* reporty */}
          <Route path="reports/sold-products" element={<ReportsSoldProducts />} />

          {/* BLOG – NOVÉ */}
          <Route path="blog" element={<BlogList />} />
          <Route path="blog/new" element={<BlogNew />} />
          <Route path="blog/:id/edit" element={<BlogEdit />} />
        </Route>

        {/* fallback › na veřejný Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

