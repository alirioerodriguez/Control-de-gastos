// Android redibuja los widgets por su cuenta (al agregarlos, al cambiar de tamaño, al reiniciar): usa lo último guardado.
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { leer } from './datos';
import { dibujar } from './dibujar.android';

export async function tareaWidget({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(dibujar(widgetInfo.widgetName, leer(), widgetInfo.height));
}
