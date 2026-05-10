import { redirect } from "next/navigation";

// Moved to /guide-suggestions — redirect for backwards compat.
export default function OldAdminSuggestions() {
  redirect("/guide-suggestions");
}
