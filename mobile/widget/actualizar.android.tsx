import { requestWidgetUpdate } from 'react-native-android-widget';
import { guardar, type DatosWidget } from './datos';
import { WIDGETS_ANDROID, dibujar } from './dibujar.android';

export function actualizarWidget(d: DatosWidget) {
  guardar(d); // para cuando Android lo redibuje solo (al agregarlo, al reiniciar el teléfono)
  for (const nombre of WIDGETS_ANDROID)
    requestWidgetUpdate({ widgetName: nombre, renderWidget: (info) => dibujar(nombre, d, info.height) }).catch(() => {});
}
