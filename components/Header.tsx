import Link from "next/link";
import { signOut } from "@/auth";

export function Header({ name }: { name?: string | null }) {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold text-white">
            BD
          </span>
          BRD Document Generator
        </Link>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          {name ? <span className="hidden sm:inline">{name}</span> : null}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
