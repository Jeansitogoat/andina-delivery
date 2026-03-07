'use client';

const TIP_OPTIONS = [
  { label: 'Ahora no', value: 0 },
  { label: '$0.50', value: 0.5 },
  { label: '$1.00', value: 1.0 },
  { label: '$1.50', value: 1.5 },
  { label: '$2.00', value: 2.0 },
];

interface Props {
  propina: number;
  onSeleccionar: (_v: number) => void;
}

export default function SeccionPropina({ propina, onSeleccionar }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">
          Propina para quien reparte
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Irá directamente a su bolsillo</p>
      </div>
      <div className="px-4 py-4 flex gap-2 flex-wrap">
        {TIP_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSeleccionar(opt.value)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              propina === opt.value
                ? 'bg-rojo-andino text-w3hite shadow-md scale-[1.05]'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
