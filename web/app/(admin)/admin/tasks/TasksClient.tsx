"use client";
import { useState, useEffect } from "react";

type Client = { id: string; name: string };
type Task = {
  id: string;
  title: string;
  notes: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "normal" | "high";
  due_date: string | null;
  client_id: string | null;
  created_at: string;
  clients: { id: string; name: string } | null;
};
type SortKey = "created_desc" | "due_asc" | "due_desc" | "priority_desc" | "due_then_priority";
type StatusFilter = "all" | "todo" | "in_progress" | "done";

const PREFS_KEY = "ai-office-tasks-prefs";

const DEFAULT_PREFS = {
  status: "all" as StatusFilter,
  clientId: "",
  priority: "",
  sort: "created_desc" as SortKey,
};

function loadPrefs(): typeof DEFAULT_PREFS {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_PREFS;
}

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const STATUS_NEXT: Record<string, Task["status"]> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

const STATUS_STYLES: Record<string, string> = {
  todo: "bg-surface text-muted",
  in_progress: "bg-primary-soft text-primary-dark",
  done: "bg-success/10 text-success",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-surface text-muted",
  normal: "bg-surface-2 text-text-2",
  high: "bg-warning/10 text-warning",
};

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  return [...tasks].sort((a, b) => {
    switch (sort) {
      case "due_asc": {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      case "due_desc": {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return b.due_date.localeCompare(a.due_date);
      }
      case "priority_desc":
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      case "due_then_priority": {
        if (!a.due_date && !b.due_date)
          return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        const cmp = a.due_date.localeCompare(b.due_date);
        return cmp !== 0 ? cmp : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      }
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
}

export default function TasksClient({
  initialTasks,
  clients,
}: {
  initialTasks: Task[];
  clients: Client[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [prefs, setPrefs] = useState<typeof DEFAULT_PREFS>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    notes: "",
    client_id: "",
    priority: "normal",
    due_date: "",
  });
  const [editForm, setEditForm] = useState({
    title: "",
    notes: "",
    client_id: "",
    priority: "normal",
    due_date: "",
    status: "todo",
  });

  // Load prefs from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setPrefs(loadPrefs());
    setPrefsLoaded(true);
  }, []);

  // Persist prefs whenever they change
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs, prefsLoaded]);

  function updatePrefs(patch: Partial<typeof DEFAULT_PREFS>) {
    setPrefs((p) => ({ ...p, ...patch }));
  }

  const hasActiveFilters =
    prefs.status !== "all" || prefs.clientId !== "" || prefs.priority !== "";

  const displayTasks = sortTasks(
    tasks.filter((t) => {
      if (prefs.status !== "all" && t.status !== prefs.status) return false;
      if (prefs.clientId && t.client_id !== prefs.clientId) return false;
      if (prefs.priority && t.priority !== prefs.priority) return false;
      return true;
    }),
    prefs.sort
  );

  const counts: Record<StatusFilter, number> = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      notes: task.notes ?? "",
      client_id: task.client_id ?? "",
      priority: task.priority,
      due_date: task.due_date ?? "",
      status: task.status,
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editForm.title.trim()) return;
    setEditSaving(true);
    const res = await fetch(`/api/admin/tasks/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title.trim(),
        notes: editForm.notes || null,
        client_id: editForm.client_id || null,
        priority: editForm.priority,
        due_date: editForm.due_date || null,
        status: editForm.status,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks(tasks.map((t) => (t.id === editingId ? updated : t)));
      setEditingId(null);
    }
    setEditSaving(false);
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        notes: form.notes || null,
        client_id: form.client_id || null,
        priority: form.priority,
        due_date: form.due_date || null,
      }),
    });
    if (res.ok) {
      const task = await res.json();
      setTasks([task, ...tasks]);
      setForm({ title: "", notes: "", client_id: "", priority: "normal", due_date: "" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function cycleStatus(task: Task) {
    const next = STATUS_NEXT[task.status];
    const res = await fetch(`/api/admin/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    setTasks(tasks.filter((t) => t.id !== id));
  }

  const inputCls =
    "w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-primary-dark";
  const selectCls = inputCls;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Project Management</h1>
          <p className="text-sm text-muted">
            Tasks across all clients and internal AI Office work
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-dark text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          + Add Task
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createTask}
          className="bg-surface-2 border border-border rounded-xl p-5 mb-6"
        >
          <h2 className="text-sm font-semibold text-text mb-4">New task</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1">Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary-dark"
                placeholder="What needs to be done?"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Client</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary-dark"
              >
                <option value="">AI Office (General)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary-dark"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Due date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary-dark"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary-dark"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-dark text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create task"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-muted hover:text-text px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter + sort bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Status chips */}
        <div className="flex gap-1">
          {(["all", "todo", "in_progress", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => updatePrefs({ status: f })}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                prefs.status === f
                  ? "bg-primary-soft text-primary-dark font-semibold"
                  : "text-muted hover:text-text hover:bg-surface"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]}{" "}
              <span className="opacity-60">({counts[f]})</span>
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        {/* Client filter */}
        {clients.length > 0 && (
          <select
            value={prefs.clientId}
            onChange={(e) => updatePrefs({ clientId: e.target.value })}
            className="bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:outline-none focus:border-primary-dark"
          >
            <option value="">All clients</option>
            <option value="__none__">AI Office (General)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Priority filter */}
        <select
          value={prefs.priority}
          onChange={(e) => updatePrefs({ priority: e.target.value })}
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:outline-none focus:border-primary-dark"
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>

        {/* Sort */}
        <select
          value={prefs.sort}
          onChange={(e) => updatePrefs({ sort: e.target.value as SortKey })}
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:outline-none focus:border-primary-dark ml-auto"
        >
          <option value="created_desc">Newest first</option>
          <option value="due_asc">Due date (soonest)</option>
          <option value="due_desc">Due date (latest)</option>
          <option value="priority_desc">Priority (high first)</option>
          <option value="due_then_priority">Due date, then priority</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => updatePrefs({ status: "all", clientId: "", priority: "" })}
            className="text-xs text-muted hover:text-text transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {displayTasks.length === 0 ? (
        <div className="bg-surface-2 border border-border rounded-xl p-10 text-center">
          <p className="text-sm text-muted">
            {hasActiveFilters ? "No tasks match the current filters." : "No tasks yet."}
          </p>
        </div>
      ) : (
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Task</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Client</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Priority</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Due</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {displayTasks.map((task, i) =>
                editingId === task.id ? (
                  <tr
                    key={task.id}
                    className={i < displayTasks.length - 1 ? "border-b border-border" : ""}
                  >
                    <td colSpan={6} className="px-4 py-3">
                      <form onSubmit={saveEdit} className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[180px]">
                          <label className="block text-xs text-muted mb-1">Title</label>
                          <input
                            required
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm({ ...editForm, title: e.target.value })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-xs text-muted mb-1">Notes</label>
                          <input
                            value={editForm.notes}
                            onChange={(e) =>
                              setEditForm({ ...editForm, notes: e.target.value })
                            }
                            className={inputCls}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="w-36">
                          <label className="block text-xs text-muted mb-1">Client</label>
                          <select
                            value={editForm.client_id}
                            onChange={(e) =>
                              setEditForm({ ...editForm, client_id: e.target.value })
                            }
                            className={selectCls}
                          >
                            <option value="">AI Office</option>
                            {clients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-28">
                          <label className="block text-xs text-muted mb-1">Priority</label>
                          <select
                            value={editForm.priority}
                            onChange={(e) =>
                              setEditForm({ ...editForm, priority: e.target.value })
                            }
                            className={selectCls}
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-muted mb-1">Status</label>
                          <select
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForm({ ...editForm, status: e.target.value })
                            }
                            className={selectCls}
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-muted mb-1">Due date</label>
                          <input
                            type="date"
                            value={editForm.due_date}
                            onChange={(e) =>
                              setEditForm({ ...editForm, due_date: e.target.value })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div className="flex gap-2 pb-0.5">
                          <button
                            type="submit"
                            disabled={editSaving}
                            className="bg-primary-dark text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
                          >
                            {editSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-xs text-muted hover:text-text px-3 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={task.id}
                    className={`${
                      i < displayTasks.length - 1 ? "border-b border-border" : ""
                    } hover:bg-surface transition-colors`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm text-text font-medium">{task.title}</div>
                      {task.notes && (
                        <div className="text-xs text-muted mt-0.5">{task.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {task.clients?.name ?? <span className="italic">AI Office</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          PRIORITY_STYLES[task.priority]
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {task.due_date ? (
                        new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => cycleStatus(task)}
                        title="Click to advance status"
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-75 transition-opacity ${
                          STATUS_STYLES[task.status]
                        }`}
                      >
                        {STATUS_LABEL[task.status]}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => startEdit(task)}
                          className="text-xs text-muted hover:text-text transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-xs text-muted hover:text-error transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
