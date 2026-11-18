# BRD Document Generator

Upload a Business Requirements Document (BRD) and generate an **FSD**, **TSD**, and **SPD (Solution Proposal Document)**, written to your own template or to the default section outlines.

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

Next.js App Router, TypeScript, Tailwind CSS, Auth.js credentials login (email and password with JWT sessions), Neon Postgres with Drizzle ORM, and the MiniMax Anthropic-compatible API through `@anthropic-ai/sdk`. The API key is used only by server routes.

## Run locally

Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `AUTH_SECRET`, and `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` is optional and defaults to `MiniMax-M3`. Generate `AUTH_SECRET` with `openssl rand -base64 32`.

```bash
npm install
npm run db:push
npm run dev
```

## Neon setup

Create a Neon project and copy its pooled Postgres connection string into `DATABASE_URL`. Run `npm run db:push` locally with that variable configured to create the schema. `DATABASE_URL` is read lazily, so a production build does not need a database connection.

## Deploy to Vercel

1. Push this folder to a GitHub repository and import it into Vercel.
2. In Vercel, add a **Neon** database from the Vercel Marketplace (which configures `DATABASE_URL`) or set the Neon connection string yourself.
3. Configure `AUTH_SECRET` and `ANTHROPIC_API_KEY` in Vercel. Optionally set `ANTHROPIC_MODEL`, `DAILY_GENERATION_LIMIT`, `ALLOWED_EMAIL_DOMAINS`, and `REGISTRATION_OPEN`.
4. Create the tables using the production Neon connection string:
   ```bash
   npm run db:push
   ```
5. Deploy the application.

## Cost and abuse controls

- File uploads are capped at 8 MB and the BRD at 120,000 characters.
- Each user is limited to `DAILY_GENERATION_LIMIT` model calls per 24 hours.
- Set `ALLOWED_EMAIL_DOMAINS` to restrict who can register, and `REGISTRATION_OPEN=false` to close sign-up.
- The API key is only read in server routes.

## Notes and limits

- Long generations are split into one request per section; LLM routes set `maxDuration` to 300 seconds, within the current Vercel Hobby limit.
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
