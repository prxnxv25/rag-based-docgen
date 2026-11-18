"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteProjectButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Delete "${title}" and all its documents? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      alert("Could not delete the project.");
      return;
    }
    router.refresh();
  }

  return (
    <button className="btn btn-danger" onClick={remove} disabled={busy} type="button">
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
