/** Skeleton para historial de pedidos (perfil). */
export default function SkeletonHistorial() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          style={{ opacity: 1 - i * 0.06 }}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="h-4 skeleton rounded-lg w-24" />
            <div className="h-4 skeleton rounded-lg w-20" />
          </div>
          <div className="h-3 skeleton rounded w-3/4 mb-2" />
          <div className="h-3 skeleton rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
