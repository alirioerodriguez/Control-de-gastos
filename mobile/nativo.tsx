// Barra de abajo e Inicio nativos. La web sigue haciendo las cuentas (Disponible, cuotas, tarjetas) y le pasa
// a la app el resumen ya escrito (ver «APP NATIVA» en index.html): así las cifras nunca difieren de la web.
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
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

// Movimientos: la web filtra y escribe las filas (ver datosMovs en index.html); la app solo las dibuja
export type ClaseMov = 'gasto' | 'ingreso' | 'pase' | 'ahorro';
export type FilaMov = { k: string; id: string; dia: string; diaTxt: string; clase: ClaseMov; emoji: string; titulo: string; sub: string; monto: string };
export type Opcion = { v: string; t: string };
export type Movs = {
  mes: string; esteMes: boolean; busqueda: string; filtro: string; oculto: boolean;
  chips: { k: string; n: string }[]; titulo: string; etiqueta: string; total: string; conteo: string;
  cuenta: string; categoria: string; cuentas: Opcion[]; categorias: Opcion[]; filas: FilaMov[]; hayMas: boolean;
};

export function esMovs(x: unknown): x is Movs {
  const m = x as Movs;
  return !!m && typeof m.mes === 'string' && Array.isArray(m.filas) && Array.isArray(m.chips) && Array.isArray(m.cuentas) && Array.isArray(m.categorias);
}

/** Agrupa las filas por día, en el orden en que llegan (la más nueva primero). */
export function porDia(filas: FilaMov[]): { title: string; data: FilaMov[] }[] {
  const grupos: { title: string; data: FilaMov[] }[] = [];
  for (const f of filas) {
    const g = grupos[grupos.length - 1];
    if (g && g.data[0].dia === f.dia) g.data.push(f);
    else grupos.push({ title: f.diaTxt, data: [f] });
  }
  return grupos;
}

const T = {
  fondo: APP.fondo, tarjeta: '#17221b', linea: '#24342a', texto: APP.texto, suave: '#8fa396',
  acento: APP.acento, sobreAcento: APP.textoBoton, verde: '#4ade80', rojo: '#fb7185', azul: '#60a5fa', turquesa: '#2dd4bf',
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

const COLOR_CLASE: Record<ClaseMov, string> = { gasto: T.texto, ingreso: T.verde, pase: T.azul, ahorro: T.turquesa };

type PedidoMovs = { mes?: 1 | -1; filtro?: string; q?: string; cuenta?: string; categoria?: string };

// Movimientos: mes, tipo (chips), cuenta y categoría, buscador en toda la historia y la lista por día.
// Tocar una fila abre el detalle de la web, donde se edita o se borra.
export function Movimientos({ m, pedir, abrir, refrescar, refrescando }: {
  m: Movs; pedir: (p: PedidoMovs) => void; abrir: (k: string, id: string) => void; refrescar: () => void; refrescando: boolean;
}) {
  const [texto, setTexto] = useState(m.busqueda);
  const [elegir, setElegir] = useState<'cuenta' | 'categoria' | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Si la web limpió la búsqueda (por ejemplo, al tocar un chip), el buscador también se limpia
  useEffect(() => { setTexto((t) => (t.trim() === m.busqueda ? t : m.busqueda)); }, [m.busqueda]);
  useEffect(() => () => { if (espera.current) clearTimeout(espera.current); }, []);
  const buscar = (t: string) => {
    setTexto(t);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => pedir({ q: t }), 250);
  };
  const buscando = m.busqueda.length > 0;
  const nombreDe = (ops: Opcion[], v: string, todos: string) => (v ? ops.find((o) => o.v === v)?.t ?? todos : todos);
  const opciones = elegir === 'cuenta' ? m.cuentas : elegir === 'categoria' ? m.categorias : [];
  const actual = elegir === 'cuenta' ? m.cuenta : m.categoria;

  const filtro = (cual: 'cuenta' | 'categoria', valor: string, todos: string, ops: Opcion[]) => (
    <Pressable style={[s.filtro, valor ? s.filtroOn : null]} onPress={() => { toque(); setElegir(cual); }}
      accessibilityRole="button" accessibilityLabel={`${cual === 'cuenta' ? 'Cuenta' : 'Categoría'}: ${nombreDe(ops, valor, todos)}`}>
      <Text style={[s.filtroTexto, valor ? { color: T.sobreAcento } : null]} numberOfLines={1}>{nombreDe(ops, valor, todos)}</Text>
      <Icono ios="chevron.down" android="expand_more" color={valor ? T.sobreAcento : T.suave} tam={14} />
    </Pressable>
  );

  const cabecera = (
    <View>
      <Text style={s.hola} accessibilityRole="header">{m.titulo}</Text>
      {!buscando && (
        <View style={s.meses}>
          <Pressable onPress={() => { toque(); pedir({ mes: -1 }); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Mes anterior">
            <Icono ios="chevron.left" android="chevron_left" color={T.texto} />
          </Pressable>
          <Text style={s.mesTexto}>{m.mes.charAt(0).toUpperCase() + m.mes.slice(1)}</Text>
          <Pressable onPress={() => { toque(); pedir({ mes: 1 }); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Mes siguiente">
            <Icono ios="chevron.right" android="chevron_right" color={T.texto} />
          </Pressable>
        </View>
      )}
      <View style={s.buscador}>
        <Icono ios="magnifyingglass" android="search" color={T.suave} tam={18} />
        <TextInput value={texto} onChangeText={buscar} placeholder="Buscar en toda tu historia" placeholderTextColor={T.suave}
          style={s.buscadorTexto} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" accessibilityLabel="Buscar entre tus movimientos" />
        {texto.length > 0 && (
          <Pressable onPress={() => { toque(); buscar(''); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
            <Icono ios="xmark.circle.fill" android="cancel" color={T.suave} tam={18} />
          </Pressable>
        )}
      </View>
      {!buscando && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {m.chips.map((c) => {
            const on = c.k === m.filtro;
            return (
              <Pressable key={c.k} style={[s.chip, on && s.chipOn]} onPress={() => { toque(); pedir({ filtro: c.k }); }}
                accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={[s.chipTexto, on && { color: T.sobreAcento }]}>{c.n}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <View style={s.filtros}>
        {filtro('cuenta', m.cuenta, 'Todas las cuentas', m.cuentas)}
        {filtro('categoria', m.categoria, 'Todas las categorías', m.categorias)}
      </View>
      <View style={[s.tarjeta, { marginTop: 14 }]} accessible accessibilityLabel={`${m.etiqueta}: ${m.total}`}>
        <Text style={s.etiqueta}>{m.etiqueta}</Text>
        <Text style={[s.disponible, { fontSize: 32, color: T.texto }]} adjustsFontSizeToFit numberOfLines={1}>{m.total}</Text>
        {!!m.conteo && <Text style={[s.movSub, { marginTop: 4 }]}>{m.conteo}</Text>}
      </View>
    </View>
  );

  return (
    <>
      <SectionList
        style={{ backgroundColor: T.fondo }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        sections={porDia(m.filas)}
        keyExtractor={(f) => `${f.k}-${f.id}`}
        ListHeaderComponent={cabecera}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.suave} />}
        renderSectionHeader={({ section }) => <Text style={s.dia}>{section.title}</Text>}
        renderItem={({ item: f }) => (
          <Pressable style={({ pressed }) => [s.mov, pressed && { opacity: 0.6 }]} onPress={() => { toque(); abrir(f.k, f.id); }}
            accessibilityRole="button" accessibilityLabel={`${f.titulo}, ${f.monto}, ${f.diaTxt}. ${f.sub}`} accessibilityHint="Abre el detalle para editarlo">
            <View style={s.emoji}><Text style={{ fontSize: 20 }}>{f.emoji}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.movTitulo} numberOfLines={1}>{f.titulo}</Text>
              <Text style={s.movSub} numberOfLines={1}>{f.sub}</Text>
            </View>
            <Text style={[s.movMonto, { color: COLOR_CLASE[f.clase] ?? T.texto }]}>{f.monto}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={s.vacio}>{buscando ? 'No encontré movimientos con eso.' : 'Sin movimientos para ese filtro.'}</Text>}
        ListFooterComponent={m.hayMas ? <Text style={s.vacio}>Se muestran los primeros {m.filas.length}. Buscá algo más preciso para ver el resto.</Text> : undefined}
      />
      <Modal visible={elegir !== null} transparent animationType="slide" onRequestClose={() => setElegir(null)}>
        <Pressable style={s.velo} onPress={() => setElegir(null)} accessibilityLabel="Cerrar" />
        <View style={s.hoja}>
          <Text style={[s.subtitulo, { marginBottom: 8 }]}>{elegir === 'cuenta' ? 'Cuenta' : 'Categoría'}</Text>
          <FlatList
            data={opciones}
            keyExtractor={(o) => o.v || '_todas'}
            renderItem={({ item: o }) => {
              const on = o.v === actual;
              return (
                <Pressable style={s.opcion} onPress={() => { toque(); pedir(elegir === 'cuenta' ? { cuenta: o.v } : { categoria: o.v }); setElegir(null); }}
                  accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[s.movTitulo, { flex: 1 }]}>{o.t}</Text>
                  {on && <Icono ios="checkmark" android="check" color={T.acento} tam={18} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

// Plan: lo que viene este mes, presupuestos, ahorros y tarjetas (ver datosPlan en index.html)
export type ItemViene = { i: number; tipo: string; titulo: string; sub: string; cuando: string; monto: string; entra: boolean; urgente: boolean };
export type Plan = {
  mes: string; oculto: boolean; viene: ItemViene[]; sale: string; queda: string;
  presupuestos: { cat: string; emoji: string; gastado: string; limite: string; pct: number }[];
  ahorro: string; metas: { id: string; nombre: string; juntado: string; objetivo: string; pct: number | null }[];
  tarjetas: { id: string; nombre: string; total: string; pagada: boolean; cierre: string }[];
};

export function esPlan(x: unknown): x is Plan {
  const p = x as Plan;
  return !!p && typeof p.mes === 'string' && Array.isArray(p.viene) && Array.isArray(p.presupuestos) && Array.isArray(p.metas) && Array.isArray(p.tarjetas);
}

export type PedidoPlan = { ir: 'tar' | 'metas' | 'fijos' | 'presu' } | { viene: number } | { meta: string };

const Barrita = ({ pct, color }: { pct: number; color: string }) => (
  <View style={s.barraFondo}><View style={[s.barraLlena, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }]} /></View>
);

export function PlanNativo({ p, pedir, refrescar, refrescando }: { p: Plan; pedir: (q: PedidoPlan) => void; refrescar: () => void; refrescando: boolean }) {
  const ir = (q: PedidoPlan) => { toque(); pedir(q); };
  const titulo = (texto: string, destino: 'tar' | 'metas' | 'fijos' | 'presu', ver = 'Ver todo') => (
    <View style={s.tituloLista}>
      <Text style={s.subtitulo} accessibilityRole="header">{texto}</Text>
      <Pressable onPress={() => ir({ ir: destino })} hitSlop={10} accessibilityRole="link" accessibilityLabel={`${ver}: ${texto}`}><Text style={s.verTodos}>{ver}</Text></Pressable>
    </View>
  );
  const atajos: { k: 'tar' | 'metas' | 'fijos' | 'presu'; t: string; ios: SFSymbol; android: string }[] = [
    { k: 'tar', t: 'Tarjetas', ios: 'creditcard', android: 'credit_card' },
    { k: 'metas', t: 'Ahorros', ios: 'banknote', android: 'savings' },
    { k: 'fijos', t: 'Fijos', ios: 'repeat', android: 'repeat' },
    { k: 'presu', t: 'Presupuestos', ios: 'chart.pie', android: 'pie_chart' },
  ];
  return (
    <ScrollView style={{ backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.suave} />}>
      <Text style={s.hola} accessibilityRole="header">Plan</Text>
      <Text style={s.mes}>{p.mes.charAt(0).toUpperCase() + p.mes.slice(1)}</Text>

      <View style={s.atajos}>
        {atajos.map((a) => (
          <Pressable key={a.k} style={({ pressed }) => [s.atajo, pressed && { opacity: 0.6 }]} onPress={() => ir({ ir: a.k })} accessibilityRole="button">
            <Icono ios={a.ios} android={a.android} color={T.acento} tam={22} />
            <Text style={s.atajoTexto} numberOfLines={1}>{a.t}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[s.tarjeta, { marginTop: 16 }]} accessible accessibilityLabel={`Si pagás lo que viene, te quedan ${p.queda}. Sale ${p.sale}.`}>
        <Text style={s.etiqueta}>Si pagás lo que viene, te quedan</Text>
        <Text style={[s.disponible, { fontSize: 32 }]} adjustsFontSizeToFit numberOfLines={1}>{p.queda}</Text>
        <Text style={[s.movSub, { marginTop: 4 }]}>Sale este mes: {p.sale}</Text>
      </View>

      <View style={s.tituloLista}><Text style={s.subtitulo} accessibilityRole="header">Lo que viene este mes</Text></View>
      {p.viene.length === 0 ? <Text style={s.vacioIzq}>Nada pendiente por ahora.</Text> : p.viene.map((x) => (
        <Pressable key={x.i} style={({ pressed }) => [s.mov, pressed && { opacity: 0.6 }]} onPress={() => ir({ viene: x.i })}
          accessibilityRole="button" accessibilityLabel={`${x.titulo}, ${x.cuando}, ${x.monto}. ${x.sub}`}>
          <View style={[s.cuando, x.urgente && { backgroundColor: T.rojo }]}><Text style={[s.cuandoTexto, x.urgente && { color: '#1a0d10' }]} numberOfLines={2}>{x.cuando}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.movTitulo} numberOfLines={1}>{x.titulo}</Text>
            <Text style={s.movSub} numberOfLines={1}>{x.sub}</Text>
          </View>
          <Text style={[s.movMonto, { color: x.entra ? T.verde : T.texto }]}>{x.monto}</Text>
        </Pressable>
      ))}

      {titulo('Presupuestos', 'presu')}
      {p.presupuestos.length === 0 ? <Text style={s.vacioIzq}>Todavía no pusiste topes por categoría.</Text> : p.presupuestos.map((b) => (
        <Pressable key={b.cat} style={({ pressed }) => [s.fila, pressed && { opacity: 0.6 }]} onPress={() => ir({ ir: 'presu' })}
          accessibilityRole="button" accessibilityLabel={`${b.cat}: ${b.gastado} de ${b.limite}, ${b.pct} por ciento`}>
          <View style={s.filaArriba}>
            <Text style={s.movTitulo} numberOfLines={1}>{b.emoji} {b.cat}</Text>
            <Text style={[s.movSub, { marginTop: 0 }]}>{b.gastado} de {b.limite}</Text>
          </View>
          <Barrita pct={b.pct} color={b.pct >= 100 ? T.rojo : b.pct >= 80 ? '#fbbf24' : T.acento} />
        </Pressable>
      ))}

      {titulo('Ahorros', 'metas')}
      <Text style={s.movSub}>Juntado en total: {p.ahorro}</Text>
      {p.metas.length === 0 ? <Text style={s.vacioIzq}>Todavía no tenés metas. Creá una desde «Ver todo».</Text> : p.metas.map((m) => (
        <Pressable key={m.id} style={({ pressed }) => [s.fila, pressed && { opacity: 0.6 }]} onPress={() => ir({ meta: m.id })}
          accessibilityRole="button" accessibilityLabel={`${m.nombre}: ${m.juntado}${m.objetivo ? ` de ${m.objetivo}` : ''}`}>
          <View style={s.filaArriba}>
            <Text style={s.movTitulo} numberOfLines={1}>{m.nombre}</Text>
            <Text style={[s.movSub, { marginTop: 0 }]}>{m.juntado}{m.objetivo ? ` de ${m.objetivo}` : ''}</Text>
          </View>
          {m.pct !== null && <Barrita pct={m.pct} color={T.turquesa} />}
        </Pressable>
      ))}

      {titulo('Tarjetas', 'tar')}
      {p.tarjetas.length === 0 ? <Text style={s.vacioIzq}>No cargaste tarjetas.</Text> : p.tarjetas.map((c) => (
        <Pressable key={c.id} style={({ pressed }) => [s.mov, pressed && { opacity: 0.6 }]} onPress={() => ir({ ir: 'tar' })}
          accessibilityRole="button" accessibilityLabel={`${c.nombre}: resumen del mes ${c.total}${c.pagada ? ', pagado' : ''}`}>
          <View style={s.emoji}><Icono ios="creditcard.fill" android="credit_card" color={T.azul} tam={20} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.movTitulo} numberOfLines={1}>{c.nombre}</Text>
            <Text style={s.movSub} numberOfLines={1}>{[c.pagada ? 'pagado' : 'resumen del mes', c.cierre].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={[s.movMonto, c.pagada && { color: T.verde }]}>{c.total}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  atajos: { flexDirection: 'row', gap: 8, marginTop: 16 },
  atajo: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: T.tarjeta, borderRadius: 14, paddingVertical: 12, minHeight: 64 },
  atajoTexto: { color: T.texto, fontSize: 12, fontWeight: '600' },
  cuando: { width: 56, minHeight: 40, borderRadius: 12, backgroundColor: T.tarjeta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cuandoTexto: { color: T.texto, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  fila: { paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.linea },
  filaArriba: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  barraFondo: { height: 8, borderRadius: 4, backgroundColor: T.linea, overflow: 'hidden' },
  barraLlena: { height: 8, borderRadius: 4 },
  vacioIzq: { color: T.suave, fontSize: 15, lineHeight: 21, paddingVertical: 8 },
  meses: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 12 },
  mesTexto: { color: T.texto, fontSize: 17, fontWeight: '700' },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.tarjeta, borderRadius: 14, paddingHorizontal: 12, minHeight: 48 },
  buscadorTexto: { flex: 1, color: T.texto, fontSize: 16, paddingVertical: 10 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { paddingHorizontal: 16, minHeight: 40, borderRadius: 20, backgroundColor: T.tarjeta, justifyContent: 'center' },
  chipOn: { backgroundColor: T.acento },
  chipTexto: { color: T.texto, fontSize: 15, fontWeight: '600' },
  filtros: { flexDirection: 'row', gap: 8 },
  filtro: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, backgroundColor: T.tarjeta, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  filtroOn: { backgroundColor: T.acento },
  filtroTexto: { flex: 1, color: T.texto, fontSize: 14, fontWeight: '600' },
  dia: { color: T.suave, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 18, marginBottom: 2 },
  velo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  hoja: { backgroundColor: T.tarjeta, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 34, maxHeight: '70%' },
  opcion: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.linea },
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
