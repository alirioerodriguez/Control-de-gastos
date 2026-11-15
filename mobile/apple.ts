// Iniciar sesión con Apple (obligatorio en la App Store si la app ofrece Google, regla 4.8).
// La ventana de Apple es del sistema; el token que devuelve se le pasa a la web, que entra con
// supabase.auth.signInWithIdToken (ver «Iniciar sesión con Apple» en index.html).
import type { RefObject } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

type Web = RefObject<{ injectJavaScript: (js: string) => void } | null>;

export async function entrarConApple(web: Web) {
  if (Platform.OS !== 'ios') return;
  const avisar = (msg: string) => web.current?.injectJavaScript(`window.__errorApple && window.__errorApple(${JSON.stringify(msg)}); true;`);
  try {
    if (!(await AppleAuthentication.isAvailableAsync())) { avisar('Este iPhone no permite iniciar sesión con Apple.'); return; }
    // Apple recibe el nonce cifrado; Supabase, el original, y comprueba que coincidan
    const nonce = Crypto.randomUUID();
    const cifrado = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: cifrado,
    });
    if (!cred.identityToken) { avisar('Apple no devolvió los datos. Probá de nuevo.'); return; }
    const nombre = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
    web.current?.injectJavaScript(
      `window.__entrarConApple(${JSON.stringify(cred.identityToken)}, ${JSON.stringify(nonce)}, ${JSON.stringify(nombre)}); true;`,
    );
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return; // la persona cerró la ventana
    avisar('No se pudo iniciar sesión con Apple. Probá de nuevo.');
  }
}
