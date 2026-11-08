/** Um pedido de voz só, para ler a resposta exata da API (cota, limites). */
import { MODELO_PADRAO, VOZ_PADRAO, pedidoGemini } from './gemini.js';
const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
  method: 'POST',
  headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
  body: JSON.stringify(pedidoGemini('Teste.', 'normal', process.env.VOZ || VOZ_PADRAO, MODELO_PADRAO)),
});
console.log('status', resp.status);
const texto = await resp.text();
console.log(resp.ok ? 'ok: a voz respondeu' : texto.slice(0, 3000));
