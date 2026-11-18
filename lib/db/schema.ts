import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { Analysis, DocSection, Outline, TemplateSection } from "@/lib/types";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Templates a user uploaded; reusable across projects. */
export const templates = pgTable(
  "templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    docType: text("doc_type").notNull(),
    sections: jsonb("sections").$type<TemplateSection[]>().notNull(),
    sourceFileName: text("source_file_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("templates_user_idx").on(t.userId)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    brdText: text("brd_text").notNull(),
    brdFileName: text("brd_file_name"),
    analysis: jsonb("analysis").$type<Analysis | null>(),
    answers: jsonb("answers").$type<Record<string, string>>().default({}).notNull(),
    /** Snapshot of the section outline used for each document type. */
    outline: jsonb("outline").$type<Outline>().notNull(),
    /** Which source each outline came from, for display. */
    outlineSource: jsonb("outline_source")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

/** Every save creates a new version row; the highest version is current. */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    docType: text("doc_type").notNull(),
    version: integer("version").notNull(),
    sections: jsonb("sections").$type<DocSection[]>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("documents_version_idx").on(t.projectId, t.docType, t.version)],
);

/** One row per LLM call; used for the per-user daily cap. */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("usage_user_time_idx").on(t.userId, t.createdAt)],
);
