'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/* ── scroll to top en cada cambio de ruta ── */
function ScrollAlInicio() {
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

/* ── transición fade entre páginas ── */
function TransicionPagina({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [_displayedPath, setDisplayedPath] = useState(pathname);
  const [content, setContent] = useState(children);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPath.current) {
      setVisible(true);
      return;
    }
    /* fade out */
    setVisible(false);
    const t = setTimeout(() => {
      setContent(children);
      setDisplayedPath(pathname);
      prevPath.current = pathname;
      /* fade in en el siguiente frame */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    }, 150);
    return () => clearTimeout(t);
  }, [pathname, children]);

  /* primera carga */
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
    >
      {content}
    </div>
  );
}

export default function Proveedores({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollAlInicio />
      <TransicionPagina>{children}</TransicionPagina>
    </>
  );
}
