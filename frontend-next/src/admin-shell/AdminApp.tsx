"use client";

import { RouterProvider } from "react-router-dom";
import { AdminAuthProvider } from "@/admin/modules/auth/AuthContext";
import router from "@/admin/router";

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <RouterProvider router={router} />
    </AdminAuthProvider>
  );
}
