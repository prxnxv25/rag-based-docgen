# rag-based-docgen

Upload a Business Requirements Document (BRD) and generate an **FSD**, **TSD** and **SPD (Solution Proposal Document)**, written to your own template or to a default industry structure.

## How it works

1. **Upload the BRD** (.docx, .pdf, .txt, .md, or pasted text).
2. **Templates.** Choose whether you have your own FSD/TSD/SPD templates.
   - Yes: upload one per document. The template is read into an ordered section outline (names, order, expected tables and wording) and the document follows it. Uploaded templates are saved and can be reused.
   - No: a default industry-standard structure is used.
3. **Analyse.** The BRD becomes structured data: numbered requirements, scope, stakeholders, risks, and **open questions** for gaps and ambiguities.
4. **Answer the gaps.** Answers are treated as authoritative. Unanswered questions use a suggested default and are marked as assumptions.
5. **Generate.** Each document is written section by section (streamed), every section citing requirement IDs such as `[FR-003]`.
6. **Review.** Edit any section, regenerate a single section, restore earlier versions, and check the **Traceability** tab for requirements no document covers.
7. **Export** to Word (.docx), Markdown, or PDF (print view, "Save as PDF").

## Stack

Next.js (App Router) and TypeScript, Tailwind, Auth.js (email and password, JWT sessions), Neon Postgres with Drizzle ORM, Claude API.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the three required values
npm run db:push              # creates the tables in your database
npm run dev
```

## Deploy to Vercel

1. Push this folder to a GitHub repository and import it in Vercel (Next.js is detected automatically).
2. In the project, add a **Neon** database from the Vercel Marketplace (it sets `DATABASE_URL`), or paste your own connection string.
3. Add the environment variables from `.env.example`: `ANTHROPIC_API_KEY`, `AUTH_SECRET`, and `DATABASE_URL`.
4. Create the tables once from your machine, using the same `DATABASE_URL`:
   ```bash
   DATABASE_URL="postgres://..." npm run db:push
   ```
5. Deploy.

## Cost and abuse controls

- File uploads are capped at 8 MB and the BRD at 120,000 characters.
- Each user is limited to `DAILY_GENERATION_LIMIT` model calls per 24 hours.
- Set `ALLOWED_EMAIL_DOMAINS` to restrict who can register, and `REGISTRATION_OPEN=false` to close sign-up.
- The API key is only read in server routes.

## Notes and limits

- Long generations are split into one request per section so each stays within the function time limit (`maxDuration` is set to 120 seconds on the generation routes; lower it if your Vercel plan rejects that).
- Templates are followed for **structure and content guidance**. Word styling (fonts, headers, logos) from an uploaded template is not carried into the exported .docx.
- Scanned PDFs without a text layer cannot be read.
- Mermaid diagrams are exported as diagram source text, not images.
- Generated documents are drafts. Review them, especially anything marked `[TBC]` or "Assumed".

## Project layout

```
app/api/projects/...        create, analyse, generate (streaming), save versions, export
app/projects/[id]           workspace (analysis, FSD, TSD, SPD, traceability)
lib/templates/defaults.ts   default FSD / TSD / SPD section outlines
lib/prompts.ts              analysis, template-reading and section-writing prompts
lib/export/                 Word and Markdown export
lib/trace.ts                requirement traceability
lib/db/schema.ts            users, projects, templates, document versions, usage
```
