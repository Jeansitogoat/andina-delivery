/**
 * Determina si un local está abierto ahora según horarios (1–2 turnos/día) y cerradoHasta (ocupado).
 * Usa la hora local del entorno (`Date` del navegador o servidor). Para mostrar horas al usuario,
 * preferir `lib/dateEcuador` (America/Guayaquil). Si hace falta alinear cálculo y UI, derivar
 * minutos del día en Ecuador con `Intl` y pasar un `Date` coherente aquí.
 */
import type { Local, HorarioItem } from '@/lib/data';
import { normalizeHorarioTurnos } from '@/lib/data';

const DIA_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export type EstadoAbierto = {
  abierto: boolean;
  /** 'horario' = cerrado por horario, 'ocupado' = cerrado temporal, 'suspendido' = status suspended */
  motivo: 'horario' | 'ocupado' | 'suspendido' | null;
  mensaje: string;
  /** Ej: "Abre hoy a las 18:00" */
  abreA?: string;
  /** Ej: "Cierra a las 22:00" */
  cierraA?: string;
  /** Minutos restantes si está ocupado (cerradoHasta) */
  ocupadoMinutos?: number;
};

function parseTimeHHMM(hhmm: string): number {
  const [h, m] = hhmm.trim().split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Primer horario de apertura del día (primer turno). */
function primeraAperturaDia(entry: HorarioItem): string {
  const turnos = normalizeHorarioTurnos(entry);
  return turnos[0]?.desde ?? '09:00';
}

function getSiguienteDiaAbierto(
  horarios: HorarioItem[],
  fromDayIndex: number
): { dia: string; desde: string; esHoy: boolean } | null {
  for (let i = 1; i <= 7; i++) {
    const nextIndex = (fromDayIndex + i) % 7;
    const diaNombre = DIA_NAMES[nextIndex];
    const entry = horarios.find((h) => h.dia === diaNombre);
    if (entry?.abierto) {
      return {
        dia: diaNombre,
        desde: primeraAperturaDia(entry),
        esHoy: nextIndex === fromDayIndex,
      };
    }
  }
  return null;
}

/** Tipo mínimo para determinar estado abierto (Local, LocaleLightHome, etc.) */
export type LocalParaEstadoAbierto = Pick<Local, 'status' | 'cerradoHasta' | 'horarios'>;

/**
 * Dado un local y una fecha/hora (por defecto ahora), devuelve si está abierto y mensajes para la UI.
 */
export function getEstadoAbierto(local: LocalParaEstadoAbierto, now: Date = new Date()): EstadoAbierto {
  if (local.status === 'suspended') {
    return {
      abierto: false,
      motivo: 'suspendido',
      mensaje: 'Local suspendido',
    };
  }

  const cerradoHasta = local.cerradoHasta;
  if (cerradoHasta) {
    const hasta = new Date(cerradoHasta);
    if (hasta.getTime() > now.getTime()) {
      const ocupadoMinutos = Math.max(0, Math.ceil((hasta.getTime() - now.getTime()) / 60000));
      const horas = Math.floor(ocupadoMinutos / 60);
      const mins = ocupadoMinutos % 60;
      const tiempoStr = horas > 0 ? `${horas}h ${mins}min` : `${ocupadoMinutos} min`;
      return {
        abierto: false,
        motivo: 'ocupado',
        mensaje: `Ocupado · Vuelve en ${tiempoStr}`,
        ocupadoMinutos,
      };
    }
  }

  const horarios = local.horarios;
  if (!horarios || horarios.length === 0) {
    return { abierto: true, motivo: null, mensaje: 'Abierto', cierraA: undefined };
  }

  const dayIndex = now.getDay();
  const diaNombre = DIA_NAMES[dayIndex];
  const hoy = horarios.find((h) => h.dia === diaNombre);
  const minutosAhora = now.getHours() * 60 + now.getMinutes();

  if (!hoy || !hoy.abierto) {
    const siguiente = getSiguienteDiaAbierto(horarios, dayIndex);
    if (siguiente) {
      return {
        abierto: false,
        motivo: 'horario',
        mensaje: 'Cerrado ahora',
        abreA: siguiente.esHoy
          ? `Abre hoy a las ${siguiente.desde}`
          : `Abre el ${siguiente.dia} a las ${siguiente.desde}`,
      };
    }
    return {
      abierto: false,
      motivo: 'horario',
      mensaje: 'Cerrado por hoy',
    };
  }

  const turnos = normalizeHorarioTurnos(hoy)
    .map((t) => ({
      desde: parseTimeHHMM(t.desde),
      hasta: parseTimeHHMM(t.hasta),
      desdeStr: t.desde,
      hastaStr: t.hasta,
    }))
    .sort((a, b) => a.desde - b.desde);

  if (turnos.length === 0) {
    return { abierto: true, motivo: null, mensaje: 'Abierto', cierraA: undefined };
  }

  for (let i = 0; i < turnos.length; i++) {
    const { desde, hasta, hastaStr } = turnos[i];
    if (minutosAhora >= desde && minutosAhora < hasta) {
      return {
        abierto: true,
        motivo: null,
        mensaje: 'Abierto',
        cierraA: `Cierra a las ${hastaStr}`,
      };
    }
  }

  if (minutosAhora < turnos[0].desde) {
    return {
      abierto: false,
      motivo: 'horario',
      mensaje: 'Cerrado ahora',
      abreA: `Abre hoy a las ${turnos[0].desdeStr}`,
    };
  }

  for (let i = 0; i < turnos.length - 1; i++) {
    const finActual = turnos[i].hasta;
    const inicioSig = turnos[i + 1].desde;
    if (minutosAhora >= finActual && minutosAhora < inicioSig) {
      return {
        abierto: false,
        motivo: 'horario',
        mensaje: 'Cerrado ahora',
        abreA: `Abre hoy a las ${turnos[i + 1].desdeStr}`,
      };
    }
  }

  const siguiente = getSiguienteDiaAbierto(horarios, dayIndex);
  if (siguiente) {
    return {
      abierto: false,
      motivo: 'horario',
      mensaje: 'Cerrado por hoy',
      abreA: siguiente.esHoy
        ? `Abre mañana a las ${siguiente.desde}`
        : `Abre el ${siguiente.dia} a las ${siguiente.desde}`,
    };
  }
  return {
    abierto: false,
    motivo: 'horario',
    mensaje: 'Cerrado por hoy',
  };
}

/**
 * Para ordenar: abiertos primero, luego cerrados.
 */
export function sortLocalesAbiertosPrimero(locales: Local[], getEstado: (_l: Local) => EstadoAbierto): Local[] {
  return [...locales].sort((a, b) => {
    const ea = getEstado(a);
    const eb = getEstado(b);
    if (ea.abierto === eb.abierto) return 0;
    return ea.abierto ? -1 : 1;
  });
}
