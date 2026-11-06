/**
 * Voz do Locutor da Liga via Azure Speech (REST, sem SDK).
 *
 * Variáveis de ambiente:
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
 * com a duração estimada. Para forçar um modo: LOCUTOR=azure|espeak|mudo.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Tom } from '../src/narracao.js';

export interface Locutor {
  /** WAV PCM 16 bits 48 kHz mono. */
  falar(texto: string, tom: Tom): Promise<Uint8Array>;
  readonly modo: 'azure' | 'espeak' | 'mudo';
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

export function criarLocutor(pastaCache: string): Locutor {
  const chave = process.env.AZURE_SPEECH_KEY;
  const regiao = process.env.AZURE_SPEECH_REGION;
  const voz = process.env.AZURE_SPEECH_VOICE ?? 'pt-BR-AntonioNeural';
  const estilo = process.env.AZURE_SPEECH_STYLE || undefined;

  const temEspeak = spawnSync('espeak-ng', ['--version']).status === 0;
  const modo = process.env.LOCUTOR ?? (chave && regiao ? 'azure' : temEspeak ? 'espeak' : 'mudo');
  if (modo === 'azure' && (!chave || !regiao)) throw new Error('LOCUTOR=azure precisa de AZURE_SPEECH_KEY e AZURE_SPEECH_REGION');

  if (modo === 'espeak') {
    return {
      modo: 'espeak',
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
  }

  if (modo === 'mudo') {
    return {
      modo: 'mudo',
      async falar(texto) {
        // ~14 caracteres por segundo, como uma locução animada.
        return silencio(Math.max(0.6, texto.length / 14));
      },
    };
  }

  return {
    modo: 'azure',
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
