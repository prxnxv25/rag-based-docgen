import { requirePageUser } from "@/lib/session";
import { Header } from "@/components/Header";
import { NewProjectForm } from "@/components/NewProjectForm";

export default async function NewProjectPage() {
  const user = await requirePageUser();
  return (
    <>
      <Header name={user.name} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">New project</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add the BRD, then choose how each document should be structured.
        </p>
        <NewProjectForm />
      </main>
    </>
  );
}
