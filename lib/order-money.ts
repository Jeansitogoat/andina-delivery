export const DEFAULT_IVA_RATE = 0.15;

type MoneyLike = number | string | null | undefined;

type IvaConfigLike = {
  ivaEnabled?: unknown;
  ivaRate?: unknown;
  /** Si no es true, el IVA no aplica aunque `ivaEnabled` esté en true (control maestro). */
  ivaPermitidoMaestro?: unknown;
} | null | undefined;

type OrderMoneyLike = {
  subtotal?: MoneyLike;
  subtotalBase?: MoneyLike;
  ivaAmount?: MoneyLike;
  subtotalConIva?: MoneyLike;
  costoEnvio?: MoneyLike;
  serviceCost?: MoneyLike;
  serviceFee?: MoneyLike;
  propina?: MoneyLike;
  total?: MoneyLike;
  totalCliente?: MoneyLike;
  ivaEnabled?: unknown;
  ivaRate?: unknown;
} | null | undefined;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function readMoney(value: MoneyLike): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || Number.isNaN(parsed)) return undefined;
  return roundMoney(parsed);
}

export function resolveIvaRate(raw: unknown): number {
  const parsed = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof parsed !== 'number' || Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_IVA_RATE;
  }
  return parsed > 1 ? roundMoney(parsed / 100) : roundMoney(parsed);
}

export function resolveIvaConfig(config: IvaConfigLike): { ivaEnabled: boolean; ivaRate: number } {
  const permitidoMaestro = Boolean(config?.ivaPermitidoMaestro);
  return {
    ivaEnabled: Boolean(config?.ivaEnabled) && permitidoMaestro,
    ivaRate: resolveIvaRate(config?.ivaRate),
  };
}

export function buildOrderMoney(params: {
  subtotalBase: number;
  costoEnvio?: number;
  serviceFee?: number;
  propina?: number;
  ivaEnabled?: boolean;
  ivaRate?: number;
  totalCliente?: number;
}): {
  subtotalBase: number;
  subtotal: number;
  ivaEnabled: boolean;
  ivaRate: number;
  ivaAmount: number;
  subtotalConIva: number;
  costoEnvio: number;
  serviceCost: number;
  serviceFee: number;
  propina: number;
  totalCliente: number;
  total: number;
} {
  const subtotalBase = roundMoney(params.subtotalBase);
  const ivaEnabled = Boolean(params.ivaEnabled);
  const ivaRate = resolveIvaRate(params.ivaRate);
  const ivaAmount = ivaEnabled ? roundMoney(subtotalBase * ivaRate) : 0;
  const subtotalConIva = roundMoney(subtotalBase + ivaAmount);
  const costoEnvio = roundMoney(params.costoEnvio ?? 0);
  const serviceFee = roundMoney(params.serviceFee ?? 0);
  const propina = roundMoney(params.propina ?? 0);
  const computedTotal = roundMoney(subtotalConIva + costoEnvio + serviceFee + propina);
  const totalCliente = roundMoney(params.totalCliente ?? computedTotal);

  return {
    subtotalBase,
    subtotal: subtotalBase,
    ivaEnabled,
    ivaRate,
    ivaAmount,
    subtotalConIva,
    costoEnvio,
    serviceCost: costoEnvio,
    serviceFee,
    propina,
    totalCliente,
    total: totalCliente,
  };
}

export function getOrderMoney(data: OrderMoneyLike) {
  const subtotalBase =
    readMoney(data?.subtotalBase)
    ?? readMoney(data?.subtotal)
    ?? 0;
  const costoEnvio =
    readMoney(data?.costoEnvio)
    ?? readMoney(data?.serviceCost)
    ?? 0;
  const serviceFee = readMoney(data?.serviceFee) ?? 0;
  const propina = readMoney(data?.propina) ?? 0;
  const ivaConfig = resolveIvaConfig(data);
  const rawIvaAmount = readMoney(data?.ivaAmount);
  const ivaAmount = rawIvaAmount ?? (ivaConfig.ivaEnabled ? roundMoney(subtotalBase * ivaConfig.ivaRate) : 0);
  const subtotalConIva = readMoney(data?.subtotalConIva) ?? roundMoney(subtotalBase + ivaAmount);
  const totalCliente =
    readMoney(data?.totalCliente)
    ?? readMoney(data?.total)
    ?? roundMoney(subtotalConIva + costoEnvio + serviceFee + propina);

  return {
    subtotalBase,
    subtotal: subtotalBase,
    ivaEnabled: ivaConfig.ivaEnabled,
    ivaRate: ivaConfig.ivaRate,
    ivaAmount,
    subtotalConIva,
    costoEnvio,
    serviceCost: costoEnvio,
    serviceFee,
    propina,
    totalCliente,
    total: totalCliente,
    netoLocal: roundMoney(subtotalBase),
  };
}
