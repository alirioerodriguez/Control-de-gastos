// Lo que muestra el widget de la pantalla de inicio. La web (index.html, datosWidget) manda las cifras ya
// escritas y respetando «ocultar montos»; acá solo se guardan y se muestran. null = sin sesión.
import { File, Paths } from 'expo-file-system';

export type DatosWidget = {
  disponible: string; // "$ 125.300,00" o "•••••"
  gastado: string;
  mes: string; // "noviembre"
  oculto: boolean;
  actualizado: string; // "14:05"
} | null;

export const URL_APP = 'miscuentas://inicio';
export const URL_NUEVO = 'miscuentas://nuevo';
export const COLOR = { fondo: '#2b2723', texto: '#ffffff', suave: '#c9c3bc', acento: '#e4572e' } as const;

const archivo = () => new File(Paths.document, 'widget.json');

export function esValido(d: unknown): d is NonNullable<DatosWidget> {
  if (!d || typeof d !== 'object') return false;
  const x = d as Record<string, unknown>;
  return ['disponible', 'gastado', 'mes', 'actualizado'].every((k) => typeof x[k] === 'string' && (x[k] as string).length <= 40);
}

export function guardar(d: DatosWidget) {
  try { archivo().writeSync(JSON.stringify(d)); } catch { /* sin disco: el widget muestra lo último */ }
}

export function leer(): DatosWidget {
  try {
    const f = archivo();
    if (!f.exists) return null;
    const d = JSON.parse(f.textSync());
    return esValido(d) ? d : null;
  } catch { return null; }
}
