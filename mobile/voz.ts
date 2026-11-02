// Dictado por voz dentro de la app. La web usa el reconocimiento de voz del navegador (webkitSpeechRecognition),
// que Chrome tiene pero la vista web de Android no. Si falta, se inyecta uno que le pide al teléfono que escuche
// (expo-speech-recognition) y devuelve los resultados con la misma forma que el del navegador: la web no cambia.
import { useEffect, type RefObject } from 'react';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export const POLYFILL_VOZ = `(function () {
  if (window.SpeechRecognition || window.webkitSpeechRecognition || window.__vozApp) return; window.__vozApp = true;
  var actual = null;
  var enviar = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  function SR() { this.lang = 'es-AR'; this.continuous = false; this.interimResults = false; this._lista = []; }
  SR.prototype.start = function () {
    if (actual && actual !== this) { var viejo = actual; actual = null; if (viejo.onend) try { viejo.onend({}); } catch (e) {} }
    actual = this; this._lista = [];
    enviar({ type: 'voz', accion: 'start', lang: this.lang, continuous: !!this.continuous, interimResults: !!this.interimResults });
  };
  SR.prototype.stop = function () { enviar({ type: 'voz', accion: 'stop' }); };
  SR.prototype.abort = function () { enviar({ type: 'voz', accion: 'abort' }); };
  window.__vozDesdeApp = function (ev) {
    var r = actual; if (!r) return;
    if (ev.tipo === 'start') { if (r.onstart) r.onstart({}); }
    else if (ev.tipo === 'result') {
      var l = r._lista, t = ev.texto || '', i;
      if (l.length && !l[l.length - 1].isFinal) { i = l.length - 1; l[i] = { transcript: t, isFinal: !!ev.isFinal }; }
      else { l.push({ transcript: t, isFinal: !!ev.isFinal }); i = l.length - 1; }
      var results = l.map(function (x) { var o = [{ transcript: x.transcript, confidence: 1 }]; o.isFinal = x.isFinal; return o; });
      if (r.onresult) r.onresult({ resultIndex: i, results: results });
    }
    else if (ev.tipo === 'error') { if (r.onerror) r.onerror({ error: ev.error, message: ev.message || '' }); }
    else if (ev.tipo === 'end') { actual = null; if (r.onend) r.onend({}); }
  };
  window.SpeechRecognition = window.webkitSpeechRecognition = SR;
})(); true;`;

// Lo único que hace falta de la vista web: poder ejecutarle código.
type ConInyeccion = { injectJavaScript: (js: string) => void };
type PedidoVoz = { accion?: string; lang?: string; continuous?: boolean; interimResults?: boolean };

const aWeb = (web: RefObject<ConInyeccion | null>, ev: object) =>
  web.current?.injectJavaScript(`window.__vozDesdeApp && window.__vozDesdeApp(${JSON.stringify(ev)}); true;`);

// Escucha al reconocedor del teléfono y le pasa todo a la web.
export function useVozNativa(web: RefObject<ConInyeccion | null>) {
  useEffect(() => {
    const subs = [
      ExpoSpeechRecognitionModule.addListener('start', () => aWeb(web, { tipo: 'start' })),
      ExpoSpeechRecognitionModule.addListener('end', () => aWeb(web, { tipo: 'end' })),
      ExpoSpeechRecognitionModule.addListener('result', (e) => aWeb(web, { tipo: 'result', isFinal: e.isFinal, texto: e.results[0]?.transcript ?? '' })),
      ExpoSpeechRecognitionModule.addListener('error', (e) => aWeb(web, { tipo: 'error', error: e.error, message: e.message })),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [web]);
}

export async function pedidoVoz(web: RefObject<ConInyeccion | null>, p: PedidoVoz) {
  try {
    if (p.accion === 'stop') return ExpoSpeechRecognitionModule.stop();
    if (p.accion === 'abort') return ExpoSpeechRecognitionModule.abort();
    if (p.accion !== 'start') return;
    const permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permiso.granted) { aWeb(web, { tipo: 'error', error: 'not-allowed' }); aWeb(web, { tipo: 'end' }); return; }
    ExpoSpeechRecognitionModule.start({ lang: p.lang || 'es-AR', interimResults: !!p.interimResults, continuous: !!p.continuous });
  } catch {
    aWeb(web, { tipo: 'error', error: 'audio-capture' }); aWeb(web, { tipo: 'end' });
  }
}
