import { Widget } from 'expo-widgets';
import type { DatosWidget } from './datos';
import { ResumenIOS, type PropsResumen } from './ResumenIOS';

// El nombre tiene que coincidir con el de app.json (plugin expo-widgets).
const resumen = new Widget<PropsResumen>('Resumen', ResumenIOS);

export function actualizarWidget(d: DatosWidget) {
  try { resumen.updateSnapshot(d ? { disponible: d.disponible, gastado: d.gastado, mes: d.mes, actualizado: d.actualizado } : {}); } catch { /* sin widget instalado */ }
}
