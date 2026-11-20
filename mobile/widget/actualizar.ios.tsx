import { Widget } from 'expo-widgets';
import type { DatosWidget } from './datos';
import { AtajosIOS, MovimientosIOS, PresupuestosIOS, VieneIOS, type PropsAtajos, type PropsMovs, type PropsPresu, type PropsViene } from './MasIOS';
import { ResumenIOS, type PropsResumen } from './ResumenIOS';

// Los nombres tienen que coincidir con los de app.json (plugin expo-widgets).
const resumen = new Widget<PropsResumen>('Resumen', ResumenIOS);
const movimientos = new Widget<PropsMovs>('Movimientos', MovimientosIOS);
const viene = new Widget<PropsViene>('LoQueViene', VieneIOS);
const atajos = new Widget<PropsAtajos>('Atajos', AtajosIOS);
const presupuestos = new Widget<PropsPresu>('Presupuestos', PresupuestosIOS);

export function actualizarWidget(d: DatosWidget) {
  const hay = !!d;
  try { resumen.updateSnapshot(d ? { disponible: d.disponible, gastado: d.gastado, mes: d.mes, actualizado: d.actualizado } : {}); } catch { /* sin widget instalado */ }
  try { movimientos.updateSnapshot({ hay, movimientos: d?.movimientos ?? [] }); } catch { /* sin widget instalado */ }
  try { viene.updateSnapshot({ hay, mes: d?.mes, viene: d?.viene ?? null }); } catch { /* sin widget instalado */ }
  try { atajos.updateSnapshot({ hay }); } catch { /* sin widget instalado */ }
  try { presupuestos.updateSnapshot({ hay, mes: d?.mes, presupuestos: d?.presupuestos ?? [] }); } catch { /* sin widget instalado */ }
}
