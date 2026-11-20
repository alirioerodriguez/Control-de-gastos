// Más widgets de Android: últimos movimientos, lo que viene en el mes, atajos para cargar y presupuestos.
// Las cifras llegan ya escritas desde la web (datosWidget en index.html) y respetan «ocultar montos».
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { COLOR, URL_APP, URL_INGRESO, URL_NUEVO, URL_PRESU, URL_VOZ, type DatosWidget } from './datos';

export const W_MOVS = 'Movimientos';
export const W_VIENE = 'LoQueViene';
export const W_ATAJOS = 'Atajos';
export const W_PRESU = 'Presupuestos';

// Íconos de línea (Lucide), sin emojis
const svg = (cuerpo: string, color: string, tam: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
const ICONO = {
  mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
  menos: '<path d="M5 12h14"/>',
  mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  abajo: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  arriba: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
};
type NombreIcono = keyof typeof ICONO;
const Icono = ({ n, color, tam = 18 }: { n: NombreIcono; color: string; tam?: number }) => <SvgWidget svg={svg(ICONO[n], color, tam)} style={{ width: tam, height: tam }} />;

function Marco({ children, uri = URL_APP, etiqueta }: { children: React.ReactNode; uri?: string; etiqueta: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      accessibilityLabel={etiqueta}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: COLOR.fondo, borderRadius: 22, padding: 14, flexDirection: 'column', flexGap: 8 }}
    >
      {children}
    </FlexWidget>
  );
}

const Titulo = ({ texto, derecha }: { texto: string; derecha?: string }) => (
  <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
    <TextWidget text={texto} style={{ fontSize: 13, fontWeight: '700', color: COLOR.suave }} />
    {derecha ? <TextWidget text={derecha} style={{ fontSize: 11, color: COLOR.suave }} /> : <TextWidget text=" " style={{ fontSize: 2 }} />}
  </FlexWidget>
);

const SinSesion = ({ etiqueta }: { etiqueta: string }) => (
  <Marco etiqueta={etiqueta}>
    <TextWidget text="Mis Cuentas" style={{ fontSize: 17, fontWeight: '700', color: COLOR.texto }} />
    <TextWidget text="Abrí la app para ver tus cuentas acá." maxLines={2} style={{ fontSize: 13, color: COLOR.suave }} />
  </Marco>
);

// Cuántas filas entran en el alto del widget (cada fila ~34 dp, más título y márgenes)
const filasQueEntran = (alto: number, max: number) => Math.max(1, Math.min(max, Math.floor((alto - 28 - 26) / 34)));

export function MovimientosAndroid({ datos, alto = 180 }: { datos: DatosWidget; alto?: number }) {
  if (!datos) return <SinSesion etiqueta="Mis Cuentas: últimos movimientos" />;
  const movs = (datos.movimientos ?? []).slice(0, filasQueEntran(alto, 4));
  return (
    <Marco etiqueta={`Mis Cuentas: tus últimos ${movs.length} movimientos`}>
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="Últimos movimientos" style={{ fontSize: 13, fontWeight: '700', color: COLOR.suave }} />
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: URL_NUEVO }} accessibilityLabel="Cargar un gasto"
          style={{ backgroundColor: COLOR.acento, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
          <TextWidget text="+ Gasto" style={{ fontSize: 13, fontWeight: '700', color: COLOR.textoAcento }} />
        </FlexWidget>
      </FlexWidget>
      {movs.length ? (
        movs.map((m, i) => (
          <FlexWidget key={i} style={{ flexDirection: 'row', alignItems: 'center', flexGap: 10, width: 'match_parent' }}>
            <FlexWidget style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: COLOR.tarjeta, alignItems: 'center', justifyContent: 'center' }}>
              <Icono n={m.ingreso ? 'arriba' : 'abajo'} color={m.ingreso ? COLOR.verde : COLOR.suave} tam={14} />
            </FlexWidget>
            <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
              <TextWidget text={m.titulo} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: '600', color: COLOR.texto }} />
              <TextWidget text={m.fecha} style={{ fontSize: 11, color: COLOR.suave }} />
            </FlexWidget>
            <TextWidget text={`${m.ingreso ? '+' : '−'}${m.monto}`} style={{ fontSize: 14, fontWeight: '700', color: m.ingreso ? COLOR.verde : COLOR.texto }} />
          </FlexWidget>
        ))
      ) : (
        <TextWidget text="Todavía no cargaste nada este mes." maxLines={2} style={{ fontSize: 13, color: COLOR.suave }} />
      )}
    </Marco>
  );
}

export function VieneAndroid({ datos, alto = 180 }: { datos: DatosWidget; alto?: number }) {
  if (!datos) return <SinSesion etiqueta="Mis Cuentas: lo que viene" />;
  const v = datos.viene;
  const items = (v?.items ?? []).slice(0, filasQueEntran(alto - 22, 4));
  return (
    <Marco etiqueta={v ? `Mis Cuentas: te falta pagar ${items.length} cosas este mes. Te quedaría ${v.queda}.` : 'Mis Cuentas: lo que viene'}>
      <Titulo texto="Lo que viene" derecha={datos.mes} />
      {items.length ? (
        items.map((x, i) => (
          <FlexWidget key={i} style={{ flexDirection: 'row', alignItems: 'center', flexGap: 10, width: 'match_parent' }}>
            <FlexWidget style={{ width: 4, height: 26, borderRadius: 2, backgroundColor: x.urgente ? COLOR.ambar : COLOR.linea }} />
            <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
              <TextWidget text={x.titulo} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: '600', color: COLOR.texto }} />
              <TextWidget text={x.cuando || 'sin día'} style={{ fontSize: 11, color: x.urgente ? COLOR.ambar : COLOR.suave }} />
            </FlexWidget>
            <TextWidget text={x.monto} style={{ fontSize: 14, fontWeight: '700', color: COLOR.texto }} />
          </FlexWidget>
        ))
      ) : (
        <TextWidget text="No te queda nada por pagar este mes." maxLines={2} style={{ fontSize: 13, color: COLOR.suave }} />
      )}
      {v && items.length ? (
        <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
          <TextWidget text="Te quedaría" style={{ fontSize: 12, color: COLOR.suave }} />
          <TextWidget text={v.queda} style={{ fontSize: 13, fontWeight: '700', color: COLOR.acento }} />
        </FlexWidget>
      ) : (
        <TextWidget text=" " style={{ fontSize: 2 }} />
      )}
    </Marco>
  );
}

export function AtajosAndroid({ datos }: { datos: DatosWidget }) {
  const boton = (uri: string, n: NombreIcono, texto: string, principal = false) => (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri }} accessibilityLabel={texto}
      style={{ flex: 1, height: 'match_parent', borderRadius: 16, backgroundColor: principal ? COLOR.acento : COLOR.tarjeta, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexGap: 6 }}>
      <Icono n={n} color={principal ? COLOR.textoAcento : COLOR.texto} tam={18} />
      <TextWidget text={texto} style={{ fontSize: 14, fontWeight: '700', color: principal ? COLOR.textoAcento : COLOR.texto }} />
    </FlexWidget>
  );
  return (
    <FlexWidget accessibilityLabel={datos ? 'Mis Cuentas: atajos para cargar' : 'Mis Cuentas'}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: COLOR.fondo, borderRadius: 22, padding: 8, flexDirection: 'row', flexGap: 8 }}>
      {boton(URL_VOZ, 'mic', 'Dictar', true)}
      {boton(URL_NUEVO, 'menos', 'Gasto')}
      {boton(URL_INGRESO, 'mas', 'Ingreso')}
    </FlexWidget>
  );
}

export function PresupuestosAndroid({ datos }: { datos: DatosWidget }) {
  if (!datos) return <SinSesion etiqueta="Mis Cuentas: presupuestos" />;
  const ps = datos.presupuestos ?? [];
  return (
    <Marco uri={URL_PRESU} etiqueta={ps.length ? `Mis Cuentas: presupuestos. ${ps.map((p) => `${p.cat} al ${p.pct}%`).join(', ')}` : 'Mis Cuentas: presupuestos'}>
      <Titulo texto="Presupuestos" derecha={datos.mes} />
      {ps.length ? (
        ps.map((p, i) => {
          const color = p.pct > 100 ? COLOR.rojo : p.pct >= 85 ? COLOR.ambar : COLOR.acento;
          return (
            <FlexWidget key={i} style={{ flexDirection: 'column', flexGap: 4, width: 'match_parent' }}>
              <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
                <TextWidget text={p.cat} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: '600', color: COLOR.texto }} />
                <TextWidget text={`${p.gastado} de ${p.limite}`} style={{ fontSize: 11, color: p.pct > 100 ? COLOR.rojo : COLOR.suave }} />
              </FlexWidget>
              <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', height: 6, borderRadius: 3, backgroundColor: COLOR.tarjeta }}>
                <FlexWidget style={{ flex: Math.min(100, Math.max(2, p.pct)), height: 6, borderRadius: 3, backgroundColor: color }} />
                {p.pct < 100 ? <FlexWidget style={{ flex: 100 - Math.max(2, p.pct), height: 6 }} /> : <TextWidget text="" style={{ fontSize: 1 }} />}
              </FlexWidget>
            </FlexWidget>
          );
        })
      ) : (
        <TextWidget text="Armá un presupuesto por categoría en Plan → Presupuestos." maxLines={2} style={{ fontSize: 13, color: COLOR.suave }} />
      )}
    </Marco>
  );
}
