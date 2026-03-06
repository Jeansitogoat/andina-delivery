'use client';

interface Props {
  categorias: string[];
  activa: string;
  tabsRef: React.RefObject<HTMLDivElement>;
  onSeleccionar: (cat: string) => void;
}

export default function TabsMenu({ categorias, activa, tabsRef, onSeleccionar }: Props) {
  return (
    <div
      ref={tabsRef}
      className="flex gap-0 overflow-x-auto scrollbar-hide border-t border-gray-100 sticky top-0 bg-white z-10 shadow-sm"
    >
      {categorias.map((cat) => (
        <button
          key={cat}
          data-tab={cat}
          type="button"
          onClick={() => onSeleccionar(cat)}
          className={`flex-shrink-0 px-4 py-3.5 text-sm font-semibold transition-all relative whitespace-nowrap ${
            activa === cat ? 'text-rojo-andino' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {cat}
          {activa === cat && (
            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-rojo-andino rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
