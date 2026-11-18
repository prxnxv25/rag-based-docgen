import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { HttpError, handle } from "@/lib/api";

const body = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

export const POST = handle(async (req: Request) => {
  if (process.env.REGISTRATION_OPEN === "false") {
    throw new HttpError(403, "Registration is closed.");
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid details.");
  }
  const { name, email, password } = parsed.data;

  // Optional allow-list, e.g. ALLOWED_EMAIL_DOMAINS="company.com,partner.com"
  const allowed = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(email.split("@")[1])) {
    throw new HttpError(403, "This email domain is not allowed to register.");
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existing) throw new HttpError(409, "An account with this email already exists.");

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(schema.users).values({ name, email, passwordHash });
  return NextResponse.json({ ok: true });
});
