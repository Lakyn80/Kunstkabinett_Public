"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE;
const ClientApp = dynamic(() => import("@/client-shell/ClientApp"), { ssr: false });
const AdminApp = dynamic(() => import("@/admin-shell/AdminApp"), { ssr: false });

export default function ClientCatchAllPage() {
  useEffect(() => {
    if (APP_MODE === "admin" && window.location.pathname === "/") {
      window.location.replace("/admin");
    }
  }, []);

  if (APP_MODE === "admin") {
    return <AdminApp />;
  }
  return <ClientApp />;
}
