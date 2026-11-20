// Lo que muestra el widget de la pantalla de inicio. La web (index.html, datosWidget) manda las cifras ya
// escritas y respetando «ocultar montos»; acá solo se guardan y se muestran. null = sin sesión.
import { File, Paths } from 'expo-file-system';

export type MovWidget = { titulo: string; monto: string; ingreso: boolean; fecha: string };
export type VieneWidget = { queda: string; items: { titulo: string; cuando: string; monto: string; urgente: boolean }[] };
export type PresuWidget = { cat: string; gastado: string; limite: string; pct: number };

export type DatosWidget = {
  disponible: string; // "$ 125.300,00" o "•••••"
  gastado: string;
  mes: string; // "noviembre"
  oculto: boolean;
  actualizado: string; // "14:05"
  movimientos?: MovWidget[]; // los últimos 4
  viene?: VieneWidget | null; // lo que falta pagar este mes
  presupuestos?: PresuWidget[]; // los 3 más justos
} | null;

export const URL_APP = 'miscuentas://inicio';
export const URL_NUEVO = 'miscuentas://nuevo';
export const URL_INGRESO = 'miscuentas://ingreso';
export const URL_VOZ = 'miscuentas://voz';
export const URL_PRESU = 'miscuentas://presupuesto';
export const COLOR = { fondo: '#0e1511', tarjeta: '#17221b', linea: '#24342a', texto: '#f0fdf4', suave: '#a7c4b2', acento: '#1dea00', textoAcento: '#0e1511', rojo: '#fb7185', verde: '#4ade80', ambar: '#fbbf24' } as const;

const archivo = () => new File(Paths.document, 'widget.json');

const texto = (v: unknown, max = 60) => typeof v === 'string' && v.length <= max;

export function esValido(d: unknown): d is NonNullable<DatosWidget> {
  if (!d || typeof d !== 'object') return false;
  const x = d as Record<string, unknown>;
  return ['disponible', 'gastado', 'mes', 'actualizado'].every((k) => texto(x[k], 40));
}

/** Deja solo lo que el widget sabe mostrar (lo que manda la web es dato, no se confía a ciegas). */
export function limpiar(d: NonNullable<DatosWidget>): NonNullable<DatosWidget> {
  const lista = <T,>(v: unknown, ok: (x: Record<string, unknown>) => boolean, max: number): T[] =>
    Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object' && ok(x as Record<string, unknown>)).slice(0, max) as T[]) : [];
  const v = d.viene as unknown as Record<string, unknown> | null | undefined;
  return {
    disponible: d.disponible, gastado: d.gastado, mes: d.mes, oculto: !!d.oculto, actualizado: d.actualizado,
    movimientos: lista<MovWidget>(d.movimientos, (x) => texto(x.titulo) && texto(x.monto, 40) && texto(x.fecha, 20), 4).map((x) => ({ ...x, ingreso: !!x.ingreso })),
    viene: v && texto(v.queda, 40)
      ? { queda: v.queda as string, items: lista<VieneWidget['items'][number]>(v.items, (x) => texto(x.titulo) && texto(x.cuando, 30) && texto(x.monto, 40), 4).map((x) => ({ ...x, urgente: !!x.urgente })) }
      : null,
    presupuestos: lista<PresuWidget>(d.presupuestos, (x) => texto(x.cat) && texto(x.gastado, 40) && texto(x.limite, 40) && typeof x.pct === 'number' && isFinite(x.pct), 3),
  };
}

export function guardar(d: DatosWidget) {
  try { archivo().writeSync(JSON.stringify(d)); } catch { /* sin disco: el widget muestra lo último */ }
}

export function leer(): DatosWidget {
  try {
    const f = archivo();
    if (!f.exists) return null;
    const d = JSON.parse(f.textSync());
    return esValido(d) ? limpiar(d) : null;
  } catch { return null; }
}
