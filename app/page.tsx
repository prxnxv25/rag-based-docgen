import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const STEPS = [
  {
    title: "Upload the BRD",
    body: "Drop in a .docx, .pdf, .txt or .md file, or paste the text.",
  },
  {
    title: "Bring your template, or use ours",
    body: "Upload your organisation's FSD, TSD or SPD template and the output follows it. Otherwise a standard industry structure is used.",
  },
  {
    title: "Review gaps before writing",
    body: "The BRD is analysed into numbered requirements, and the ambiguities are put to you as questions.",
  },
  {
    title: "Edit and export",
    body: "Regenerate any section, check requirement traceability, then export to Word, Markdown or PDF.",
  },
];

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-3xl px-4 py-20">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
        BD
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        From BRD to FSD, TSD and Solution Proposal
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">
        Upload a Business Requirements Document and get three consistent, traceable specification
        documents, written to your template.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="btn btn-primary">
          Create an account
        </Link>
        <Link href="/login" className="btn">
          Sign in
        </Link>
      </div>
      <ol className="mt-14 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card p-4">
            <div className="text-xs font-semibold text-accent">Step {i + 1}</div>
            <div className="mt-1 font-medium text-slate-900">{s.title}</div>
            <p className="mt-1 text-sm text-slate-600">{s.body}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
