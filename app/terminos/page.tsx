'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function TerminosPage() {
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
            <h1 className="text-lg font-bold">Términos y Condiciones</h1>
            <p className="text-white/80 text-sm">Uso del servicio Andina</p>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-8 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-8 text-gray-700 text-sm leading-relaxed">
          <p className="text-gray-500 text-xs">
            Última actualización: 2026. Al utilizar la plataforma Andina, el usuario acepta los siguientes términos.
          </p>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">1. Objeto y ámbito</h2>
            <p>
              Los presentes Términos y Condiciones regulan el uso de la plataforma web y aplicación Andina (en adelante, la &quot;Plataforma&quot;), operada en Piñas, El Oro, Ecuador, por el socio de la Compañía Virgen de la Merced. El acceso y uso de la Plataforma implica la aceptación íntegra de estos términos.
            </p>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">2. Servicios ofrecidos</h2>
            <p>
              Andina ofrece: (a) intermediación para la realización de pedidos a restaurantes, cafés, comercios y farmacias asociados; (b) servicio de entrega a domicilio mediante motorizados; (c) opción de retiro en el local por parte del cliente; (d) servicio de mandados (Andina). Los precios, disponibilidad y condiciones de cada establecimiento son responsabilidad del mismo; Andina actúa como intermediario.
            </p>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">3. Cuenta y registro</h2>
            <p>
              El usuario se compromete a proporcionar información veraz y actualizada. Es responsable de mantener la confidencialidad de su contraseña y de todas las actividades realizadas desde su cuenta. Andina se reserva el derecho de suspender o dar de baja cuentas que incumplan estos términos o que realicen un uso fraudulento del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">4. Tarifas y costos</h2>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>Tarifas de envío: 1 parada $1.50, 2 paradas $1.75, 3 paradas $2.00, mandado +$1.00.</li>
              <li>Coste de servicio: 1,5% del subtotal, con mínimo $0,10 y máximo $0,30 por pedido.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">5. Pedidos y pagos</h2>
            <p>
              Los pedidos quedan confirmados según lo indicado en la Plataforma. Los precios mostrados incluyen los aplicables por el establecimiento; los costos de envío y/o propina se informan antes de confirmar. El usuario puede pagar en efectivo o por transferencia según las opciones habilitadas. La facturación, cuando aplique, puede ser emitida por el establecimiento o según la normativa vigente.
            </p>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">6. Cancelaciones y reembolsos</h2>
            <p>
              Las cancelaciones por parte del cliente deben realizarse según los plazos y condiciones indicados en la Plataforma. Los establecimientos y Andina pueden cancelar pedidos por causas de fuerza mayor, falta de stock o incumplimiento. Las políticas de reembolso se aplican según el método de pago y las condiciones del establecimiento; en caso de fallo imputable a la Plataforma, se evaluará la devolución conforme a la ley.
            </p>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">7. Entrega</h2>
            <p>
              Los tiempos de entrega son estimados y pueden variar por factores ajenos a Andina. El usuario debe facilitar una dirección y datos de contacto correctos y estar disponible para recibir el pedido. Andina no se hace responsable de retrasos debidos a causas externas (tráfico, clima, disponibilidad del destinatario, etc.). En retiro en local, el cliente es responsable de recoger su pedido en el establecimiento indicado.
            </p>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">8. Propiedad intelectual</h2>
            <p>
              La marca Andina, el diseño de la Plataforma y los contenidos propios son de titularidad de sus respectivos titulares. Queda prohibida la reproducción, distribución o uso comercial no autorizado de dichos elementos.
            </p>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">9. Limitación de responsabilidad</h2>
            <p>
              La Plataforma se ofrece &quot;tal cual&quot;. Andina no será responsable por daños indirectos, lucro cesante o consecuentes derivados del uso o la imposibilidad de uso del servicio, salvo en los casos en que la ley exija lo contrario. La responsabilidad frente al producto entregado (calidad, composición) corresponde al establecimiento que lo elabora o vende.
            </p>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">10. Modificaciones</h2>
            <p>
              Andina se reserva el derecho de modificar estos Términos y Condiciones. Los cambios serán notificados mediante publicación en la Plataforma o por medios adecuados. El uso continuado del servicio tras la entrada en vigor de las modificaciones implica la aceptación de las mismas.
            </p>
          </section>

          <section>
            <h2 className="text-gray-900 font-bold text-base mb-2">11. Ley aplicable y foro</h2>
            <p>
              Para cualquier controversia derivada de estos términos o del uso de la Plataforma, será aplicable la legislación de la República del Ecuador. Las partes se someten a los tribunales competentes de Piñas, El Oro.
            </p>
          </section>
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
