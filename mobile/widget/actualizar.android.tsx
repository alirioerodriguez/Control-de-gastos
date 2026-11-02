import { requestWidgetUpdate } from 'react-native-android-widget';
import { guardar, type DatosWidget } from './datos';
import { ResumenAndroid } from './ResumenAndroid';

export function actualizarWidget(d: DatosWidget) {
  guardar(d); // para cuando Android lo redibuje solo (al agregarlo, al reiniciar el teléfono)
  requestWidgetUpdate({ widgetName: 'Resumen', renderWidget: () => <ResumenAndroid datos={d} /> }).catch(() => {});
}
