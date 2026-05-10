import Link from "next/link";
import AppForm from "../AppForm";

export default async function NewAppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/admin/clients" className="text-muted hover:text-text">Clients</Link>
        <span className="text-muted">/</span>
        <Link href={`/admin/clients/${id}`} className="text-muted hover:text-text">Client</Link>
        <span className="text-muted">/</span>
        <span className="text-text">New app</span>
      </div>
      <h1 className="text-xl font-bold text-text mb-6">Add deployed app</h1>
      <AppForm clientId={id} />
    </div>
  );
}
