export default function PaymentsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading payments">
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-9 w-48 max-w-full rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl rounded bg-muted" />
      </div>
      <div className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-xl bg-muted/80" />
        <div className="h-28 rounded-xl bg-muted/80" />
        <div className="h-28 rounded-xl bg-muted/80" />
      </div>
      <div className="grid animate-pulse grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-2xl bg-muted/60" />
        <div className="h-80 rounded-2xl bg-muted/60" />
      </div>
    </div>
  );
}
