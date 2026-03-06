export default function SkeletonRestaurante() {
  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      {/* Cover */}
      <div className="w-full h-52 md:h-72 skeleton" />

      {/* Info */}
      <div className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 pt-0 pb-4">
          <div className="flex items-end gap-4 -mt-10 mb-3">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl skeleton flex-shrink-0" />
            <div className="flex-1 min-w-0 pt-10 space-y-2">
              <div className="h-6 skeleton rounded-lg w-3/4" />
              <div className="h-4 skeleton rounded-lg w-1/3" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="h-4 skeleton rounded-lg w-20" />
            <div className="h-4 skeleton rounded-lg w-24" />
            <div className="h-4 skeleton rounded-lg w-16" />
          </div>
        </div>
        {/* Search */}
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="h-10 skeleton rounded-2xl w-full" />
        </div>
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 border-t border-gray-100 pt-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 skeleton rounded-lg w-20 flex-shrink-0" />
          ))}
        </div>
      </div>

      {/* Menú rows */}
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-6">
        {[1, 2, 3].map((cat) => (
          <section key={cat}>
            <div className="h-5 skeleton rounded-lg w-24 mb-3" />
            <div className="space-y-0 bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 skeleton rounded w-3/4" />
                    <div className="h-3 skeleton rounded w-full" />
                    <div className="h-3 skeleton rounded w-1/4" />
                  </div>
                  <div className="w-24 h-24 rounded-2xl skeleton flex-shrink-0" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
