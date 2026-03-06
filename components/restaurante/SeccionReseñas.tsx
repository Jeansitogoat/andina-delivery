'use client';

import { Star } from 'lucide-react';

interface Resena {
  author: string;
  rating: number;
  comment: string;
}

interface Props {
  resenas: Resena[];
  rating: number;
  totalResenas: number;
}

export default function SeccionReseñas({ resenas, rating, totalResenas }: Props) {
  if (resenas.length === 0) return null;

  return (
    <section>
      <h2 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
        <Star className="w-5 h-5 fill-dorado-oro text-dorado-oro" />
        Opiniones
        <span className="text-sm font-normal text-gray-400">
          {rating} · {totalResenas} reseñas
        </span>
      </h2>
      <div className="space-y-3">
        {resenas.map((r, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
              <span className="font-black text-rojo-andino text-sm">{r.author[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-gray-900 text-sm">{r.author}</p>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className={`w-3 h-3 ${
                        j < r.rating
                          ? 'fill-dorado-oro text-dorado-oro'
                          : 'text-gray-200 fill-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
