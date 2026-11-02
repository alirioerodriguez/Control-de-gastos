// Android redibuja el widget por su cuenta (al agregarlo, al cambiar de tamaño, al reiniciar): usa lo último guardado.
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { leer } from './datos';
import { ResumenAndroid } from './ResumenAndroid';

export async function tareaWidget({ widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(<ResumenAndroid datos={leer()} />);
}
