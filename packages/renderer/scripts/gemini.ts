/**
 * Voz do Locutor via Gemini TTS (API Interactions, REST, sem SDK).
 *
 * Variáveis de ambiente:
 *   GEMINI_API_KEY      chave do Google AI Studio (aistudio.google.com/apikey)
 *   GEMINI_TTS_VOZ      voz (padrão Lumi; procure outras com `pnpm vozes --gemini <nome>`)
 *   GEMINI_TTS_MODELO   modelo (padrão gemini-3.8-flash-tts)
 *   GEMINI_TTS_RPM      pedidos por minuto permitidos pelo seu plano (padrão 3, o do plano grátis)
 *
 * Os pedidos são espaçados para respeitar o limite do plano; se a API ainda assim pedir
 * para esperar (429), o gravador espera o tempo indicado e tenta de novo. Com o cache de
 * falas, só frases novas passam pela API.
 *
 * A emoção vem do campo `style` (speech_metadata), separado do texto lido, com um estilo
 * por Tom da fala. A API devolve WAV 24 kHz mono; aqui ele vira 48 kHz, o formato da mixagem.
 */
import { codificarWav, lerWavMono } from '../src/audio.js';
import type { Tom } from '../src/narracao.js';

export const MODELO_PADRAO = 'gemini-3.8-flash-tts';
/** Modelo de reserva, com cota diária própria (a cota é por modelo). */
export const MODELO_LITE = 'gemini-3.8-flash-lite-tts';
export const VOZ_PADRAO = 'Lumi';

const BASE = 'Narrador de futebol de várzea brasileiro, voz de rádio, sotaque brasileiro';
export const ESTILO: Record<Tom, string> = {
  normal: `${BASE}, animado, ritmo rápido, acompanhando a jogada com expectativa.`,
  animado: `${BASE}, muito empolgado, voz alta, reagindo ao lance com emoção.`,
  grito: `${BASE}, gritando o gol a plenos pulmões, eufórico e rouco, esticando bem a vogal de "gol" como nas rádios.`,
};

/**
 * Vozes criadas no Voice design (id voice_...) já trazem a persona (idade, timbre, sotaque);
 * a Google recomenda estilo curto, só com a emoção do momento, para a voz não mudar de
 * identidade. Estilo longo ("gritando a plenos pulmões, rouco") fazia a voz afinar.
 */
export const ESTILO_CURTO: Record<Tom, string> = {
  normal: 'Narrando o jogo, ritmo rápido.',
  animado: 'Empolgado, reagindo ao lance.',
  grito: 'Gritando o gol, eufórico.',
};
/**
 * `jeito`: o jeito de narrar próprio do Narrador (ritmo e postura), que vai antes da emoção do
 * momento. Sem jeito, vale o estilo de sempre: curto para vozes do Voice design, longo para as outras.
 */
export const estiloDe = (tom: Tom, voz: string, jeito?: string) =>
  jeito ? `${jeito} ${ESTILO_CURTO[tom]}` : (voz.startsWith('voice_') ? ESTILO_CURTO : ESTILO)[tom];

/**
 * Grafia só para a voz. As vozes criadas no Voice design às vezes leem "Varzeão" como
 * "Varzeadão"; com o circunflexo ("Varzêão") acertam. A voz pronta (Lumi, o Beto Bola)
 * lê certo como se escreve, e com o circunflexo puxava para "Varzeaão" (ouvido em 08/11).
 * Na tela e nas legendas é sempre "Varzeão".
 *
 * "OVR" se fala "ôver" (como "over") em qualquer voz. Na tela e nas legendas é sempre "OVR".
 */
export const paraFalar = (texto: string, voz: string) => {
  if (process.env.SEM_GRAFIA === '1') return texto;
  const t = texto.replace(/\bOVR\b/g, 'ôver');
  return voz.startsWith('voice_') ? t.replace(/Varzeão/g, 'Varzêão').replace(/VARZEÃO/g, 'VARZÊÃO') : t;
};

export function pedidoGemini(texto: string, tom: Tom, voz: string, modelo: string, jeito?: string): unknown {
  return {
    model: modelo,
    input: [
      {
        type: 'user_input',
        content: [{ type: 'text', text: paraFalar(texto, voz), annotations: [{ type: 'speech_metadata', style: estiloDe(tom, voz, jeito) }] }],
      },
    ],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
    generation_config: { speech_config: [{ voice: voz }] },
  };
}

interface RespostaGemini {
  steps?: { type?: string; content?: { type?: string; data?: string }[] }[];
}

/** Tira o áudio (base64) da resposta: steps[] → model_output → content[] → audio.data. */
export function extrairAudio(resposta: RespostaGemini): Uint8Array {
  for (const passo of resposta.steps ?? []) {
    if (passo.type !== 'model_output') continue;
    for (const c of passo.content ?? []) {
      if (c.type === 'audio' && c.data) return Uint8Array.from(Buffer.from(c.data, 'base64'));
    }
  }
  throw new Error('a resposta do Gemini não trouxe áudio');
}

/** Converte um WAV (qualquer taxa, 16 bits) para WAV 48 kHz mono, por interpolação linear. */
export function para48k(wav: Uint8Array): Uint8Array {
  const { amostras, taxa } = lerWavMono(wav);
  if (taxa === 48000) return codificarWav(amostras, amostras);
  const n = Math.floor((amostras.length * 48000) / taxa);
  const saida = new Float32Array(n);
  const passo = taxa / 48000;
  for (let i = 0; i < n; i++) {
    const p = i * passo;
    const k = Math.floor(p);
    const f = p - k;
    saida[i] = (amostras[k] ?? 0) * (1 - f) + (amostras[k + 1] ?? amostras[k] ?? 0) * f;
  }
  return codificarWav(saida, saida);
}

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Quando o próximo pedido pode sair (espaçamento pelo limite por minuto do plano). */
let proximoPedido = 0;

async function aguardarVez(): Promise<void> {
  const rpm = Math.max(1, Number(process.env.GEMINI_TTS_RPM) || 3);
  const intervalo = 60_000 / rpm + 500;
  const espera = proximoPedido - Date.now();
  if (espera > 1500) console.log(`  … aguardando ${Math.ceil(espera / 1000)} s (limite de ${rpm} pedidos/min do Gemini)`);
  if (espera > 0) await dormir(espera);
  proximoPedido = Date.now() + intervalo;
}

/** Segundos que a API pediu para esperar ("retry in 19s", "retry in 11h15m6s"), se houver. */
export function esperaPedida(mensagem: string): number | null {
  const m = /retry in ((?:[\d.]+\s*[hms]\s*)+)/i.exec(mensagem);
  if (!m) return null;
  let total = 0;
  for (const [, n, u] of m[1]!.matchAll(/([\d.]+)\s*([hms])/gi)) total += Number(n) * (u!.toLowerCase() === 'h' ? 3600 : u!.toLowerCase() === 'm' ? 60 : 1);
  return total;
}

/** A cota do dia acabou: não adianta esperar alguns segundos. */
export class CotaDiariaEsgotada extends Error {
  constructor(readonly volta: number | null, detalhe = '') {
    super(`a cota diária do Gemini TTS acabou${volta ? ` (volta em ~${Math.ceil(volta / 3600)} h)` : ''}${detalhe ? `: ${detalhe.slice(0, 600)}` : ''}`);
  }
}

/** Esperas acima disso não são o limite por minuto, e sim a cota do dia. */
const ESPERA_MAXIMA = 120;

/** Faz um pedido à API, respeitando o limite por minuto; devolve WAV 48 kHz. */
async function pedir(corpo: unknown, chave: string, descricao: string): Promise<Uint8Array> {
  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    await aguardarVez();
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    if (resp.ok) return para48k(extrairAudio((await resp.json()) as RespostaGemini));
    ultimoErro = `${resp.status} ${await resp.text()}`;
    if (resp.status !== 429 && resp.status < 500) break;
    const espera = esperaPedida(ultimoErro);
    if (resp.status === 429 && (/per day|daily/i.test(ultimoErro) || (espera ?? 0) > ESPERA_MAXIMA)) throw new CotaDiariaEsgotada(espera, ultimoErro);
    // Limite por minuto (ou instabilidade): espera o que a API pediu e tenta de novo.
    const segundos = (espera ?? 5 * tentativa) + 1;
    console.log(`  … Gemini pediu para esperar ${Math.ceil(segundos)} s (tentativa ${tentativa})`);
    proximoPedido = Date.now() + segundos * 1000;
  }
  throw new Error(`Gemini TTS recusou ${descricao}: ${ultimoErro}`);
}

export function falarGemini(texto: string, tom: Tom, chave: string, voz: string, modelo: string, jeito?: string): Promise<Uint8Array> {
  return pedir(pedidoGemini(texto, tom, voz, modelo, jeito), chave, `a fala "${texto}"`);
}

/**
 * Várias falas num pedido só, cada uma com o estilo do seu tom (a API aceita um item de
 * texto por fala, cada um com seu speech_metadata). Pausas longas no fim de cada fala
 * permitem cortar o áudio depois.
 */
export function pedidoGeminiVarias(falas: { texto: string; tom: Tom }[], voz: string, modelo: string, jeito?: string): unknown {
  return {
    model: modelo,
    input: [
      {
        type: 'user_input',
        content: falas.map((f, i) => ({
          type: 'text',
          text: paraFalar(i < falas.length - 1 ? f.texto + SEPARADOR : f.texto, voz),
          annotations: [{ type: 'speech_metadata', style: estiloDe(f.tom, voz, jeito) }],
        })),
      },
    ],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
    generation_config: { speech_config: [{ voice: voz }] },
  };
}

// ---------------------------------------------------------------- várias falas num pedido

/** Pausa colocada entre as falas de um lote; o corte procura esses silêncios. */
export const SEPARADOR = '\n<long pause> <long pause>\n';
/** Silêncio mínimo (s) para valer como separação entre falas. */
const SILENCIO_MINIMO = 0.25;
/**
 * Quantas vezes a menor pausa usada como corte precisa ser maior que a maior pausa que ficou
 * dentro de uma fala. Abaixo disso o lote é recusado e dividido ao meio (mais pedidos, nunca
 * áudio trocado).
 */
export const FOLGA_DO_CORTE = 1.3;

/**
 * Divide um áudio com `n` falas separadas por pausas longas: acha os n−1 maiores trechos
 * de silêncio e corta no meio deles; tira o silêncio das pontas de cada pedaço.
 * Devolve null se não houver silêncios suficientes (aí o chamador pede fala por fala).
 */
export function dividirPorSilencio(amostras: Float32Array, n: number, taxa = 48000): Float32Array[] | null {
  if (n === 1) return [aparar(amostras, taxa)];
  const quadro = Math.floor(taxa * 0.02);
  const nq = Math.floor(amostras.length / quadro);
  const energia = new Float32Array(nq);
  let pico = 0;
  for (let q = 0; q < nq; q++) {
    let s = 0;
    for (let i = q * quadro; i < (q + 1) * quadro; i++) s += amostras[i]! * amostras[i]!;
    energia[q] = Math.sqrt(s / quadro);
    pico = Math.max(pico, energia[q]!);
  }
  const limiar = pico * 0.03; // ~ -30 dB do pico
  // Trechos silenciosos internos (sem contar as pontas do áudio).
  const silencios: { de: number; ate: number }[] = [];
  let inicio = -1;
  for (let q = 0; q <= nq; q++) {
    const quieto = q < nq && energia[q]! < limiar;
    if (quieto && inicio < 0) inicio = q;
    if (!quieto && inicio >= 0) {
      if (inicio > 0 && q < nq) silencios.push({ de: inicio, ate: q });
      inicio = -1;
    }
  }
  const longos = silencios.filter((s) => ((s.ate - s.de) * quadro) / taxa >= SILENCIO_MINIMO);
  if (longos.length < n - 1) return null;
  const porTamanho = [...silencios].sort((a, b) => b.ate - b.de - (a.ate - a.de));
  // As pausas entre falas precisam ser bem mais longas que qualquer pausa dentro de uma fala.
  // Se a menor separação escolhida não se destaca da maior pausa que sobrou, o corte é ambíguo
  // e poderia dar a uma fala o áudio de outra (ex.: o "Fim de jogo!" num lance aos 77').
  const menorCorte = porTamanho[n - 2]!.ate - porTamanho[n - 2]!.de;
  const maiorResto = porTamanho[n - 1] ? porTamanho[n - 1]!.ate - porTamanho[n - 1]!.de : 0;
  if (maiorResto > 0 && menorCorte < maiorResto * FOLGA_DO_CORTE) return null;
  const cortes = porTamanho
    .slice(0, n - 1)
    .map((s) => Math.floor(((s.de + s.ate) / 2) * quadro))
    .sort((a, b) => a - b);
  const pedacos: Float32Array[] = [];
  let ini = 0;
  for (const c of [...cortes, amostras.length]) {
    pedacos.push(aparar(amostras.subarray(ini, c), taxa));
    ini = c;
  }
  return pedacos.every((p) => p.length > taxa * 0.2) ? pedacos : null;
}

/** Tira o silêncio do começo e do fim, deixando 50 ms de respiro. */
function aparar(a: Float32Array, taxa: number): Float32Array {
  let pico = 0;
  for (const x of a) pico = Math.max(pico, Math.abs(x));
  const limiar = pico * 0.02;
  let i = 0;
  let f = a.length - 1;
  while (i < f && Math.abs(a[i]!) < limiar) i++;
  while (f > i && Math.abs(a[f]!) < limiar) f--;
  const folga = Math.floor(taxa * 0.05);
  return a.slice(Math.max(0, i - folga), Math.min(a.length, f + folga));
}

/**
 * Sintetiza várias falas num pedido só (cada uma com o estilo do seu tom) e devolve uma
 * por fala (WAV 48 kHz). Confere se a duração de cada pedaço é coerente com o tamanho do
 * texto; se o corte não fechar, devolve null (e o áudio fica salvo em `diagnostico`).
 */
export async function falarVariasGemini(
  falas: { texto: string; tom: Tom }[],
  chave: string,
  voz: string,
  modelo: string,
  diagnostico?: (wav: Uint8Array, motivo: string) => Promise<void>,
  jeito?: string,
): Promise<Uint8Array[] | null> {
  const wav = await pedir(pedidoGeminiVarias(falas, voz, modelo, jeito), chave, `um lote de ${falas.length} falas`);
  if (falas.length === 1) {
    const { amostras } = lerWavMono(wav);
    const [unica] = dividirPorSilencio(amostras, 1)!;
    return [codificarWav(unica!, unica!)];
  }
  const { amostras } = lerWavMono(wav);
  const pedacos = dividirPorSilencio(amostras, falas.length);
  if (!pedacos) {
    await diagnostico?.(wav, 'pausas insuficientes');
    return null;
  }
  const textos = falas.map((f) => f.texto);
  // Coerência: segundos por caractere de cada pedaço não pode fugir muito da média.
  const razoes = pedacos.map((p, i) => p.length / 48000 / Math.max(4, textos[i]!.length));
  const media = razoes.reduce((acc, r) => acc + r, 0) / razoes.length;
  if (razoes.some((r) => r < media * 0.3 || r > media * 3)) {
    await diagnostico?.(wav, 'durações incoerentes');
    return null;
  }
  return pedacos.map((p) => codificarWav(p, p));
}

/** Compatibilidade: lote de um tom só. */
export function falarLoteGemini(textos: string[], tom: Tom, chave: string, voz: string, modelo: string): Promise<Uint8Array[] | null> {
  return falarVariasGemini(textos.map((texto) => ({ texto, tom })), chave, voz, modelo);
}
