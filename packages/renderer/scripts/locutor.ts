/**
 * Voz do Locutor da Liga. Ordem de escolha (ou force com LOCUTOR=gemini|azure|espeak|mudo):
 *   1. Gemini TTS, se houver GEMINI_API_KEY (padrão; voz Lumi; veja scripts/gemini.ts)
 *   2. Azure Speech, se houver AZURE_SPEECH_KEY e AZURE_SPEECH_REGION
 *   3. espeak-ng (voz de teste), se instalado
 *   4. mudo
 *
 * Variáveis do Azure:
 *   AZURE_SPEECH_KEY     chave do recurso Speech (sem ela, a narração sai muda; veja abaixo)
 *   AZURE_SPEECH_REGION  região do recurso, ex.: brazilsouth
 *   AZURE_SPEECH_VOICE   voz (padrão pt-BR-AntonioNeural; liste com `pnpm vozes`)
 *   AZURE_SPEECH_STYLE   estilo opcional (ex.: sports_commentary_excited), só se a voz suportar
 *
 * Cada frase sintetizada fica em cache (pasta .cache/locutor), então frases repetidas
 * entre Partidas não gastam a cota do plano gratuito.
 *
 * Sem chave, usa o espeak-ng se estiver instalado (voz robótica, só para conferir o tempo
 * das falas; `sudo apt install espeak-ng`). Sem nenhum dos dois, cada fala vira silêncio
 * com a duração estimada.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Tom } from '../src/narracao.js';
import { CotaDiariaEsgotada, MODELO_PADRAO, VOZ_PADRAO, falarGemini, falarVariasGemini } from './gemini.js';

export interface Locutor {
  /** WAV PCM 16 bits 48 kHz mono. */
  falar(texto: string, tom: Tom): Promise<Uint8Array>;
  /** Todas as falas de um vídeo, na ordem; pode juntar pedidos para economizar cota. */
  falarTodas(falas: { texto: string; tom: Tom }[], progresso?: (feitas: number) => void): Promise<Uint8Array[]>;
  readonly modo: 'gemini' | 'azure' | 'espeak' | 'mudo';
}

/** Uma fala de cada vez (serve para quem não tem pedido em lote). */
async function umaPorUma(l: Pick<Locutor, 'falar'>, falas: { texto: string; tom: Tom }[], progresso?: (n: number) => void): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  for (const f of falas) {
    out.push(await l.falar(f.texto, f.tom));
    progresso?.(out.length);
  }
  return out;
}

const PROSODIA: Record<Tom, { rate: string; pitch: string; grau: string }> = {
  normal: { rate: '+8%', pitch: '+0%', grau: '1' },
  animado: { rate: '+14%', pitch: '+6%', grau: '1.4' },
  grito: { rate: '+4%', pitch: '+14%', grau: '2' },
};

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function ssml(texto: string, tom: Tom, voz: string, estilo?: string): string {
  const p = PROSODIA[tom];
  const corpo = `<prosody rate="${p.rate}" pitch="${p.pitch}">${escapar(texto)}</prosody>`;
  const comEstilo = estilo ? `<mstts:express-as style="${estilo}" styledegree="${p.grau}">${corpo}</mstts:express-as>` : corpo;
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pt-BR">` +
    `<voice name="${voz}">${comEstilo}</voice></speak>`
  );
}

export function criarLocutor(pastaCache: string, modoForcado?: string): Locutor {
  const chave = process.env.AZURE_SPEECH_KEY;
  const regiao = process.env.AZURE_SPEECH_REGION;
  const voz = process.env.AZURE_SPEECH_VOICE ?? 'pt-BR-AntonioNeural';
  const estilo = process.env.AZURE_SPEECH_STYLE || undefined;

  const temEspeak = spawnSync('espeak-ng', ['--version']).status === 0;
  const chaveGemini = process.env.GEMINI_API_KEY;
  const modo = modoForcado ?? process.env.LOCUTOR ?? (chaveGemini ? 'gemini' : chave && regiao ? 'azure' : temEspeak ? 'espeak' : 'mudo');
  if (modo === 'azure' && (!chave || !regiao)) throw new Error('LOCUTOR=azure precisa de AZURE_SPEECH_KEY e AZURE_SPEECH_REGION');
  if (modo === 'gemini' && !chaveGemini) throw new Error('LOCUTOR=gemini precisa de GEMINI_API_KEY');

  /** Cache em disco: a mesma fala com a mesma voz e estilo nunca é sintetizada duas vezes. */
  const arquivoCache = (chaveCache: string) => join(pastaCache, `${createHash('sha256').update(chaveCache).digest('hex').slice(0, 24)}.wav`);
  const lerCache = async (chaveCache: string): Promise<Uint8Array | null> => {
    try {
      return new Uint8Array(await readFile(arquivoCache(chaveCache)));
    } catch {
      return null;
    }
  };
  const gravarCache = async (chaveCache: string, wav: Uint8Array) => {
    await mkdir(pastaCache, { recursive: true });
    await writeFile(arquivoCache(chaveCache), wav);
  };
  const comCache = async (chaveCache: string, gerar: () => Promise<Uint8Array>): Promise<Uint8Array> => {
    const pronto = await lerCache(chaveCache);
    if (pronto) return pronto;
    const wav = await gerar();
    await gravarCache(chaveCache, wav);
    return wav;
  };

  if (modo === 'gemini') {
    const voz = process.env.GEMINI_TTS_VOZ || VOZ_PADRAO;
    const modelo = process.env.GEMINI_TTS_MODELO || MODELO_PADRAO;
    const chaveDe = (texto: string, tom: Tom) => `gemini|${modelo}|${voz}|${tom}|${texto}`;
    const falar = (texto: string, tom: Tom) => comCache(chaveDe(texto, tom), () => falarGemini(texto, tom, chaveGemini!, voz, modelo));
    const diagnostico = async (wav: Uint8Array, motivo: string) => {
      const pasta = join(pastaCache, 'falhas');
      await mkdir(pasta, { recursive: true });
      const arquivo = join(pasta, `${new Date().toISOString().replace(/[:.]/g, '-')}.wav`);
      await writeFile(arquivo, wav);
      console.log(`\n  … corte do lote falhou (${motivo}); áudio salvo em ${arquivo}`);
    };
    /** Um pedido para o lote inteiro; se o corte falhar, divide ao meio (sem cair para fala por fala). */
    const sintetizarLote = async (lote: { texto: string; tom: Tom }[]): Promise<Uint8Array[]> => {
      const r = await falarVariasGemini(lote, chaveGemini!, voz, modelo, diagnostico);
      if (r) return r;
      if (lote.length === 1) throw new Error(`não consegui recortar a fala "${lote[0]!.texto}"`);
      const meio = Math.ceil(lote.length / 2);
      return [...(await sintetizarLote(lote.slice(0, meio))), ...(await sintetizarLote(lote.slice(meio)))];
    };
    return {
      modo: 'gemini',
      falar,
      async falarTodas(falas, progresso) {
        const out: (Uint8Array | null)[] = await Promise.all(falas.map((f) => lerCache(chaveDe(f.texto, f.tom))));
        const faltam = out.flatMap((w, i) => (w ? [] : [i]));
        progresso?.(falas.length - faltam.length);
        if (!faltam.length) return out as Uint8Array[];
        try {
          // Todas as falas que faltam num pedido só (cada uma com o estilo do seu tom).
          const wavs = await sintetizarLote(faltam.map((i) => falas[i]!));
          for (const [k, i] of faltam.entries()) {
            out[i] = wavs[k]!;
            await gravarCache(chaveDe(falas[i]!.texto, falas[i]!.tom), wavs[k]!);
          }
          progresso?.(falas.length);
          return out as Uint8Array[];
        } catch (e) {
          if (!(e instanceof CotaDiariaEsgotada)) throw e;
          // Sem cota hoje: o vídeo inteiro sai com a voz reserva (não mistura vozes no mesmo vídeo).
          const reserva = criarLocutor(pastaCache, process.env.LOCUTOR_RESERVA ?? (chave && regiao ? 'azure' : temEspeak ? 'espeak' : 'mudo'));
          console.warn(`\n  ⚠ ${e.message}. Este vídeo vai com a voz reserva (${reserva.modo}).`);
          return reserva.falarTodas(falas, progresso);
        }
      },
    };
  }

  if (modo === 'espeak') {
    const espeak: Locutor = {
      modo: 'espeak',
      falarTodas: (falas, progresso) => umaPorUma(espeak, falas, progresso),
      async falar(texto, tom) {
        const dir = await mkdtemp(join(tmpdir(), 'espeak-'));
        try {
          const bruto = join(dir, 'a.wav');
          const final = join(dir, 'b.wav');
          const velocidade = tom === 'grito' ? '185' : tom === 'animado' ? '180' : '170';
          const tom_ = tom === 'grito' ? '75' : tom === 'animado' ? '60' : '45';
          spawnSync('espeak-ng', ['-v', 'pt-br', '-s', velocidade, '-p', tom_, '-w', bruto, texto]);
          spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', bruto, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', final]);
          return new Uint8Array(await readFile(final));
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      },
    };
    return espeak;
  }

  if (modo === 'mudo') {
    const mudo: Locutor = {
      modo: 'mudo',
      falarTodas: (falas, progresso) => umaPorUma(mudo, falas, progresso),
      async falar(texto) {
        // ~14 caracteres por segundo, como uma locução animada.
        return silencio(Math.max(0.6, texto.length / 14));
      },
    };
    return mudo;
  }

  const azure: Locutor = {
    modo: 'azure',
    falarTodas: (falas, progresso) => umaPorUma(azure, falas, progresso),
    async falar(texto, tom) {
      const corpo = ssml(texto, tom, voz, estilo);
      const arquivo = join(pastaCache, `${createHash('sha256').update(corpo).digest('hex').slice(0, 24)}.wav`);
      try {
        return new Uint8Array(await readFile(arquivo));
      } catch {
        /* não está no cache */
      }
      let ultimoErro = '';
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        const resp = await fetch(`https://${regiao!}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': chave!,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'riff-48khz-16bit-mono-pcm',
            'User-Agent': 'varzeao-da-mata',
          },
          body: corpo,
        });
        if (resp.ok) {
          const wav = new Uint8Array(await resp.arrayBuffer());
          await mkdir(pastaCache, { recursive: true });
          await writeFile(arquivo, wav);
          return wav;
        }
        ultimoErro = `${resp.status} ${await resp.text()}`;
        if (resp.status !== 429 && resp.status < 500) break;
        await new Promise((ok) => setTimeout(ok, 1000 * tentativa));
      }
      throw new Error(`Azure Speech recusou a fala "${texto}": ${ultimoErro}`);
    },
  };
  return azure;
}

function silencio(segundos: number): Uint8Array {
  const n = Math.floor(segundos * 48000);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  txt(8, 'WAVE');
  txt(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 48000, true);
  v.setUint32(28, 96000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  txt(36, 'data');
  v.setUint32(40, n * 2, true);
  return new Uint8Array(buf);
}
