// Qué dibuja cada widget de Android, por su nombre (el de app.json).
import { AtajosAndroid, MovimientosAndroid, PresupuestosAndroid, VieneAndroid, W_ATAJOS, W_MOVS, W_PRESU, W_VIENE } from './MasAndroid';
import { ResumenAndroid } from './ResumenAndroid';
import type { DatosWidget } from './datos';

export const WIDGETS_ANDROID = ['Resumen', W_MOVS, W_VIENE, W_ATAJOS, W_PRESU];

export function dibujar(nombre: string, datos: DatosWidget, alto?: number) {
  if (nombre === W_MOVS) return <MovimientosAndroid datos={datos} alto={alto} />;
  if (nombre === W_VIENE) return <VieneAndroid datos={datos} alto={alto} />;
  if (nombre === W_ATAJOS) return <AtajosAndroid datos={datos} />;
  if (nombre === W_PRESU) return <PresupuestosAndroid datos={datos} />;
  return <ResumenAndroid datos={datos} />;
}
