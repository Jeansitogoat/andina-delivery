'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Mail, Phone } from 'lucide-react';

export default function PrivacidadPage() {
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
            <h1 className="text-lg font-bold">Política de Privacidad</h1>
            <p className="text-white/80 text-sm">Cómo tratamos tus datos</p>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-8 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8 flex items-center gap-3 border-b border-gray-100">
            <div className="w-12 h-12 rounded-xl bg-rojo-andino/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-rojo-andino" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Última actualización: 2026</p>
              <p className="text-gray-700 text-sm font-medium">Andina · Piñas, El Oro, Ecuador</p>
            </div>
          </div>
          <div className="p-6 sm:p-8 space-y-8 text-gray-700 text-sm leading-relaxed">
            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">1. Responsable del tratamiento</h2>
              <p>
                El responsable del tratamiento de los datos personales es Andina, operado por el socio de la Compañía Virgen de la Merced, con atención en Piñas, El Oro, Ecuador. Para ejercer tus derechos o consultas sobre privacidad puedes contactarnos por los medios indicados en la Plataforma (por ejemplo, teléfono o correo de soporte).
              </p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">2. Datos que recogemos</h2>
              <p className="mb-2">Recopilamos los datos necesarios para prestar el servicio, entre ellos:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Datos de identificación y contacto: nombre, correo electrónico, teléfono.</li>
                <li>Direcciones de entrega o retiro que nos indiques.</li>
                <li>Información de pedidos, pagos y preferencias (ej. método de pago).</li>
                <li>Datos de uso de la Plataforma (acceso, navegación) para mejorar el servicio y la seguridad.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">3. Finalidad del tratamiento</h2>
              <p>
                Utilizamos tus datos para: gestionar tu cuenta y pedidos; coordinar entregas y retiros; procesar pagos; atender consultas y soporte; enviar comunicaciones operativas necesarias (confirmaciones, estado del pedido); y, cuando hayas dado tu consentimiento, ofertas o novedades. No utilizamos tus datos para fines incompatibles con estos sin tu consentimiento.
              </p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">4. Base legal</h2>
              <p>
                El tratamiento se basa en la ejecución del contrato de uso del servicio, el cumplimiento de obligaciones legales y, cuando corresponda, en tu consentimiento (por ejemplo, para comunicaciones comerciales). Pueds retirar tu consentimiento en cualquier momento sin que afecte la licitud del tratamiento previo.
              </p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">5. Compartición de datos</h2>
              <p>
                Compartimos tus datos solo cuando sea necesario para el servicio: con los establecimientos para preparar y facturar pedidos; con motorizados para realizar la entrega; con proveedores de pago cuando pagas con medios electrónicos. No vendemos ni cedemos tus datos a terceros con fines de marketing no autorizados. Podemos divulgar datos cuando la ley lo exija o para proteger derechos y seguridad.
              </p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">6. Conservación</h2>
              <p>
                Conservamos tus datos mientras mantengas una cuenta activa y durante los plazos necesarios para cumplir obligaciones legales, contables o de reclamaciones. Pasado ese plazo, los datos se eliminan o se anonimizan.
              </p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">7. Tus derechos</h2>
              <p className="mb-2">
                De conformidad con la ley aplicable en Ecuador, tienes derecho a:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Acceder a tus datos personales.</li>
                <li>Solicitar la rectificación de datos inexactos o incompletos.</li>
                <li>Solicitar la supresión cuando ya no sean necesarios o retirar tu consentimiento.</li>
                <li>Solicitar la limitación del tratamiento en los casos previstos por ley.</li>
                <li>Oponerte a determinados tratamientos (por ejemplo, comunicaciones comerciales).</li>
              </ul>
              <p className="mt-3">
                Para ejercer estos derechos, contactanos por los canales indicados en la Plataforma (correo, teléfono o formulario de contacto). También puedes presentar una reclamación ante la autoridad de protección de datos competente.
              </p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">8. Cookies y tecnologías similares</h2>
              <p>
                La Plataforma puede utilizar cookies y tecnologías similares para el correcto funcionamiento, la seguridad y la mejora de la experiencia de uso. Puedes configurar tu navegador para rechazar o limitar cookies; ello puede afectar algunas funcionalidades del sitio.
              </p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">9. Seguridad</h2>
              <p>
                Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos contra accesos no autorizados, pérdida o alteración. La transmisión de datos sensibles (por ejemplo, pagos) se realiza mediante canales seguros.
              </p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-2">10. Cambios en esta política</h2>
              <p>
                Podemos actualizar esta Política de Privacidad. Los cambios se publicarán en esta página con la fecha de última actualización. Te recomendamos revisarla periódicamente. El uso continuado de la Plataforma tras la publicación de cambios implica la aceptación de la política modificada.
              </p>
            </section>

            <div className="pt-4 flex flex-wrap gap-4 text-gray-600">
              <a href="tel:+593992250333" className="inline-flex items-center gap-2 text-rojo-andino font-semibold hover:underline">
                <Phone className="w-4 h-4" />
                099 225 0333
              </a>
              <span className="inline-flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                Contacto vía app o sitio web
              </span>
            </div>
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
