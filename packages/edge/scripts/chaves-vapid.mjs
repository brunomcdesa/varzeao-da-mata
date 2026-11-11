// Gera o par de chaves VAPID dos Avisos do App (ADR-0042). Rode na sua máquina; nada sai daqui.
// No GitHub, ambiente PROD: a pública na variável LIGA_VAPID_PUBLICA e a privada no segredo
// VAPID_PRIVADA. O workflow borda repassa as duas para a borda. Não cole a privada em chat nem commite.
import { generateVAPIDKeys } from 'web-push-neo';

const { publicKey, privateKey } = await generateVAPIDKeys();
console.log(`Pública (pode ver):  ${publicKey}`);
console.log(`Privada (segredo):   ${privateKey}`);
