export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-surface border border-border rounded-xl p-6 animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="h-3 w-20 bg-border rounded" />
            <div className="h-3 w-16 bg-border rounded" />
          </div>
          <div className="h-6 w-40 bg-border rounded mb-8" />
          <div className="bg-bg/60 border border-border rounded-lg p-4 mb-6">
            <div className="h-3 w-28 bg-border rounded mb-3" />
            <div className="h-5 w-48 bg-border rounded mb-2" />
            <div className="h-3 w-full bg-border rounded" />
          </div>
          <div className="space-y-3 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-24 bg-border rounded" />
                <div className="h-4 w-8 bg-border rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="h-6 w-12 bg-border rounded mb-1" />
                <div className="h-2 w-16 bg-border rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-3 w-full bg-border rounded" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
