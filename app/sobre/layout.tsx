import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sobre Andina',
  description: 'Conocé Andina: delivery y mandados en Piñas, El Oro. Operamos como socio de la Compañía Virgen de la Merced.',
};

export default function SobreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
