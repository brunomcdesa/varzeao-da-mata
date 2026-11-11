// Gera o par de chaves VAPID dos Avisos do App (ADR-0041). Rode na sua máquina; nada sai daqui.
// A pública vai em vars.LIGA_VAPID_PUBLICA (GitHub) e no segredo VAPID_PUBLICA da borda;
// a privada só no segredo VAPID_PRIVADA da borda. Não cole a privada em chat nem commite.
import { generateVAPIDKeys } from 'web-push-neo';

const { publicKey, privateKey } = await generateVAPIDKeys();
console.log(`Pública (pode ver):  ${publicKey}`);
console.log(`Privada (segredo):   ${privateKey}`);
