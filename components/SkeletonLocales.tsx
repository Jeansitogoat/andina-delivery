export default function SkeletonLocales() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100"
          style={{ opacity: 1 - i * 0.07 }}
        >
          <div className="aspect-[3/2] skeleton" />
          <div className="p-3 space-y-2.5">
            <div className="h-4 skeleton rounded-lg w-3/4" />
            <div className="h-3 skeleton rounded-lg w-1/2" />
            <div className="flex gap-2 pt-1">
              <div className="h-3 skeleton rounded-lg w-10" />
              <div className="h-3 skeleton rounded-lg w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
