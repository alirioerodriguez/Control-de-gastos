// Barra de abajo e Inicio nativos. La web sigue haciendo las cuentas (Disponible, cuotas, tarjetas) y le pasa
// a la app el resumen ya escrito (ver «APP NATIVA» en index.html): así las cifras nunca difieren de la web.
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import type { SFSymbol } from 'sf-symbols-typescript';
import { APP } from './config';

export type Movimiento = { id: string; fecha: string; titulo: string; categoria: string; emoji: string; monto: string; ingreso: boolean };
export type Resumen = {
  nombre: string; mes: string; moneda: string; oculto: boolean;
  disponible: string; gastado: string; ingresado: string; movimientos: Movimiento[];
};

export function esResumen(x: unknown): x is Resumen {
  const r = x as Resumen;
  return !!r && typeof r.disponible === 'string' && typeof r.gastado === 'string' && Array.isArray(r.movimientos);
}

const T = {
  fondo: APP.fondo, tarjeta: '#17221b', linea: '#24342a', texto: APP.texto, suave: '#8fa396',
  acento: APP.acento, sobreAcento: APP.textoBoton, verde: '#4ade80', rojo: '#fb7185',
};

const toque = () => Haptics.selectionAsync().catch(() => {});

export type Pestana = 'app' | 'movs' | 'tar' | 'mas';
const PESTANAS: { id: Pestana; texto: string; ios: SFSymbol; android: string }[] = [
  { id: 'app', texto: 'Inicio', ios: 'house.fill', android: 'home' },
  { id: 'movs', texto: 'Movimientos', ios: 'list.bullet', android: 'list' },
  { id: 'tar', texto: 'Plan', ios: 'safari', android: 'explore' },
  { id: 'mas', texto: 'Más', ios: 'line.3.horizontal', android: 'menu' },
];

function Icono({ ios, android, color, tam = 24 }: { ios: SFSymbol; android: string; color: string; tam?: number }) {
  return <SymbolView name={{ ios, android: android as never }} tintColor={color} size={tam} fallback={<View style={{ width: tam, height: tam }} />} />;
}

// Barra de abajo: Inicio, Movimientos, «+» (cargar), Plan y Más
export function Barra({ actual, ir, cargar, dictar, abajo }: { actual: Pestana | null; ir: (p: Pestana) => void; cargar: () => void; dictar: () => void; abajo: number }) {
  const boton = (p: (typeof PESTANAS)[number]) => {
    const on = actual === p.id;
    const color = on ? T.acento : T.suave;
    return (
      <Pressable key={p.id} style={s.item} onPress={() => { toque(); ir(p.id); }}
        accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={p.texto}>
        <Icono ios={p.ios} android={p.android} color={color} />
        <Text style={[s.itemTexto, { color }]} numberOfLines={1}>{p.texto}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.barra, { paddingBottom: Math.max(abajo, 8) }]} accessibilityRole="tabbar">
      {boton(PESTANAS[0])}{boton(PESTANAS[1])}
      <View style={s.item}>
        <Pressable style={s.mas} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); cargar(); }}
          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); dictar(); }}
          accessibilityRole="button" accessibilityLabel="Cargar un movimiento" accessibilityHint="Mantené apretado para dictarlo">
          <Icono ios="plus" android="add" color={T.sobreAcento} tam={26} />
        </Pressable>
      </View>
      {boton(PESTANAS[2])}{boton(PESTANAS[3])}
    </View>
  );
}

// Inicio: Disponible del mes, lo gastado y lo ingresado, botones para cargar o dictar y los últimos movimientos
export function Inicio({ r, cargar, dictar, verMovs, ocultar, refrescar, refrescando }: {
  r: Resumen; cargar: () => void; dictar: () => void; verMovs: () => void; ocultar: () => void; refrescar: () => void; refrescando: boolean;
}) {
  const cabecera = (
    <View>
      <View style={s.saludo}>
        <View style={{ flex: 1 }}>
          <Text style={s.hola} accessibilityRole="header">{r.nombre ? `Hola, ${r.nombre.split(' ')[0]}` : 'Mis Cuentas'}</Text>
          <Text style={s.mes}>{r.mes.charAt(0).toUpperCase() + r.mes.slice(1)}</Text>
        </View>
        <Pressable onPress={() => { toque(); ocultar(); }} hitSlop={12} accessibilityRole="button"
          accessibilityLabel={r.oculto ? 'Mostrar los montos' : 'Ocultar los montos'}>
          <Icono ios={r.oculto ? 'eye.slash' : 'eye'} android={r.oculto ? 'visibility_off' : 'visibility'} color={T.suave} />
        </Pressable>
      </View>

      <View style={s.tarjeta} accessible accessibilityLabel={`Disponible: ${r.disponible}`}>
        <Text style={s.etiqueta}>Disponible</Text>
        <Text style={s.disponible} adjustsFontSizeToFit numberOfLines={1}>{r.disponible}</Text>
        <View style={s.fila2}>
          <View style={{ flex: 1 }}><Text style={s.etiqueta}>Gastado</Text><Text style={[s.cifra, { color: T.rojo }]}>{r.gastado}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.etiqueta}>Ingresado</Text><Text style={[s.cifra, { color: T.verde }]}>{r.ingresado}</Text></View>
        </View>
      </View>

      <View style={s.acciones}>
        <Pressable style={[s.accion, s.accionPpal]} onPress={() => { toque(); dictar(); }} accessibilityRole="button">
          <Icono ios="mic.fill" android="mic" color={T.sobreAcento} tam={20} />
          <Text style={[s.accionTexto, { color: T.sobreAcento }]}>Dictar</Text>
        </Pressable>
        <Pressable style={s.accion} onPress={() => { toque(); cargar(); }} accessibilityRole="button">
          <Icono ios="square.and.pencil" android="edit" color={T.texto} tam={20} />
          <Text style={s.accionTexto}>Escribir</Text>
        </Pressable>
      </View>

      <View style={s.tituloLista}>
        <Text style={s.subtitulo}>Últimos movimientos</Text>
        {r.movimientos.length > 0 && (
          <Pressable onPress={() => { toque(); verMovs(); }} hitSlop={10} accessibilityRole="link"><Text style={s.verTodos}>Ver todos</Text></Pressable>
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      data={r.movimientos}
      keyExtractor={m => m.id}
      ListHeaderComponent={cabecera}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.suave} />}
      renderItem={({ item: m }) => (
        <Pressable style={({ pressed }) => [s.mov, pressed && { opacity: 0.6 }]} onPress={verMovs}
          accessibilityLabel={`${m.titulo}, ${m.ingreso ? 'ingreso' : 'gasto'} de ${m.monto}, ${m.fecha}`}>
          <View style={s.emoji}><Text style={{ fontSize: 20 }}>{m.emoji}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.movTitulo} numberOfLines={1}>{m.titulo}</Text>
            <Text style={s.movSub} numberOfLines={1}>{[m.categoria, m.fecha].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={[s.movMonto, { color: m.ingreso ? T.verde : T.texto }]}>{m.ingreso ? '+' : '−'}{m.monto}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={s.vacio}>Todavía no cargaste nada este mes. Tocá «Dictar» y decí, por ejemplo: «12 mil en el súper».</Text>}
    />
  );
}

const s = StyleSheet.create({
  barra: { flexDirection: 'row', backgroundColor: T.tarjeta, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.linea, paddingTop: 6 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, gap: 2 },
  itemTexto: { fontSize: 11, fontWeight: '600' },
  mas: { width: 52, height: 52, borderRadius: 26, backgroundColor: T.acento, alignItems: 'center', justifyContent: 'center', marginTop: -14 },
  saludo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  hola: { color: T.texto, fontSize: 28, fontWeight: '800' },
  mes: { color: T.suave, fontSize: 15, marginTop: 2 },
  tarjeta: { backgroundColor: T.tarjeta, borderRadius: 20, padding: 20 },
  etiqueta: { color: T.suave, fontSize: 13, fontWeight: '600' },
  disponible: { color: T.acento, fontSize: 40, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  fila2: { flexDirection: 'row', marginTop: 16 },
  cifra: { fontSize: 18, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 14 },
  accion: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: T.tarjeta, borderRadius: 14, minHeight: 52 },
  accionPpal: { backgroundColor: T.acento },
  accionTexto: { color: T.texto, fontSize: 16, fontWeight: '700' },
  tituloLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 8 },
  subtitulo: { color: T.texto, fontSize: 20, fontWeight: '700' },
  verTodos: { color: T.acento, fontSize: 15, fontWeight: '600' },
  mov: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.linea },
  emoji: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.tarjeta, alignItems: 'center', justifyContent: 'center' },
  movTitulo: { color: T.texto, fontSize: 16, fontWeight: '600' },
  movSub: { color: T.suave, fontSize: 13, marginTop: 2 },
  movMonto: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  vacio: { color: T.suave, fontSize: 15, textAlign: 'center', marginTop: 24, lineHeight: 21 },
});
