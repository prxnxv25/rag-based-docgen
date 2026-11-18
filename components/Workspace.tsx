"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Md } from "@/components/Md";
import { buildTrace } from "@/lib/trace";
import {
  DOC_LABELS,
  DOC_SHORT,
  DOC_TYPES,
  type Analysis,
  type DocSection,
  type DocType,
  type Outline,
} from "@/lib/types";

interface Props {
  project: {
    id: string;
    title: string;
    brdFileName: string | null;
    analysis: Analysis | null;
    answers: Record<string, string>;
    outline: Outline;
    outlineSource: Record<string, string>;
  };
  documents: Partial<Record<DocType, { version: number; sections: DocSection[] }>>;
}

type Tab = "analysis" | DocType | "trace";

interface DocState {
  version: number | null;
  sections: DocSection[];
  dirty: boolean;
}

interface VersionInfo {
  version: number;
  createdAt: string;
}

function initialDocs(props: Props): Record<DocType, DocState> {
  const out = {} as Record<DocType, DocState>;
  for (const t of DOC_TYPES) {
    const saved = props.documents[t];
    out[t] = saved
      ? { version: saved.version, sections: saved.sections, dirty: false }
      : {
          version: null,
          dirty: false,
          sections: props.project.outline[t].map((s, i) => ({
            id: `${t}-${i}`,
            title: s.title,
            guidance: s.guidance,
            content: "",
          })),
        };
  }
  return out;
}

async function errorFrom(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? `${fallback} (${res.status})`;
}

export function Workspace(props: Props) {
  const { project } = props;
  const [tab, setTab] = useState<Tab>("analysis");
  const [analysis, setAnalysis] = useState<Analysis | null>(project.analysis);
  const [answers, setAnswers] = useState<Record<string, string>>(project.answers);
  const [docs, setDocs] = useState<Record<DocType, DocState>>(() => initialDocs(props));
  const [analysing, setAnalysing] = useState(false);
  const [job, setJob] = useState<{ docType: DocType; index: number } | null>(null);
  const [saving, setSaving] = useState<DocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [versions, setVersions] = useState<Partial<Record<DocType, VersionInfo[]>>>({});
  const [onlyUncovered, setOnlyUncovered] = useState(false);

  const docsRef = useRef(docs);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);

  const busy = analysing || job !== null;
  const anyDirty = DOC_TYPES.some((t) => docs[t].dirty);

  useEffect(() => {
    if (!anyDirty && !busy) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty, busy]);

  /* ------------------------------ helpers ------------------------------ */

  function setSectionContent(type: DocType, index: number, content: string, markDirty = true) {
    setDocs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        dirty: markDirty ? true : prev[type].dirty,
        sections: prev[type].sections.map((s, i) => (i === index ? { ...s, content } : s)),
      },
    }));
  }

  /* ------------------------------ analysis ----------------------------- */

  async function analyse() {
    if (
      analysis &&
      !confirm("Re-analysing replaces the current analysis and clears your answers. Continue?")
    ) {
      return;
    }
    setError(null);
    setAnalysing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error(await errorFrom(res, "Analysis failed"));
      const data = await res.json();
      setAnalysis(data.analysis);
      setAnswers({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setAnalysing(false);
    }
  }

  async function persistAnswers(next: Record<string, string>) {
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: next }),
      });
    } catch {
      /* answers are re-sent on the next blur */
    }
  }

  /* ----------------------------- generation ---------------------------- */

  async function streamSection(
    type: DocType,
    index: number,
    prior: { title: string; content: string }[],
    signal: AbortSignal,
  ): Promise<string> {
    const res = await fetch(`/api/projects/${project.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType: type, sectionIndex: index, prior }),
      signal,
    });
    if (!res.ok) throw new Error(await errorFrom(res, "Generation failed"));
    if (!res.body) throw new Error("No response from the server.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      setSectionContent(type, index, text);
    }
    text = (text + decoder.decode()).trim();
    if (!text) throw new Error("The model returned an empty section. Please retry.");
    setSectionContent(type, index, text);
    return text;
  }

  async function saveDoc(type: DocType, sections: DocSection[]): Promise<boolean> {
    setSaving(type);
    try {
      const res = await fetch(`/api/projects/${project.id}/documents/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      if (!res.ok) throw new Error(await errorFrom(res, "Save failed"));
      const data = await res.json();
      setDocs((prev) => ({
        ...prev,
        [type]: { ...prev[type], version: data.version, dirty: false },
      }));
      setVersions((v) => ({ ...v, [type]: undefined }));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      return false;
    } finally {
      setSaving(null);
    }
  }

  /** Generates every (or every missing) section of one document, then saves it. */
  async function generateDoc(
    type: DocType,
    onlyMissing: boolean,
    signal: AbortSignal,
  ): Promise<"ok" | "stopped" | "error"> {
    const local = docsRef.current[type].sections.map((s) => ({ ...s }));
    let changed = false;
    let result: "ok" | "stopped" | "error" = "ok";

    for (let i = 0; i < local.length; i++) {
      if (signal.aborted) {
        result = "stopped";
        break;
      }
      if (onlyMissing && local[i].content.trim()) continue;

      setJob({ docType: type, index: i });
      const before = local[i].content;
      const prior = local
        .slice(0, i)
        .filter((s) => s.content.trim())
        .map((s) => ({ title: s.title, content: s.content }));
      try {
        local[i].content = await streamSection(type, i, prior, signal);
        changed = true;
      } catch (e) {
        setSectionContent(type, i, before, false);
        local[i].content = before;
        if ((e as Error).name === "AbortError") {
          result = "stopped";
        } else {
          setError(
            `${DOC_SHORT[type]} section ${i + 1} "${local[i].title}": ${
              e instanceof Error ? e.message : "failed"
            }. Completed sections were saved; use "Generate missing" to continue.`,
          );
          result = "error";
        }
        break;
      }
    }

    if (changed) await saveDoc(type, local);
    return result;
  }

  async function runGeneration(types: DocType[], onlyMissing: boolean) {
    if (!analysis) return;
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      for (const t of types) {
        setTab(t);
        const r = await generateDoc(t, onlyMissing, controller.signal);
        if (r !== "ok") break;
      }
    } finally {
      setJob(null);
      abortRef.current = null;
    }
  }

  function generateOne(type: DocType, onlyMissing: boolean) {
    const hasContent = docsRef.current[type].sections.some((s) => s.content.trim());
    if (
      !onlyMissing &&
      hasContent &&
      !confirm(`Regenerate the whole ${DOC_SHORT[type]}? Current text is kept in version history.`)
    ) {
      return;
    }
    void runGeneration([type], onlyMissing);
  }

  function generateAll() {
    const hasContent = DOC_TYPES.some((t) => docsRef.current[t].sections.some((s) => s.content.trim()));
    if (hasContent && !confirm("Regenerate all three documents? Current text is kept in version history.")) {
      return;
    }
    void runGeneration(DOC_TYPES, false);
  }

  async function regenerateSection(type: DocType, index: number) {
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const current = docsRef.current[type].sections;
    const before = current[index].content;
    const prior = current
      .slice(0, index)
      .filter((s) => s.content.trim())
      .map((s) => ({ title: s.title, content: s.content }));
    setJob({ docType: type, index });
    try {
      const text = await streamSection(type, index, prior, controller.signal);
      const next = docsRef.current[type].sections.map((s, i) =>
        i === index ? { ...s, content: text } : s,
      );
      await saveDoc(type, next);
    } catch (e) {
      setSectionContent(type, index, before, false);
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Generation failed.");
      }
    } finally {
      setJob(null);
      abortRef.current = null;
    }
  }

  /* ------------------------- export and history ------------------------ */

  async function ensureSaved(type: DocType): Promise<boolean> {
    const d = docsRef.current[type];
    if (d.dirty || d.version === null) {
      if (!d.sections.some((s) => s.content.trim())) {
        setError(`The ${DOC_SHORT[type]} has no text yet.`);
        return false;
      }
      return saveDoc(type, d.sections);
    }
    return true;
  }

  async function exportDoc(type: DocType, format: "docx" | "md") {
    if (!(await ensureSaved(type))) return;
    const a = document.createElement("a");
    a.href = `/api/projects/${project.id}/export?docType=${type}&format=${format}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function printDoc(type: DocType) {
    if (!(await ensureSaved(type))) return;
    window.open(`/projects/${project.id}/print/${type}`, "_blank");
  }

  async function loadVersions(type: DocType) {
    if (versions[type]) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/documents/${type}`);
      if (!res.ok) return;
      const data = await res.json();
      setVersions((v) => ({ ...v, [type]: data.versions }));
    } catch {
      /* history is optional */
    }
  }

  async function restoreVersion(type: DocType, version: number) {
    if (docs[type].dirty && !confirm("Discard unsaved edits and load this version?")) return;
    const res = await fetch(`/api/projects/${project.id}/documents/${type}?version=${version}`);
    if (!res.ok) {
      setError(await errorFrom(res, "Could not load that version"));
      return;
    }
    const data = await res.json();
    setDocs((prev) => ({
      ...prev,
      [type]: { version: prev[type].version, sections: data.sections, dirty: true },
    }));
  }

  /* ------------------------------ derived ------------------------------ */

  const trace = useMemo(
    () =>
      analysis
        ? buildTrace(analysis, {
            fsd: docs.fsd.sections,
            tsd: docs.tsd.sections,
            spd: docs.spd.sections,
          })
        : null,
    [analysis, docs],
  );

  const unanswered = analysis
    ? analysis.openQuestions.filter((q) => !(answers[q.id] ?? "").trim()).length
    : 0;

  function progress(type: DocType) {
    const s = docs[type].sections;
    return `${s.filter((x) => x.content.trim()).length}/${s.length}`;
  }

  /* -------------------------------- views ------------------------------- */

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: "analysis", label: "Analysis", badge: analysis ? `${analysis.requirements.length} req` : undefined },
    ...DOC_TYPES.map((t) => ({ id: t as Tab, label: DOC_SHORT[t], badge: progress(t) })),
    { id: "trace", label: "Traceability" },
  ];

  return (
    <div>
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
          ← All projects
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{project.title}</h1>
        {project.brdFileName && (
          <p className="text-sm text-slate-500">BRD: {project.brdFileName}</p>
        )}
      </div>

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-slate-200" aria-label="Sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
            {t.badge && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {t.badge}
              </span>
            )}
            {job?.docType === t.id && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-label="Writing" />
            )}
          </button>
        ))}
      </nav>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>{error}</span>
          <button type="button" className="font-medium" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {busy && job && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          <span>
            Writing {DOC_SHORT[job.docType]} section {job.index + 1} of{" "}
            {docs[job.docType].sections.length}:{" "}
            <strong>{docs[job.docType].sections[job.index]?.title}</strong>
          </span>
          <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        </div>
      )}

      {tab === "analysis" && (
        <AnalysisView
          analysis={analysis}
          answers={answers}
          analysing={analysing}
          busy={busy}
          unanswered={unanswered}
          onAnalyse={analyse}
          onAnswer={(id, value) => setAnswers((p) => ({ ...p, [id]: value }))}
          onCommit={(next) => void persistAnswers(next)}
          onGenerateAll={generateAll}
        />
      )}

      {DOC_TYPES.map(
        (t) =>
          tab === t && (
            <DocView
              key={t}
              type={t}
              state={docs[t]}
              source={project.outlineSource[t] ?? "Default industry template"}
              hasAnalysis={!!analysis}
              job={job}
              busy={busy}
              saving={saving === t}
              editing={editing}
              versions={versions[t]}
              onToEdit={(id, on) => setEditing((p) => ({ ...p, [id]: on }))}
              onChange={(i, v) => setSectionContent(t, i, v)}
              onGoAnalysis={() => setTab("analysis")}
              onGenerate={(onlyMissing) => generateOne(t, onlyMissing)}
              onRegenerate={(i) => void regenerateSection(t, i)}
              onSave={() => void saveDoc(t, docs[t].sections)}
              onExport={(f) => void exportDoc(t, f)}
              onPrint={() => void printDoc(t)}
              onOpenHistory={() => void loadVersions(t)}
              onRestore={(v) => void restoreVersion(t, v)}
            />
          ),
      )}

      {tab === "trace" && (
        <TraceView
          trace={trace}
          onlyUncovered={onlyUncovered}
          setOnlyUncovered={setOnlyUncovered}
          hasText={DOC_TYPES.some((t) => docs[t].sections.some((s) => s.content.trim()))}
        />
      )}
    </div>
  );
}

/* ====================================================================== */
/* Analysis tab                                                            */
/* ====================================================================== */

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">{title}</h3>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function AnalysisView(props: {
  analysis: Analysis | null;
  answers: Record<string, string>;
  analysing: boolean;
  busy: boolean;
  unanswered: number;
  onAnalyse: () => void;
  onAnswer: (id: string, value: string) => void;
  onCommit: (next: Record<string, string>) => void;
  onGenerateAll: () => void;
}) {
  const { analysis, answers, analysing, busy, unanswered } = props;

  if (!analysis) {
    return (
      <div className="card p-8 text-center">
        <h2 className="font-medium text-slate-900">Analyse the BRD</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
          The BRD is broken into numbered requirements, scope, stakeholders and risks. Anything
          unclear is raised as a question for you before any document is written.
        </p>
        <button className="btn btn-primary mt-4" disabled={analysing} onClick={props.onAnalyse}>
          {analysing ? "Analysing… this can take a minute" : "Analyse BRD"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-slate-700">
          <strong className="text-slate-900">{analysis.requirements.length}</strong> requirements ·{" "}
          <strong className="text-slate-900">{analysis.openQuestions.length}</strong> open questions
          {unanswered > 0 && (
            <span className="text-amber-700"> ({unanswered} unanswered, defaults will be used)</span>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn" disabled={busy} onClick={props.onAnalyse}>
            Re-analyse
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={props.onGenerateAll}>
            Generate FSD, TSD and SPD
          </button>
        </div>
      </div>

      {analysis.openQuestions.length > 0 && (
        <section className="card p-5">
          <h2 className="font-medium text-slate-900">Gaps and questions</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Answer what you can. Answers are treated as authoritative. Unanswered questions use the
            suggested default and are marked as assumptions in the documents.
          </p>
          <div className="mt-4 space-y-5">
            {analysis.openQuestions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm">
                  <span className="font-medium text-slate-900">
                    {q.id}. {q.question}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{q.why}</span>
                  <textarea
                    rows={2}
                    className="input mt-2"
                    value={answers[q.id] ?? ""}
                    placeholder={`Suggested: ${q.suggestedDefault}`}
                    onChange={(e) => props.onAnswer(q.id, e.target.value)}
                    onBlur={() => props.onCommit(answers)}
                  />
                </label>
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-accent hover:underline"
                  onClick={() => {
                    const next = { ...answers, [q.id]: q.suggestedDefault };
                    props.onAnswer(q.id, q.suggestedDefault);
                    props.onCommit(next);
                  }}
                >
                  Use suggested answer
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-medium text-slate-900">{analysis.projectName}</h2>
          <p className="mt-1 text-sm text-slate-700">{analysis.summary}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <List title="Business goals" items={analysis.businessGoals} />
          <List title="In scope" items={analysis.scope.inScope} />
          <List title="Out of scope" items={analysis.scope.outOfScope} />
          <List title="Assumptions" items={analysis.assumptions} />
          <List title="Constraints" items={analysis.constraints} />
          <List title="Risks" items={analysis.risks} />
        </div>
        {analysis.stakeholders.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-800">Stakeholders</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 pr-3">Name</th>
                    <th className="py-1 pr-3">Role</th>
                    <th className="py-1">Interest</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.stakeholders.map((s, i) => (
                    <tr key={i} className="border-t border-slate-100 align-top">
                      <td className="py-1.5 pr-3">{s.name}</td>
                      <td className="py-1.5 pr-3">{s.role}</td>
                      <td className="py-1.5">{s.interest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-medium text-slate-900">Requirements</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 pr-3">ID</th>
                <th className="py-1 pr-3">Type</th>
                <th className="py-1 pr-3">Priority</th>
                <th className="py-1">Requirement</th>
              </tr>
            </thead>
            <tbody>
              {analysis.requirements.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3 font-mono text-xs">{r.id}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{r.type}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{r.priority}</td>
                  <td className="py-1.5">
                    <div className="font-medium text-slate-900">{r.title}</div>
                    <div className="text-slate-600">{r.description}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ====================================================================== */
/* Document tab                                                            */
/* ====================================================================== */

function DocView(props: {
  type: DocType;
  state: DocState;
  source: string;
  hasAnalysis: boolean;
  job: { docType: DocType; index: number } | null;
  busy: boolean;
  saving: boolean;
  editing: Record<string, boolean>;
  versions?: VersionInfo[];
  onToEdit: (id: string, on: boolean) => void;
  onChange: (index: number, value: string) => void;
  onGoAnalysis: () => void;
  onGenerate: (onlyMissing: boolean) => void;
  onRegenerate: (index: number) => void;
  onSave: () => void;
  onExport: (f: "docx" | "md") => void;
  onPrint: () => void;
  onOpenHistory: () => void;
  onRestore: (v: number) => void;
}) {
  const { type, state, busy } = props;
  const written = state.sections.filter((s) => s.content.trim()).length;
  const partial = written > 0 && written < state.sections.length;

  if (!props.hasAnalysis) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-slate-700">Analyse the BRD before generating the {DOC_SHORT[type]}.</p>
        <button className="btn btn-primary mt-3" onClick={props.onGoAnalysis}>
          Go to analysis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-medium text-slate-900">{DOC_LABELS[type]}</h2>
          <p className="text-xs text-slate-500">
            Structure: {props.source}
            {state.version !== null && ` · saved as version ${state.version}`}
            {state.dirty && " · unsaved changes"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {partial && (
            <button className="btn" disabled={busy} onClick={() => props.onGenerate(true)}>
              Generate missing
            </button>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={() => props.onGenerate(false)}>
            {written ? "Regenerate all" : `Generate ${DOC_SHORT[type]}`}
          </button>
          <button className="btn" disabled={busy || props.saving || !state.dirty} onClick={props.onSave}>
            {props.saving ? "Saving…" : "Save"}
          </button>
          <button className="btn" disabled={busy || written === 0} onClick={() => props.onExport("docx")}>
            Word
          </button>
          <button className="btn" disabled={busy || written === 0} onClick={() => props.onExport("md")}>
            Markdown
          </button>
          <button className="btn" disabled={busy || written === 0} onClick={props.onPrint}>
            PDF
          </button>
          {state.version !== null && (
            <select
              className="input !w-auto !py-1.5 text-sm"
              aria-label="Version history"
              value=""
              onFocus={props.onOpenHistory}
              onChange={(e) => e.target.value && props.onRestore(Number(e.target.value))}
            >
              <option value="">History</option>
              {(props.versions ?? []).map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} · {new Date(v.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <ol className="space-y-3">
        {state.sections.map((s, i) => {
          const writing = props.job?.docType === type && props.job.index === i;
          const isEditing = !!props.editing[s.id];
          return (
            <li key={s.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-slate-900">
                  {i + 1}. {s.title}
                  {writing && <span className="ml-2 text-xs font-normal text-accent">writing…</span>}
                </h3>
                <div className="flex gap-2">
                  {s.content.trim() && (
                    <button
                      className="btn !py-1 text-xs"
                      disabled={busy}
                      onClick={() => props.onToEdit(s.id, !isEditing)}
                    >
                      {isEditing ? "Preview" : "Edit"}
                    </button>
                  )}
                  <button
                    className="btn !py-1 text-xs"
                    disabled={busy}
                    onClick={() => props.onRegenerate(i)}
                  >
                    {s.content.trim() ? "Regenerate" : "Write"}
                  </button>
                </div>
              </div>

              <div className="mt-3">
                {isEditing && !writing ? (
                  <textarea
                    className="input min-h-40 font-mono text-xs leading-relaxed"
                    rows={Math.min(30, Math.max(8, s.content.split("\n").length + 1))}
                    value={s.content}
                    onChange={(e) => props.onChange(i, e.target.value)}
                  />
                ) : s.content.trim() ? (
                  <Md>{s.content}</Md>
                ) : (
                  <p className="text-sm text-slate-400">Not written yet.</p>
                )}
              </div>

              {s.guidance && (
                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer select-none">Template guidance</summary>
                  <p className="mt-1 whitespace-pre-wrap">{s.guidance}</p>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ====================================================================== */
/* Traceability tab                                                        */
/* ====================================================================== */

function TraceView(props: {
  trace: ReturnType<typeof buildTrace> | null;
  onlyUncovered: boolean;
  setOnlyUncovered: (v: boolean) => void;
  hasText: boolean;
}) {
  const { trace } = props;
  if (!trace) {
    return (
      <div className="card p-8 text-center text-sm text-slate-700">
        Analyse the BRD to see requirement traceability.
      </div>
    );
  }
  if (!props.hasText) {
    return (
      <div className="card p-8 text-center text-sm text-slate-700">
        Generate at least one document to see which requirements it covers.
      </div>
    );
  }

  const rows = props.onlyUncovered
    ? trace.rows.filter((r) => DOC_TYPES.some((t) => r.refs[t].length === 0))
    : trace.rows;
  const unknown = DOC_TYPES.filter((t) => trace.unknownRefs[t].length > 0);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          {DOC_TYPES.map((t) => (
            <div key={t}>
              <span className="font-medium text-slate-900">{DOC_SHORT[t]}</span>{" "}
              <span className="text-slate-600">
                {trace.coverage[t].covered}/{trace.coverage[t].total} requirements cited
              </span>
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={props.onlyUncovered}
            onChange={(e) => props.setOnlyUncovered(e.target.checked)}
          />
          Only show gaps
        </label>
      </div>

      {unknown.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Some documents cite IDs that are not in the analysis:{" "}
          {unknown.map((t) => `${DOC_SHORT[t]} (${trace.unknownRefs[t].join(", ")})`).join("; ")}.
          Check those sections.
        </div>
      )}

      <div className="card overflow-x-auto p-2">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">Requirement</th>
              {DOC_TYPES.map((t) => (
                <th key={t} className="px-2 py-2">
                  {DOC_SHORT[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{r.id}</td>
                <td className="px-2 py-2">
                  <div className="font-medium text-slate-900">{r.title}</div>
                  <div className="text-xs text-slate-500">
                    {r.type} · {r.priority}
                  </div>
                </td>
                {DOC_TYPES.map((t) => (
                  <td key={t} className="px-2 py-2 text-xs">
                    {r.refs[t].length ? (
                      <span className="text-slate-700">{r.refs[t].join("; ")}</span>
                    ) : (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">Not covered</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
