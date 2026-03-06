// src/modules/admin/products/AdminProductForm.jsx  (vĂ˝Ĺ™ez â€“ zapojenĂ­ editoru)
import { useState } from "react";
import RichTextField from "../components/RichTextField";

export default function AdminProductForm({ initial, onSubmit }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "", // uloĹľĂ­me ÄŤistĂ© HTML
    // ...dalĹˇĂ­ pole
  });

  return (
    <form onSubmit={(e)=>{ e.preventDefault(); onSubmit?.(form); }} className="space-y-4">
      {/* ...title atd. */}
      <label className="block text-sm font-medium mb-1">Popis dĂ­la</label>
      <div className="rounded-xl border bg-white p-2 dark:bg-slate-900 dark:border-slate-700">
        <RichTextField
          value={form.description}
          onChange={(html)=>setForm(v=>({ ...v, description: html }))}
          height={420}
        />
      </div>
      {/* ...submit */}
    </form>
  );
}

