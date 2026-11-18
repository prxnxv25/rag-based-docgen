"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DOC_LABELS, DOC_TYPES, type DocType } from "@/lib/types";

interface SavedTemplate {
  id: string;
  name: string;
  docType: string;
  sectionCount: number;
}

type Mode = "default" | "saved" | "upload";

const ACCEPT = ".docx,.pdf,.txt,.md,.markdown";

export function NewProjectForm() {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedTemplate[]>([]);
  const [hasTemplate, setHasTemplate] = useState(false);
  const [modes, setModes] = useState<Record<DocType, Mode>>({
    fsd: "upload",
    tsd: "upload",
    spd: "upload",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setSaved(d.templates ?? []))
      .catch(() => setSaved([]));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const src = new FormData(e.currentTarget);
    const form = new FormData();
    form.set("title", String(src.get("title") ?? ""));
    form.set("brdText", String(src.get("brdText") ?? ""));
    const brd = src.get("brdFile");
    if (brd instanceof File && brd.size > 0) form.set("brdFile", brd);

    for (const t of DOC_TYPES) {
      const mode: Mode = hasTemplate ? modes[t] : "default";
      form.set(`templateMode_${t}`, mode);
      if (mode === "saved") form.set(`templateSaved_${t}`, String(src.get(`saved_${t}`) ?? ""));
      if (mode === "upload") {
        const f = src.get(`file_${t}`);
        if (f instanceof File && f.size > 0) form.set(`templateFile_${t}`, f);
      }
    }

    try {
      const res = await fetch("/api/projects", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create the project.");
      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-6">
      {/* BRD */}
      <section className="card space-y-4 p-5">
        <h2 className="font-medium text-slate-900">1. Business Requirements Document</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Project name</span>
          <input name="title" required maxLength={160} className="input" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Upload the BRD</span>
          <input
            name="brdFile"
            type="file"
            accept={ACCEPT}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
          />
          <span className="mt-1 block text-xs text-slate-500">
            .docx, .pdf, .txt or .md, up to 8 MB. Scanned PDFs without a text layer cannot be read.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">…or paste the text</span>
          <textarea
            name="brdText"
            rows={6}
            className="input font-mono text-xs"
            placeholder="Paste the BRD here. An uploaded file takes priority."
          />
        </label>
      </section>

      {/* Templates */}
      <section className="card space-y-4 p-5">
        <h2 className="font-medium text-slate-900">2. Document templates</h2>
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium text-slate-700">
            Do you have your own FSD, TSD or SPD templates?
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="hasTemplate"
              checked={hasTemplate}
              onChange={() => setHasTemplate(true)}
            />
            Yes, I will upload them
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="hasTemplate"
              checked={!hasTemplate}
              onChange={() => setHasTemplate(false)}
            />
            No, use the default industry-standard templates
          </label>
        </fieldset>

        {hasTemplate && (
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">
              Upload one template per document. Any document you leave without a template uses the
              default structure. The template&apos;s sections, order and wording are followed.
            </p>
            {DOC_TYPES.map((t) => {
              const options = saved.filter((s) => s.docType === t);
              return (
                <div key={t} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 text-sm font-medium text-slate-800">{DOC_LABELS[t]}</div>
                  <div className="mb-2 flex flex-wrap gap-4 text-sm">
                    {(["upload", "saved", "default"] as Mode[]).map((m) => {
                      if (m === "saved" && options.length === 0) return null;
                      return (
                        <label key={m} className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            name={`mode_${t}`}
                            checked={modes[t] === m}
                            onChange={() => setModes((p) => ({ ...p, [t]: m }))}
                          />
                          {m === "upload"
                            ? "Upload template"
                            : m === "saved"
                              ? "Use a saved template"
                              : "Use default"}
                        </label>
                      );
                    })}
                  </div>
                  {modes[t] === "upload" && (
                    <input
                      name={`file_${t}`}
                      type="file"
                      accept={ACCEPT}
                      className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
                    />
                  )}
                  {modes[t] === "saved" && (
                    <select name={`saved_${t}`} className="input" defaultValue={options[0]?.id}>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.sectionCount} sections)
                        </option>
                      ))}
                    </select>
                  )}
                  {modes[t] === "default" && (
                    <p className="text-xs text-slate-500">Default industry-standard structure.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Reading files…" : "Create project"}
        </button>
        {busy && hasTemplate && (
          <span className="text-sm text-slate-500">
            Reading your templates can take up to a minute.
          </span>
        )}
      </div>
    </form>
  );
}
