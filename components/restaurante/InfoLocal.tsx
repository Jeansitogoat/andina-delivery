'use client';

import Image from 'next/image';
import { Star, Clock, Truck, MapPin, ShoppingBag, Search } from 'lucide-react';
import type { Local } from '@/lib/data';
import LocalLogo from '@/components/LocalLogo';

interface Props {
  local: Local;
  search: string;
  onSearch: (v: string) => void;
}

export default function InfoLocal({ local, search, onSearch }: Props) {
  return (
    <div className="bg-white shadow-sm">
      <div className="max-w-3xl mx-auto px-4 pt-0 pb-4">
        <div className="flex items-end gap-4 -mt-10 mb-3">
          <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-4 border-white shadow-xl flex-shrink-0 bg-white">
            {local.logo ? (
              <LocalLogo src={local.logo} alt={local.name} fill className="object-contain" sizes="96px" iconClassName="w-8 h-8 text-rojo-andino" />
            ) : (
              <div className="absolute inset-0 bg-rojo-andino/10 flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-rojo-andino" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-10">
            <h1 className="font-black text-xl md:text-2xl text-gray-900 leading-tight">{local.name}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1 font-semibold text-gray-800">
            <Star className="w-4 h-4 fill-dorado-oro text-dorado-oro" />
            {local.rating}
            <span className="font-normal text-gray-500">({local.reviews} opiniones)</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-gray-400" />
            {local.time}
          </span>
          <span className="flex items-center gap-1 text-rojo-andino font-semibold">
            <Truck className="w-4 h-4" />
            Envío $1.50
          </span>
        </div>

        {local.address && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <MapPin className="w-3.5 h-3.5" />
            {local.address}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30 focus:border-rojo-andino focus:bg-white transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
