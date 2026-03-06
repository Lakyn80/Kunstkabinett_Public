// src/modules/admin/components/RichTextField.jsx
import { useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Heading from "@tiptap/extension-heading";

export default function RichTextField({ value, onChange, height = 380 }) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false, // vypneme defaultnĂ­, pĹ™idĂˇme vlastnĂ­
      }),
      Heading.configure({
        levels: [1, 2, 3, 4],
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
    ],
    []
  );

  const editor = useEditor({
    extensions,
    content: value || "",
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) editor.commands.setContent(next, false);
  }, [value, editor]);

  if (!editor) return null;

  const btn =
    "px-2 py-1 rounded text-sm bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600";
  const btnActive =
    "px-2 py-1 rounded text-sm bg-slate-900 text-white dark:bg-white dark:text-slate-900";

  const is = (name, attrs) => editor.isActive(name, attrs);

  const applyLink = () => {
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("VloĹľit / upravit odkaz:", prev || "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url.trim() })
        .run();
    }
  };

  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 p-3 space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className={btn}
          title="ZpÄ›t"
        >
          â†¶
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className={btn}
          title="Znovu"
        >
          â†·
        </button>

        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={is("bold") ? btnActive : btn}
          title="TuÄŤnĂ©"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={is("italic") ? btnActive : btn}
          title="KurzĂ­va"
        >
          I
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={is("heading", { level: 1 }) ? btnActive : btn}
          title="Nadpis 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={is("heading", { level: 2 }) ? btnActive : btn}
          title="Nadpis 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={is("heading", { level: 3 }) ? btnActive : btn}
          title="Nadpis 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          className={is("heading", { level: 4 }) ? btnActive : btn}
          title="Nadpis 4"
        >
          H4
        </button>

        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={is("bulletList") ? btnActive : btn}
          title="OdrĂˇĹľky"
        >
          â€˘ List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={is("orderedList") ? btnActive : btn}
          title="ÄŚĂ­slovanĂ˝ seznam"
        >
          1. List
        </button>

        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" />

        <button
          type="button"
          onClick={applyLink}
          className={is("link") ? btnActive : btn}
          title="Odkaz"
        >
          Link
        </button>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
          className={btn}
          title="Odstranit formĂˇtovĂˇnĂ­"
        >
          Clear
        </button>
      </div>

      {/* Editor */}
      <div
        className="rounded-md border bg-white dark:bg-slate-900 dark:text-slate-100 overflow-y-auto
                   [scrollbar-width:none] [-ms-overflow-style:none]
                   [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:hidden"
        style={{ minHeight: height, maxHeight: height }}
      >
        <EditorContent
          editor={editor}
          className="prose prose-slate max-w-none dark:prose-invert p-3"
        />
      </div>
    </div>
  );
}

