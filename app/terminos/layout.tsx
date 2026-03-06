import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y Condiciones | Andina',
  description: 'Términos y condiciones de uso de la plataforma Andina. Servicios de delivery y retiro en local en Piñas, El Oro.',
};

export default function TerminosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
