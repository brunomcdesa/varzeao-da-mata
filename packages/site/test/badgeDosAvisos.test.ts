import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/*
 * ADR-0102: o badge dos Avisos é a silhueta branca do símbolo (folhas + bola) em fundo
 * transparente. O Android só usa o canal alfa do badge, então um ícone opaco vira um
 * círculo branco cheio.
 */
const PUBLICO = resolve(__dirname, '../public');
const sw = readFileSync(resolve(PUBLICO, 'sw.js'), 'utf8');

const campo = (nome: string): string => {
  const achado = sw.match(new RegExp(`${nome}:\\s*'([^']+)'`));
  if (!achado?.[1]) throw new Error(`sw.js sem ${nome}`);
  return achado[1];
};

/** Lê um PNG RGBA de 8 bits sem entrelaçamento e devolve os pixels. */
const lerPng = (arquivo: string) => {
  const dados = readFileSync(arquivo);
  let pos = 8;
  let largura = 0;
  let altura = 0;
  let tipoDeCor = -1;
  const idat: Buffer[] = [];
  while (pos < dados.length) {
    const tamanho = dados.readUInt32BE(pos);
    const tipo = dados.toString('ascii', pos + 4, pos + 8);
    const corpo = dados.subarray(pos + 8, pos + 8 + tamanho);
    if (tipo === 'IHDR') {
      largura = corpo.readUInt32BE(0);
      altura = corpo.readUInt32BE(4);
      tipoDeCor = corpo[9]!;
    }
    if (tipo === 'IDAT') idat.push(corpo);
    pos += 12 + tamanho;
  }
  const cru = inflateSync(Buffer.concat(idat));
  const linha = largura * 4;
  const px = Buffer.alloc(linha * altura);
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (linha + 1)]!;
    for (let x = 0; x < linha; x++) {
      const v = cru[y * (linha + 1) + 1 + x]!;
      const a = x >= 4 ? px[y * linha + x - 4]! : 0;
      const b = y > 0 ? px[(y - 1) * linha + x]! : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * linha + x - 4]! : 0;
      let previsto = 0;
      if (filtro === 1) previsto = a;
      else if (filtro === 2) previsto = b;
      else if (filtro === 3) previsto = (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        previsto = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * linha + x] = (v + previsto) & 0xff;
    }
  }
  return { largura, altura, tipoDeCor, px };
};

describe('badge dos Avisos', () => {
  it('não usa o ícone colorido do App como badge', () => {
    expect(campo('badge')).not.toBe(campo('icon'));
    expect(campo('icon')).toBe('icones/icone-192.png');
  });

  it('é um PNG 96×96 branco com fundo transparente', () => {
    const { largura, altura, tipoDeCor, px } = lerPng(resolve(PUBLICO, campo('badge')));
    expect([largura, altura]).toEqual([96, 96]);
    expect(tipoDeCor).toBe(6);
    let transparentes = 0;
    let opacos = 0;
    for (let i = 0; i < px.length; i += 4) {
      const alfa = px[i + 3]!;
      if (alfa === 0) transparentes++;
      if (alfa > 0) {
        opacos++;
        expect([px[i], px[i + 1], px[i + 2]]).toEqual([255, 255, 255]);
      }
    }
    const total = largura * altura;
    // Os cantos e os recortes da bola ficam vazados; o desenho ocupa só parte do quadro.
    expect(px[3]).toBe(0);
    expect(transparentes / total).toBeGreaterThan(0.3);
    expect(opacos / total).toBeGreaterThan(0.2);
  });
});
