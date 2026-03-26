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

export type EstadoRider = 'disponible' | 'ocupado' | 'ausente' | 'fuera_servicio';

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
  estado: EstadoPedido;
  riderId: string | null;
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
  codigoVerificacion?: string;
  propina?: number;
  /** Multi-stop: identificador común del batch */
  batchId?: string | null;
  /** Orden de recogida dentro del batch (0 = primera parada) */
  batchIndex?: number | null;
  /** localId del local líder que puede pedir rider cuando todos estén listos */
  batchLeaderLocalId?: string | null;
  /** 'delivery' = entrega a domicilio (pasa por central/riders), 'pickup' = retiro en local */
  deliveryType?: 'delivery' | 'pickup';
  /** Método de pago para mensaje rider y cobro */
  paymentMethod?: 'efectivo' | 'transferencia';
  /** Costo de envío (para transferencia: cobrar solo envío) */
  serviceCost?: number;
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
  /** Método de pago para claridad de cobro */
  paymentMethod?: 'efectivo' | 'transferencia';
  /** Costo de envío (cobrar solo envío si transferencia) */
  costoEnvio?: number;
}

