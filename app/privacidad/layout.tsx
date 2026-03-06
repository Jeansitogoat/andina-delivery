import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Andina',
  description: 'Política de privacidad de Andina. Cómo tratamos tus datos personales en Piñas, El Oro.',
};

export default function PrivacidadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
