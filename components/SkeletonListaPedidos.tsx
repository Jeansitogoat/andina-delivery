/** Skeleton para listas de pedidos (panel central, panel restaurante). */
export default function SkeletonListaPedidos() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl overflow-hidden shadow-sm border-2 border-gray-100 p-4"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
              <div className="w-3 h-3 rounded-full skeleton" />
              <div className="w-0.5 h-5 skeleton" />
              <div className="w-3 h-3 rounded-full skeleton" />
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="h-4 skeleton rounded-lg w-3/4" />
              <div className="h-3 skeleton rounded-lg w-1/2" />
              <div className="h-3 skeleton rounded-lg w-full" />
            </div>
            <div className="h-5 skeleton rounded-lg w-14 flex-shrink-0" />
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <div className="h-8 skeleton rounded-xl flex-1" />
            <div className="h-8 skeleton rounded-xl flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}
