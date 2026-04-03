import type { EstadoPedido, MandadoCentral, OrdenVista, PedidoCentral } from '@/lib/types';

export type { OrdenVista } from '@/lib/types';

export function effectiveSortTsPedido(p: PedidoCentral): number {
  const bump = typeof p.logisticaBumpAt === 'number' && !Number.isNaN(p.logisticaBumpAt) ? p.logisticaBumpAt : 0;
  return Math.max(Number(p.timestamp ?? 0), bump);
}

export function ordenVistaSortTs(o: OrdenVista): number {
  if (o.tipo === 'comida') return effectiveSortTsPedido(o.pedido);
  return Number(o.mandado.timestamp ?? 0);
}

/** Une pedidos y mandados activos ya filtrados; orden por tiempo (más reciente primero). */
export function mergeOrdenesUnificadas(pedidosActivos: PedidoCentral[], mandadosActivos: MandadoCentral[]): OrdenVista[] {
  const comida: OrdenVista[] = pedidosActivos.map((pedido) => ({ tipo: 'comida', pedido }));
  const mand: OrdenVista[] = mandadosActivos.map((mandado) => ({ tipo: 'mandado', mandado }));
  return [...comida, ...mand].sort((a, b) => ordenVistaSortTs(b) - ordenVistaSortTs(a));
}

function mandadoCoincideBusqueda(m: MandadoCentral, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  return (
    m.id.toLowerCase().includes(s) ||
    m.clienteNombre.toLowerCase().includes(s) ||
    m.descripcion.toLowerCase().includes(s) ||
    m.desdeTexto.toLowerCase().includes(s) ||
    m.hastaTexto.toLowerCase().includes(s)
  );
}

export function filtrarMandadosPanelCentral(
  mandados: MandadoCentral[],
  busqueda: string,
  filtroEstado: EstadoPedido | 'todos'
): MandadoCentral[] {
  return mandados.filter((m) => {
    if (!mandadoCoincideBusqueda(m, busqueda)) return false;
    if (filtroEstado === 'todos') return true;
    if (filtroEstado === 'esperando_rider') return m.estado === 'pendiente' && !m.riderId;
    if (filtroEstado === 'asignado') return m.estado === 'asignado';
    if (filtroEstado === 'en_camino') return m.estado === 'en_camino';
    if (filtroEstado === 'entregado') return false;
    return false;
  });
}
