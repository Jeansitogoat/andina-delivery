import AuthInstallGate from '@/components/AuthInstallGate';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthInstallGate>{children}</AuthInstallGate>;
}
