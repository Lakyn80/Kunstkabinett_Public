// apps/admin/src/router.jsx
import React from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";

import AdminLayout from "./modules/admin/AdminLayout";
import Dashboard from "./modules/admin/Dashboard";

import Products from "./modules/admin/Products";
import ProductNew from "./modules/admin/ProductNew";
import ProductDetail from "./modules/admin/ProductDetail";

import Categories from "./modules/admin/Categories";

import Orders from "./modules/admin/Orders";
import OrderDetail from "./modules/admin/OrderDetail";

import Users from "./modules/admin/Users";
import UserDetail from "./modules/admin/UserDetail";

import Artists from "./modules/admin/Artists";
import ArtistNew from "./modules/admin/ArtistNew";
import ArtistDetail from "./modules/admin/ArtistDetail";

import ReportsSoldProducts from "./modules/admin/ReportsSoldProducts";
import SoldProducts from "./modules/admin/SoldProducts";
import AdminCoupons from "./modules/admin/AdminCoupons";
import MediaInbox from "./modules/admin/MediaInbox";
import Media from "./modules/admin/Media";

import BlogList from "./modules/admin/Blog/BlogList";
import BlogNew from "./modules/admin/Blog/BlogNew";
import BlogEdit from "./modules/admin/Blog/BlogEdit";

import AdminLogin from "./modules/auth/AdminLogin";
import AdminForgot from "./modules/auth/AdminForgot";
import AdminResetPassword from "./modules/auth/AdminResetPassword";
import { useAdminAuth } from "./modules/auth/AuthContext";

function RequireAuth({ children }) {
  const { user, loading } = useAdminAuth();
  const loc = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: loc }} />;
  return children;
}

function makeAdminBranch(basePath = "/") {
  return {
    path: basePath,
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },

      { path: "products", element: <Products /> },
      { path: "products/new", element: <ProductNew /> },
      { path: "products/:id", element: <ProductDetail /> },

      { path: "categories", element: <Categories /> },

      { path: "orders", element: <Orders /> },
      { path: "orders/:id", element: <OrderDetail /> },

      { path: "users", element: <Users /> },
      { path: "users/:id", element: <UserDetail /> },

      { path: "artists", element: <Artists /> },
      { path: "artists/new", element: <ArtistNew /> },
      { path: "artists/:id", element: <ArtistDetail /> },

      { path: "reports/sold-products", element: <ReportsSoldProducts /> },
      { path: "sold-products", element: <SoldProducts /> },
      { path: "coupons", element: <AdminCoupons /> },
      { path: "media-inbox", element: <MediaInbox /> },
      { path: "media", element: <Media /> },

      { path: "blog", element: <BlogList /> },
      { path: "blog/new", element: <BlogNew /> },
      { path: "blog/:id", element: <BlogEdit /> },
      { path: "blog/:id/edit", element: <BlogEdit /> }, // ← přidán alias

      { path: "*", element: <Navigate to={basePath} replace /> },
    ],
  };
}

const router = createBrowserRouter([
  { path: "/admin/login", element: <AdminLogin /> },
  { path: "/admin/forgot-password", element: <AdminForgot /> },
  { path: "/admin/reset-password", element: <AdminResetPassword /> },
  // Redirect starých cest na nové
  { path: "/login", element: <Navigate to="/admin/login" replace /> },
  { path: "/forgot-password", element: <Navigate to="/admin/forgot-password" replace /> },
  // Redirect root na admin
  { path: "/", element: <Navigate to="/admin" replace /> },

  // VŠECHNY admin cesty jsou POUZE pod /admin/
  makeAdminBranch("/admin"),
]);

export default router;
