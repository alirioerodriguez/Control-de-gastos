import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { COLOR, URL_APP, URL_NUEVO, type DatosWidget } from './datos';

// Widget de Android: Disponible, lo gastado en el mes y «+ Gasto». Tocarlo abre la app; «+ Gasto» abre el formulario.
export function ResumenAndroid({ datos }: { datos: DatosWidget }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: URL_APP }}
      accessibilityLabel={datos ? `Mis Cuentas. Disponible ${datos.disponible}. Gastaste ${datos.gastado} en ${datos.mes}.` : 'Mis Cuentas. Abrí la app para ver tus cuentas.'}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: COLOR.fondo, borderRadius: 22, padding: 16, flexDirection: 'column', justifyContent: 'space-between' }}
    >
      {datos ? (
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget text="Disponible" style={{ fontSize: 13, color: COLOR.suave }} />
          <TextWidget text={datos.disponible} maxLines={1} style={{ fontSize: 26, fontWeight: '700', color: COLOR.texto }} />
          <TextWidget text={`Gastaste ${datos.gastado} en ${datos.mes}`} maxLines={2} style={{ fontSize: 13, color: COLOR.suave, marginTop: 4 }} />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget text="Mis Cuentas" style={{ fontSize: 17, fontWeight: '700', color: COLOR.texto }} />
          <TextWidget text="Abrí la app para ver tus cuentas acá." maxLines={2} style={{ fontSize: 13, color: COLOR.suave, marginTop: 4 }} />
        </FlexWidget>
      )}
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text={datos ? `Act. ${datos.actualizado}` : ''} style={{ fontSize: 11, color: COLOR.suave }} />
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: URL_NUEVO }}
          accessibilityLabel="Cargar un gasto"
          style={{ backgroundColor: COLOR.acento, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <TextWidget text="+ Gasto" style={{ fontSize: 14, fontWeight: '700', color: COLOR.texto }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
