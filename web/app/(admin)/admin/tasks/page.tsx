import { createServiceClient } from "@/lib/supabase/service";
import TasksClient from "./TasksClient";

export default async function TasksPage() {
  const svc = createServiceClient();
  const [{ data: tasks }, { data: clients }] = await Promise.all([
    svc
      .from("project_tasks")
      .select("*, clients(id, name)")
      .order("created_at", { ascending: false }),
    svc
      .from("clients")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
  ]);

  return <TasksClient initialTasks={tasks ?? []} clients={clients ?? []} />;
}
