import { HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, containerBackground, cornerRadius, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

export type PropsResumen = {
  disponible?: string;
  gastado?: string;
  mes?: string;
  actualizado?: string;
};

// Widget de iOS. Ojo: expo-widgets convierte esta función en texto y la corre en el widget, así que todo lo que
// usa tiene que estar adentro (nada de constantes importadas de otros archivos; solo componentes y modificadores).
export function ResumenIOS(props: PropsResumen, env: WidgetEnvironment) {
  'widget';
  const fondo = '#2b2723';
  const suave = '#c9c3bc';
  const acento = '#e4572e';
  const hay = !!(props && props.disponible);
  const chico = !!env && env.widgetFamily === 'systemSmall';
  return (
    <VStack alignment="leading" spacing={4} modifiers={[containerBackground(fondo, 'widget'), widgetURL('miscuentas://inicio'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
      {hay ? (
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(suave)]}>Disponible</Text>
          <Text modifiers={[font({ size: chico ? 22 : 28, weight: 'bold' }), foregroundStyle('#ffffff'), lineLimit(1), minimumScaleFactor(0.5)]}>{props.disponible}</Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(suave), lineLimit(2)]}>{`Gastaste ${props.gastado} en ${props.mes}`}</Text>
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle('#ffffff')]}>Mis Cuentas</Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(suave), lineLimit(3)]}>Abrí la app para ver tus cuentas acá.</Text>
        </VStack>
      )}
      <Spacer />
      <HStack>
        {!chico && hay ? <Text modifiers={[font({ size: 11 }), foregroundStyle(suave)]}>{`Act. ${props.actualizado}`}</Text> : null}
        <Spacer />
        <Link destination="miscuentas://nuevo">
          <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle('#ffffff'), padding({ horizontal: 12, vertical: 6 }), background(acento), cornerRadius(14)]}>+ Gasto</Text>
        </Link>
      </HStack>
    </VStack>
  );
}
