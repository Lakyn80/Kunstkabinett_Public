"use client";

import dynamic from "next/dynamic";

const AdminApp = dynamic(() => import("@/admin-shell/AdminApp"), { ssr: false });

export default function AdminCatchAllPage() {
  return <AdminApp />;
}
