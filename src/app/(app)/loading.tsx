import { Loader2Icon } from "lucide-react";

/** Shared loading state for dashboard + login routes under the app shell. */
export default function AppShellLoading() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 py-16 text-muted-foreground"
      aria-busy="true"
      aria-label="Loading"
    >
      <Loader2Icon className="size-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium">Loading…</p>
    </div>
  );
}
