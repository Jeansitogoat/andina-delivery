export type EstadoPedido =
  | 'confirmado'
  | 'preparando'
  | 'listo'
  | 'esperando_rider'
  | 'asignado'
  | 'en_camino'
  | 'entregado'
  | 'cancelado_local'
  | 'cancelado_cliente';

/** Logística / rider: independiente del estado de cocina (preparando / listo). */
export type EstadoTransportePedido = 'pendiente' | 'buscando_rider';

export type EstadoRider = 'disponible' | 'ocupado' | 'fuera_servicio';

export interface PedidoCentral {
  id: string;
  clienteId?: string | null;
  restaurante: string;
  restauranteDireccion: string;
  restauranteLat?: number | null;
  restauranteLng?: number | null;
  clienteNombre: string;
  clienteDireccion: string;
  clienteTelefono: string;
  items: string[];
  total: number;
  /** Total final cobrado al cliente (compat: suele coincidir con total) */
  totalCliente?: number;
  /** Subtotal legacy/base de productos sin IVA */
  subtotal?: number;
  /** Subtotal base de productos, sin IVA ni envÃ­o */
  subtotalBase?: number;
  ivaEnabled?: boolean;
  /** Tasa de IVA como decimal (ej. 0.15) */
  ivaRate?: number;
  ivaAmount?: number;
  subtotalConIva?: number;
  estado: EstadoPedido;
  /** Solicitud anticipada de rider sin marcar la comida como lista. */
  transporte?: EstadoTransportePedido;
  riderId: string | null;
  /** Denormalizado desde users al asignar rider (panel local sin GET). */
  riderNombre?: string | null;
  /** Último re-toque logístico (ms); prioriza orden en panel central. */
  logisticaBumpAt?: number;
  hora: string;
  timestamp: number;
  distancia: string;
  localId?: string | null;
  /** Snapshot del local al momento del pedido (denormalizado) */
  nombreLocal?: string | null;
  logoLocal?: string | null;
  /** Cover / foto destacada del local al momento del pedido */
  fotoLocal?: string | null;
  telefonoLocal?: string | null;
  /** Motivo de cancelación (cliente o local), texto libre */
  motivoCancelacion?: string | null;
  codigoVerificacion?: string;
  propina?: number;
  /** Multi-stop: identificador comÃºn del batch */
  batchId?: string | null;
  /** Orden de recogida dentro del batch (0 = primera parada) */
  batchIndex?: number | null;
  /** localId del local lÃ­der que puede pedir rider cuando todos estÃ©n listos */
  batchLeaderLocalId?: string | null;
  /** 'delivery' = entrega a domicilio (pasa por central/riders), 'pickup' = retiro en local */
  deliveryType?: 'delivery' | 'pickup';
  /** MÃ©todo de pago para mensaje rider y cobro */
  paymentMethod?: 'efectivo' | 'transferencia';
  /** Compat legacy: hoy se expone igual que costoEnvio para flujos rider */
  serviceCost?: number;
  /** Costo de envÃ­o/carrera del rider */
  costoEnvio?: number;
  /** Cargo de servicio que paga el cliente (no entra en comisiÃ³n) */
  serviceFee?: number;
  /** Para "Volver a pedir": estructura del carrito al momento del pedido (opcional) */
  itemsCart?: {
    localId: string;
    items: {
      id: string;
      qty: number;
      note?: string;
      variationName?: string;
      variationPrice?: number;
      complementSelections?: Record<string, string>;
      displayLabel?: string;
    }[];
  };
}

export interface RiderCentral {
  id: string;
  nombre: string;
  inicial: string;
  telefono: string;
  estado: EstadoRider;
  carrerasHoy: number;
  calificacion: number;
  color: string;
  /** URL de foto de perfil del rider */
  photoURL?: string | null;
}

export type EstadoCarrera = 'asignada' | 'en_camino' | 'entregada';

export interface CarreraRider {
  id: string;
  pedidoId: string;
  /** Cliente del pedido (para filtros UX del panel rider) */
  clienteId?: string | null;
  restaurante: string;
  restauranteDireccion: string;
  restauranteLat?: number | null;
  restauranteLng?: number | null;
  clienteNombre: string;
  clienteDireccion: string;
  clienteLat?: number | null;
  clienteLng?: number | null;
  clienteTelefono: string;
  total: number;
  propina: number;
  codigoVerificacion: string;
  estado: EstadoCarrera;
  hora: string;
  distancia: string;
  items: string[];
  /** Multi-stop: mismo batchId en todos los pedidos del mismo viaje */
  batchId?: string | null;
  batchIndex?: number | null;
  /** Timestamp para filtrado por fecha (p. ej. historial) */
  timestamp?: number;
  /** MÃ©todo de pago para claridad de cobro */
  paymentMethod?: 'efectivo' | 'transferencia';
  /** Costo de envÃ­o (cobrar solo envÃ­o si transferencia) */
  costoEnvio?: number;
  /** Total final cobrado al cliente */
  totalCliente?: number;
}

/** Mandados (/express): documento plano en Firestore `mandados`. */
export type EstadoMandado =
  | 'pendiente'
  | 'asignado'
  | 'en_camino'
  | 'completado'
  | 'cancelado';

/** Consultas acotadas en paneles operativos (evitar lecturas innecesarias). */
export const MANDADO_ESTADOS_ACTIVOS_CENTRAL: EstadoMandado[] = ['pendiente', 'asignado', 'en_camino'];
export const MANDADO_ESTADOS_ACTIVOS_RIDER: EstadoMandado[] = ['asignado', 'en_camino'];

export interface MandadoCentral {
  id: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  categoria: string;
  descripcion: string;
  desdeTexto: string;
  hastaTexto: string;
  desdeLat: number | null;
  desdeLng: number | null;
  hastaLat: number | null;
  hastaLng: number | null;
  estado: EstadoMandado;
  riderId: string | null;
  riderNombre: string | null;
  timestamp: number;
  hora?: string;
  updatedAt?: number;
}

