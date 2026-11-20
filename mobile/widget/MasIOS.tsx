// Más widgets de iPhone: últimos movimientos, lo que viene en el mes, atajos para cargar y presupuestos.
// Ojo: expo-widgets convierte cada función en texto y la corre en el widget, así que todo lo que usa tiene que estar
// adentro (nada de constantes de otros archivos; solo componentes y modificadores). Sin emojis: símbolos del sistema.
import { HStack, Image, Link, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, containerBackground, cornerRadius, font, foregroundStyle, frame, lineLimit, padding, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';
import type { MovWidget, PresuWidget, VieneWidget } from './datos';

export type PropsMovs = { hay?: boolean; movimientos?: MovWidget[] };
export type PropsViene = { hay?: boolean; mes?: string; viene?: VieneWidget | null };
export type PropsAtajos = { hay?: boolean };
export type PropsPresu = { hay?: boolean; mes?: string; presupuestos?: PresuWidget[] };

export function MovimientosIOS(props: PropsMovs, env: WidgetEnvironment) {
  'widget';
  const suave = '#a7c4b2';
  const grande = !!env && (env.widgetFamily === 'systemLarge' || env.widgetFamily === 'systemExtraLarge');
  const movs = ((props && props.movimientos) || []).slice(0, grande ? 4 : 2);
  return (
    <VStack alignment="leading" spacing={grande ? 10 : 6} modifiers={[containerBackground('#0e1511', 'widget'), widgetURL('miscuentas://inicio'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(suave)]}>Últimos movimientos</Text>
        <Spacer />
        <Link destination="miscuentas://nuevo">
          <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle('#0e1511'), padding({ horizontal: 10, vertical: 4 }), background('#1dea00'), cornerRadius(12)]}>+ Gasto</Text>
        </Link>
      </HStack>
      {props && props.hay ? null : <Text modifiers={[font({ size: 13 }), foregroundStyle(suave), lineLimit(2)]}>Abrí la app para ver tus cuentas acá.</Text>}
      {props && props.hay && movs.length === 0 ? <Text modifiers={[font({ size: 13 }), foregroundStyle(suave)]}>Todavía no cargaste nada este mes.</Text> : null}
      {movs.map((m, i) => (
        <HStack key={i} spacing={10}>
          <Image systemName={m.ingreso ? 'arrow.up' : 'arrow.down'} size={13} color={m.ingreso ? '#4ade80' : suave} />
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#f0fdf4'), lineLimit(1)]}>{m.titulo}</Text>
            <Text modifiers={[font({ size: 11 }), foregroundStyle(suave)]}>{m.fecha}</Text>
          </VStack>
          <Spacer />
          <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(m.ingreso ? '#4ade80' : '#f0fdf4')]}>{`${m.ingreso ? '+' : '−'}${m.monto}`}</Text>
        </HStack>
      ))}
      <Spacer />
    </VStack>
  );
}

export function VieneIOS(props: PropsViene, env: WidgetEnvironment) {
  'widget';
  const suave = '#a7c4b2';
  const grande = !!env && (env.widgetFamily === 'systemLarge' || env.widgetFamily === 'systemExtraLarge');
  const v = props && props.viene;
  const items = ((v && v.items) || []).slice(0, grande ? 4 : 2);
  return (
    <VStack alignment="leading" spacing={grande ? 10 : 6} modifiers={[containerBackground('#0e1511', 'widget'), widgetURL('miscuentas://inicio'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(suave)]}>Lo que viene</Text>
        <Spacer />
        <Text modifiers={[font({ size: 11 }), foregroundStyle(suave)]}>{(props && props.mes) || ''}</Text>
      </HStack>
      {props && props.hay ? null : <Text modifiers={[font({ size: 13 }), foregroundStyle(suave), lineLimit(2)]}>Abrí la app para ver tus cuentas acá.</Text>}
      {props && props.hay && items.length === 0 ? <Text modifiers={[font({ size: 13 }), foregroundStyle(suave)]}>No te queda nada por pagar este mes.</Text> : null}
      {items.map((x, i) => (
        <HStack key={i} spacing={10}>
          <Image systemName={x.urgente ? 'exclamationmark.circle' : 'calendar'} size={14} color={x.urgente ? '#fbbf24' : suave} />
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#f0fdf4'), lineLimit(1)]}>{x.titulo}</Text>
            <Text modifiers={[font({ size: 11 }), foregroundStyle(x.urgente ? '#fbbf24' : suave)]}>{x.cuando || 'sin día'}</Text>
          </VStack>
          <Spacer />
          <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle('#f0fdf4')]}>{x.monto}</Text>
        </HStack>
      ))}
      <Spacer />
      {v && items.length ? (
        <HStack>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(suave)]}>Te quedaría</Text>
          <Spacer />
          <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle('#1dea00')]}>{v.queda}</Text>
        </HStack>
      ) : null}
    </VStack>
  );
}

export function AtajosIOS(_props: PropsAtajos, env: WidgetEnvironment) {
  'widget';
  const chico = !!env && env.widgetFamily === 'systemSmall';
  const boton = (url: string, simbolo: string, texto: string, principal: boolean) => (
    <Link key={url} destination={url}>
      <HStack spacing={6} modifiers={[padding({ horizontal: 10, vertical: chico ? 7 : 12 }), frame({ maxWidth: 10000 }), background(principal ? '#1dea00' : '#17221b'), cornerRadius(14)]}>
        <Image systemName={simbolo as never} size={15} color={principal ? '#0e1511' : '#f0fdf4'} />
        <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(principal ? '#0e1511' : '#f0fdf4')]}>{texto}</Text>
      </HStack>
    </Link>
  );
  const botones = [
    boton('miscuentas://voz', 'mic.fill', 'Dictar', true),
    boton('miscuentas://nuevo', 'minus', 'Gasto', false),
    boton('miscuentas://ingreso', 'plus', 'Ingreso', false),
  ];
  return chico ? (
    <VStack spacing={6} modifiers={[containerBackground('#0e1511', 'widget')]}>{botones}</VStack>
  ) : (
    <HStack spacing={8} modifiers={[containerBackground('#0e1511', 'widget')]}>{botones}</HStack>
  );
}

export function PresupuestosIOS(props: PropsPresu, env: WidgetEnvironment) {
  'widget';
  const suave = '#a7c4b2';
  const chico = !!env && env.widgetFamily === 'systemSmall';
  const ps = ((props && props.presupuestos) || []).slice(0, chico ? 2 : 3);
  return (
    <VStack alignment="leading" spacing={8} modifiers={[containerBackground('#0e1511', 'widget'), widgetURL('miscuentas://presupuesto'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(suave)]}>Presupuestos</Text>
        <Spacer />
        {chico ? null : <Text modifiers={[font({ size: 11 }), foregroundStyle(suave)]}>{(props && props.mes) || ''}</Text>}
      </HStack>
      {props && props.hay ? null : <Text modifiers={[font({ size: 13 }), foregroundStyle(suave), lineLimit(2)]}>Abrí la app para ver tus cuentas acá.</Text>}
      {props && props.hay && ps.length === 0 ? <Text modifiers={[font({ size: 13 }), foregroundStyle(suave), lineLimit(3)]}>Armá un presupuesto en Plan → Presupuestos.</Text> : null}
      {ps.map((p, i) => (
        <VStack key={i} alignment="leading" spacing={3}>
          <HStack>
            <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#f0fdf4'), lineLimit(1)]}>{p.cat}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 11 }), foregroundStyle(p.pct > 100 ? '#fb7185' : suave)]}>{chico ? `${p.pct}%` : `${p.gastado} de ${p.limite}`}</Text>
          </HStack>
          <ProgressView value={Math.min(1, p.pct / 100)} modifiers={[tint(p.pct > 100 ? '#fb7185' : p.pct >= 85 ? '#fbbf24' : '#1dea00')]} />
        </VStack>
      ))}
      <Spacer />
    </VStack>
  );
}
