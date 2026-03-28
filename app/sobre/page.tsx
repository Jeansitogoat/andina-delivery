'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Truck, Store, Heart } from 'lucide-react';

export default function SobrePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-rojo-andino text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-95 transition-transform"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Sobre Andina</h1>
            <p className="text-white/80 text-sm">Conoce nuestra historia</p>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-8 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="h-32 bg-gradient-to-br from-rojo-andino to-rojo-andino/80 flex items-center justify-center">
            <span className="bg-white/95 text-rojo-andino font-black text-2xl px-4 py-2 rounded-xl shadow-lg">
              Andina
            </span>
          </div>
          <div className="p-6 sm:p-8 space-y-6">
            <p className="text-gray-700 leading-relaxed">
              <strong className="text-gray-900">Andina </strong> es la plataforma de delivery y mandados de Piñas, El Oro, Ecuador. Conectamos restaurantes, cafés, comercios y farmacias con nuestros clientes, ofreciendo envíos a domicilio y servicio de mandados con un equipo de motorizados de confianza.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Operamos como socio de la <strong className="text-gray-900">Compañía Virgen de la Merced</strong>. Nuestra misión es facilitar el acceso a productos y comidas en Piñas con un servicio rápido, confiable y cercano a la comunidad.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-rojo-andino" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Delivery</h3>
                  <p className="text-gray-600 text-sm">Pedidos de  locales a tu puerta.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-rojo-andino" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Retiro en local</h3>
                  <p className="text-gray-600 text-sm">Pide y retira en el negocio cuando esté listo.</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
              <MapPin className="w-5 h-5 text-rojo-andino flex-shrink-0 mt-0.5" />
              <p className="text-gray-700 text-sm">
                Atendemos en <strong>Piñas, El Oro</strong>. Si tienes un negocio y quieress sumarte, contactanos desde la sección &quot;Únete a Andina&quot;.
              </p>
            </div>

            <p className="text-gray-600 text-sm flex items-center gap-2">
              <Heart className="w-4 h-4 text-rojo-andino fill-rojo-andino/20" />
              Gracias por elegirnos.
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 text-rojo-andino font-semibold text-sm hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
      </article>
    </main>
  );
}
