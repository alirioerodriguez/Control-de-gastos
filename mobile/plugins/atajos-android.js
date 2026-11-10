// Atajos del ícono en Android (mantener apretado el ícono): «Cargar un gasto» y «Dictar un gasto», como tenía la
// TWA. Cada uno abre miscuentas://nuevo o miscuentas://voz, que App.tsx le pasa a la web (?accion=…).
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ATAJOS = [
  { id: 'nuevo', corto: 'Cargar gasto', largo: 'Cargar un gasto', url: 'miscuentas://nuevo' },
  { id: 'voz', corto: 'Dictar gasto', largo: 'Dictar un gasto', url: 'miscuentas://voz' },
];

function xmlAtajos(paquete) {
  const items = ATAJOS.map(
    (a) => `  <shortcut android:shortcutId="${a.id}" android:enabled="true" android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/atajo_${a.id}_corto" android:shortcutLongLabel="@string/atajo_${a.id}_largo">
    <intent android:action="android.intent.action.VIEW" android:data="${a.url}" android:targetPackage="${paquete}"
      android:targetClass="${paquete}.MainActivity" />
  </shortcut>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n${items.join('\n')}\n</shortcuts>\n`;
}

module.exports = function atajosAndroid(config) {
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      const res = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.writeFileSync(path.join(res, 'xml', 'shortcuts.xml'), xmlAtajos(c.android.package));
      const valores = path.join(res, 'values', 'strings.xml');
      let s = fs.readFileSync(valores, 'utf8');
      for (const a of ATAJOS) {
        if (!s.includes(`atajo_${a.id}_corto`))
          s = s.replace('</resources>', `  <string name="atajo_${a.id}_corto">${a.corto}</string>\n  <string name="atajo_${a.id}_largo">${a.largo}</string>\n</resources>`);
      }
      fs.writeFileSync(valores, s);
      return c;
    },
  ]);
  return withAndroidManifest(config, (c) => {
    const actividad = AndroidConfig.Manifest.getMainActivityOrThrow(c.modResults);
    actividad['meta-data'] = (actividad['meta-data'] || []).filter((m) => m.$['android:name'] !== 'android.app.shortcuts');
    actividad['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    return c;
  });
};
