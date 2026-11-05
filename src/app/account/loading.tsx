export default function AccountLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading account">
      <div className="h-32 animate-pulse border border-line bg-surface" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse border border-line bg-surface" />
        ))}
      </div>
      <div className="h-48 animate-pulse border border-line bg-surface" />
    </div>
  );
}
