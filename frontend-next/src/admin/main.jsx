// apps/admin/src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./router.jsx";
import { AdminAuthProvider } from "./modules/auth/AuthContext";
import "./index.css";

// Odregistruj service worker v dev módu (pokud existuje)
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister().then(() => {
        console.log('Service worker odregistrován pro dev mód')
      })
    })
  })
}

// Produkce: registruj SW pro PWA (nutné pro instalaci jako appka)
if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/admin/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AdminAuthProvider>
      <RouterProvider router={router} />
    </AdminAuthProvider>
  </React.StrictMode>
);
