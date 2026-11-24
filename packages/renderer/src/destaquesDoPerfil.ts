/**
 * Destaques do perfil do Instagram (ADR-0109): capas (1080 × 1080) e Stories estáticos
 * (1080 × 1920) no estilo dos Reels. A Liga posta os Stories e o dono põe cada um no seu
 * destaque pelo app (a API do Instagram não mexe em destaques).
 *
 * Os textos ficam em constantes para os testes conferirem contra as regras do código.
 */
import { CLASSICOS, FALA_DO_TIME, GRUPOS_DA_A_DE_16, IDENTIDADE, NOME_DO_GRUPO, nomeDoClassico, type Grupo, type Posicao, type TimeId } from '@liga/shared';
import { boneco, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo } from './desenho.js';
import { iconeInstagram } from './perfilDoTime.js';
import { COLUNAS, COR, Pincel } from './pixel.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export type Destaque = 'ENTRAR' | 'FUNCIONA' | 'SITE' | 'TIMES' | 'PERFIS' | 'CAMPEOES';

export type Story =
  | 'ENTRAR_COMO' | 'ENTRAR_POSICOES' | 'ENTRAR_TIMES' | 'ENTRAR_DEPOIS'
  | 'FUNCIONA_JOGADOR' | 'FUNCIONA_DIA' | 'FUNCIONA_AJUDE' | 'FUNCIONA_CAPITAO'
  | 'SITE_SITE' | 'SITE_APP' | 'SITE_AVISOS'
  | 'TIMES_BARRO' | 'TIMES_GALHO' | 'TIMES_CLASSICOS_BARRO' | 'TIMES_CLASSICOS_GALHO'
  | 'PERFIS_QUEM' | 'PERFIS_REGRAS' | 'PERFIS_GANHA'
  | 'CAMPEOES_T1';

/** Ordem no perfil, nome que aparece embaixo da bolinha e os Stories de cada um. */
export const DESTAQUES: readonly { id: Destaque; nome: string; stories: readonly Story[] }[] = [
  { id: 'ENTRAR', nome: 'Como entrar', stories: ['ENTRAR_COMO', 'ENTRAR_POSICOES', 'ENTRAR_TIMES', 'ENTRAR_DEPOIS'] },
  { id: 'FUNCIONA', nome: 'Como funciona', stories: ['FUNCIONA_JOGADOR', 'FUNCIONA_DIA', 'FUNCIONA_AJUDE', 'FUNCIONA_CAPITAO'] },
  { id: 'SITE', nome: 'Site e App', stories: ['SITE_SITE', 'SITE_APP', 'SITE_AVISOS'] },
  { id: 'TIMES', nome: 'Times', stories: ['TIMES_BARRO', 'TIMES_GALHO', 'TIMES_CLASSICOS_BARRO', 'TIMES_CLASSICOS_GALHO'] },
  { id: 'PERFIS', nome: 'Perfis dos Times', stories: ['PERFIS_QUEM', 'PERFIS_REGRAS', 'PERFIS_GANHA'] },
  { id: 'CAMPEOES', nome: 'Campeões', stories: ['CAMPEOES_T1'] },
];

/** "Perfis dos Times" → "perfis-dos-times". */
export function pastaDoDestaque(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const SITE = 'varzeaodamata.com.br';
export const EXEMPLO_DE_INSCRICAO = 'ENTRO CAPIVARA ATA';

/** Posições, com o jeito de escrever que o leitor de comentários entende (vocabulario.ts). */
export const POSICOES_NO_DESTAQUE: readonly { posicao: Posicao; nome: string; escreva: string[] }[] = [
  { posicao: 'GOL', nome: 'Goleiro', escreva: ['goleiro', 'gol', 'arqueiro'] },
  { posicao: 'ZAG', nome: 'Zagueiro', escreva: ['zagueiro', 'zaga', 'defesa'] },
  { posicao: 'MEI', nome: 'Meia', escreva: ['meia', 'meio campo', 'volante'] },
  { posicao: 'ATA', nome: 'Atacante', escreva: ['atacante', 'ataque', 'centroavante'] },
];

/** Perfis criados pelos Jogadores (ADR-0100), mostrados como exemplo. */
export const PERFIS_DE_EXEMPLO: readonly { time: TimeId; arroba: string }[] = [
  { time: 'JAC', arroba: '@jacareacc' },
  { time: 'TAM', arroba: '@tamanduaofc' },
  { time: 'CAP', arroba: '@esporte_clube_capivara' },
];

export interface CampeaoNoDestaque {
  temporada: number;
  time: TimeId;
  /** Craque da Temporada (apelido ou @), se houver. */
  craque?: string;
}

/** Campeões de cada Temporada, do mais antigo ao mais recente: um Story por Temporada. */
export const CAMPEOES: readonly CampeaoNoDestaque[] = [{ temporada: 1, time: 'ONC' }];

export interface OpcoesDestaque {
  escudo?: CanvasImageSource;
  campeao?: CampeaoNoDestaque;
}

const VERDE = '#9FE08A';
const DOURADO = '#F2B705';

/** Clássicos de um Grupo da T2, na ordem da lista oficial. */
export function classicosDoGrupo(g: Grupo): { a: TimeId; b: TimeId; nome: string }[] {
  const times = GRUPOS_DA_A_DE_16[g];
  return CLASSICOS.filter(([a, b]) => times.includes(a) && times.includes(b)).map(([a, b]) => ({ a, b, nome: nomeDoClassico(a, b)! }));
}

/** Quebra o texto em linhas que cabem em `largura` (pixels lógicos). */
function quebrar(pin: Pincel, txt: string, largura: number, tamanho: number, fonte: string, peso: number | string = 600): string[] {
  pin.ctx.font = `${peso} ${tamanho * pin.px}px ${fonte}`;
  const linhas: string[] = [];
  for (const paragrafo of txt.split('\n')) {
    let atual = '';
    for (const p of paragrafo.split(' ')) {
      const tenta = atual ? `${atual} ${p}` : p;
      if (pin.ctx.measureText(tenta).width / pin.px > largura && atual) {
        linhas.push(atual);
        atual = p;
      } else atual = tenta;
    }
    linhas.push(atual);
  }
  return linhas;
}

/** Parágrafo centralizado (ou à esquerda), devolve o y logo abaixo. */
function paragrafo(pin: Pincel, txt: string, x: number, y: number, largura: number, tamanho: number, cor: string, o: { alinhar?: CanvasTextAlign; peso?: number; fonte?: string; entre?: number } = {}): number {
  const fonte = o.fonte ?? FONTE_TEXTO;
  const linhas = quebrar(pin, txt, largura, tamanho, fonte, o.peso ?? 600);
  const passo = tamanho * (o.entre ?? 1.3);
  linhas.forEach((l, i) => pin.texto(l, x, y + i * passo, tamanho, fonte, cor, { peso: o.peso ?? 600, alinhar: o.alinhar ?? 'center' }));
  return y + linhas.length * passo;
}

function fundo(pin: Pincel): void {
  pin.ctx.imageSmoothingEnabled = false;
  pin.ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, 480 * pin.px);
  veu(pin, 0.88);
}

/** Topo comum: escudo da Liga, título e a página (1/4). Devolve o y livre. */
function topo(pin: Pincel, titulo: string, pagina: string, o: OpcoesDestaque): number {
  const cx = COLUNAS / 2;
  // O topo fica abaixo da barra do Story (nome e progresso) e tudo termina antes da linha 405,
  // onde o Instagram põe a caixa de resposta.
  if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, cx, 76, 28);
  pin.texto(titulo, cx, 106, pin.caber(titulo, 240, 30, FONTE_DISPLAY), FONTE_DISPLAY, DOURADO, { contorno: COR.mata });
  pin.texto(pagina, cx, 124, 9, FONTE_TEXTO, COR.placaSombra, { peso: 600 });
  return 136;
}

/** Tábua de madeira com texto claro no meio. */
function tabuaComTexto(pin: Pincel, txt: string, cx: number, y: number, w: number, h: number, tamanho: number, cor: string = COR.placa): void {
  pin.tabua(cx - w / 2, y, w, h);
  pin.texto(txt, cx, y + h / 2, pin.caber(txt, w - 14, tamanho, FONTE_DISPLAY), FONTE_DISPLAY, cor);
}

/** Placa clara (papel) com texto escuro. */
function papel(pin: Pincel, txt: string, cx: number, y: number, w: number, h: number, tamanho: number): void {
  pin.placa(cx - w / 2, y, w, h, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
  pin.texto(txt, cx, y + h / 2, pin.caber(txt, w - 12, tamanho, FONTE_DISPLAY), FONTE_DISPLAY, COR.tinta);
}

/** Item numerado: bolinha amarela com o número e o texto ao lado. Devolve o y de baixo. */
function item(pin: Pincel, marca: string, titulo: string, texto: string, y: number): number {
  pin.placa(18, y - 1, 20, 18, { fundo: DOURADO, sombra: '#C99500' });
  pin.texto(marca, 28, y + 8, pin.caber(marca, 16, 13, FONTE_DISPLAY), FONTE_DISPLAY, COR.tinta);
  let fim = y;
  if (titulo) {
    pin.texto(titulo, 46, y + 7, 15, FONTE_DISPLAY, '#FFFFFF', { alinhar: 'left' });
    fim = y + 20;
  }
  return paragrafo(pin, texto, 46, fim + (titulo ? 3 : 7), 206, 10, COR.placa, { alinhar: 'left' }) + 6;
}

function nomeCurto(t: TimeId): string {
  return FALA_DO_TIME[t].curto;
}

// ---------------------------------------------------------------- capas

/** Capa do destaque (canvas quadrado). O Instagram recorta um círculo no meio. */
export function desenharCapaDoDestaque(ctx: CanvasRenderingContext2D, id: Destaque, o: OpcoesDestaque = {}): void {
  const pin = new Pincel(ctx);
  const L = COLUNAS;
  const c = L / 2;
  ctx.imageSmoothingEnabled = false;
  pin.r(0, 0, L, L, COR.mata);
  // Anel dourado com miolo verde, como o escudo da Liga.
  ctx.save();
  ctx.fillStyle = DOURADO;
  ctx.beginPath();
  ctx.arc(c * pin.px, c * pin.px, 118 * pin.px, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COR.mata;
  ctx.beginPath();
  ctx.arc(c * pin.px, c * pin.px, 112 * pin.px, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COR.mataClara;
  ctx.beginPath();
  ctx.arc(c * pin.px, c * pin.px, 104 * pin.px, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  switch (id) {
    case 'ENTRAR': {
      // Balão de comentário com ENTRO.
      pin.placa(c - 78, c - 46, 156, 80, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
      pin.r(c - 44, c + 34, 18, 6, COR.placa);
      pin.r(c - 44, c + 40, 12, 6, COR.placa);
      pin.r(c - 44, c + 46, 6, 6, COR.placa);
      pin.texto('ENTRO', c, c - 6, 50, FONTE_DISPLAY, COR.tinta);
      break;
    }
    case 'FUNCIONA': {
      boneco(pin, 'FRENTE_COMEMORA', uniforme('ONC', 'ATA', 'destaque'), c - 42, c - 66, 7);
      pin.placa(c + 22, c + 18, 58, 34, { fundo: DOURADO, sombra: '#C99500' });
      pin.texto('OVR', c + 51, c + 28, 11, FONTE_DISPLAY, COR.tinta);
      pin.texto('65', c + 51, c + 42, 18, FONTE_DISPLAY, COR.tinta);
      break;
    }
    case 'SITE': {
      pin.placa(c - 42, c - 76, 84, 152, { fundo: '#1E1E1E', luz: '#3A3A3A', sombra: '#000000' });
      pin.r(c - 36, c - 64, 72, 128, COR.mata);
      pin.r(c - 10, c - 71, 20, 3, '#3A3A3A');
      if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, c, c - 14, 50);
      pin.placa(c - 28, c + 26, 56, 14, { fundo: DOURADO, sombra: '#C99500', degrau: 1 });
      pin.texto('Ao Vivo', c, c + 33, 11, FONTE_DISPLAY, COR.tinta);
      break;
    }
    case 'TIMES': {
      const ts: TimeId[] = ['CAP', 'ONC', 'ARA', 'TUC'];
      ts.forEach((t, i) => desenharEscudo(pin, t, c - 66 + (i % 2) * 72, c - 76 + Math.floor(i / 2) * 80, 3, { estrelas: false }));
      break;
    }
    case 'PERFIS': {
      iconeInstagram(pin, c - 54, c - 54, 108, DOURADO);
      break;
    }
    case 'CAMPEOES': {
      trofeu(pin, c, c - 6, 1);
      break;
    }
  }
}

/** Taça em pixel art, centrada em (cx, cy), com `e` de escala. */
function trofeu(pin: Pincel, cx: number, cy: number, e: number): void {
  const d = DOURADO;
  const s = '#C99500';
  const l = '#FFE07A';
  const r = (x: number, y: number, w: number, h: number, cor: string) => pin.r(cx + x * e, cy + y * e, w * e, h * e, cor);
  r(-40, -62, 80, 8, s); // borda
  r(-38, -60, 76, 50, d); // copo
  r(-32, -10, 64, 10, d);
  r(-24, 0, 48, 10, d);
  r(-14, 10, 28, 10, s);
  r(-8, 20, 16, 16, d); // haste
  r(-28, 36, 56, 10, d); // base
  r(-34, 46, 68, 14, COR.madeira);
  r(-34, 46, 68, 3, COR.madeiraLuz);
  r(-58, -54, 20, 8, d); // asas
  r(-58, -46, 8, 22, d);
  r(-58, -24, 22, 8, d);
  r(38, -54, 20, 8, d);
  r(50, -46, 8, 22, d);
  r(36, -24, 22, 8, d);
  r(-28, -54, 8, 36, l); // brilho
  r(-20, -54, 4, 20, l);
}

// ---------------------------------------------------------------- stories

export function desenharStory(ctx: CanvasRenderingContext2D, story: Story, o: OpcoesDestaque = {}): void {
  const pin = new Pincel(ctx);
  fundo(pin);
  const cx = COLUNAS / 2;
  const destaque = DESTAQUES.find((d) => d.stories.includes(story))!;
  const pagina = `${destaque.nome} · ${destaque.stories.indexOf(story) + 1}/${destaque.stories.length}`;

  switch (story) {
    case 'ENTRAR_COMO': {
      let y = topo(pin, 'Como entrar', pagina, o);
      y = paragrafo(pin, 'Comente em qualquer Reels da Liga:', cx, y + 8, 230, 12, COR.placa);
      tabuaComTexto(pin, 'ENTRO + TIME + POSIÇÃO', cx, y + 4, 240, 40, 26);
      y += 60;
      pin.texto('Exemplo', cx, y + 4, 11, FONTE_TEXTO, VERDE, { peso: 700 });
      papel(pin, EXEMPLO_DE_INSCRICAO, cx, y + 14, 200, 30, 22);
      boneco(pin, 'FRENTE_COMEMORA', uniforme('CAP', 'ATA', 'exemplo'), cx - 24, y + 54, 4);
      paragrafo(pin, 'Pronto: você vira Jogador da Capivara, no ataque.\nSó você pode se inscrever. Marcar amigo não inscreve.', cx, y + 132, 230, 10, COR.placa);
      break;
    }
    case 'ENTRAR_POSICOES': {
      let y = topo(pin, 'As Posições', pagina, o) + 6;
      for (const [i, p] of POSICOES_NO_DESTAQUE.entries()) {
        const time: TimeId = (['TUC', 'TAT', 'ARA', 'ONC'] as const)[i]!;
        pin.placa(14, y, 242, 52, { fundo: COR.mataMedia, sombra: COR.mata });
        boneco(pin, 'FRENTE_PARADO', uniforme(time, p.posicao, `pos${i}`), 22, y + 4, 2.75);
        pin.placa(60, y + 8, 40, 18, { fundo: DOURADO, sombra: '#C99500', degrau: 1 });
        pin.texto(p.posicao, 80, y + 17, 15, FONTE_DISPLAY, COR.tinta);
        pin.texto(p.nome, 108, y + 17, 17, FONTE_DISPLAY, '#FFFFFF', { alinhar: 'left' });
        pin.texto(`vale: ${p.escreva.join(', ')}`, 60, y + 38, pin.caber(`vale: ${p.escreva.join(', ')}`, 188, 10, FONTE_TEXTO, 600), FONTE_TEXTO, COR.placa, { alinhar: 'left', peso: 600 });
        y += 58;
      }
      paragrafo(pin, 'Escreva do seu jeito: o Varzeão entende.', cx, y + 6, 230, 10, VERDE);
      break;
    }
    case 'ENTRAR_TIMES': {
      let y = topo(pin, 'Escolha o Time', pagina, o);
      for (const g of ['CHAO', 'COPA'] as const) {
        pin.texto(NOME_DO_GRUPO[g], cx, y + 6, 13, FONTE_DISPLAY, VERDE);
        y += 14;
        GRUPOS_DA_A_DE_16[g].forEach((t, i) => {
          const x = 24 + (i % 4) * 60;
          const yy = y + Math.floor(i / 4) * 50;
          desenharEscudo(pin, t, x + 8, yy, 1.6, { estrelas: false });
          pin.texto(nomeCurto(t).toUpperCase(), x + 24, yy + 45, pin.caber(nomeCurto(t).toUpperCase(), 56, 10, FONTE_DISPLAY), FONTE_DISPLAY, '#FFFFFF');
        });
        y += 104;
      }
      paragrafo(pin, 'Use o nome do bicho no comentário: ENTRO ONÇA, ENTRO LOBO-GUARÁ…', cx, y + 2, 236, 9.5, COR.placa);
      break;
    }
    case 'ENTRAR_DEPOIS': {
      let y = topo(pin, 'E depois?', pagina, o) + 8;
      y = item(pin, '1', 'Você vira Jogador', 'Com OVR sorteado entre 60 e 65 e um boneco com o uniforme do seu Time.', y);
      y = item(pin, '2', 'Entra no Elenco', 'E no rodízio da Escalação. A Escalação sai no Corte, 30 min antes de cada jogo.', y + 4);
      y = item(pin, '3', 'Joga e evolui', 'O que você faz em campo mexe nas suas Habilidades.', y + 4);
      y = item(pin, '4', 'Prefere pela DM?', 'Mande na DM da Liga o seu Time e a sua Posição.', y + 4);
      break;
    }
    case 'FUNCIONA_JOGADOR': {
      let y = topo(pin, 'Seu Jogador', pagina, o) + 6;
      boneco(pin, 'FRENTE_PARADO', uniforme('LOB', 'ATA', 'jogador'), 26, y + 4, 4.5);
      pin.placa(96, y + 8, 70, 50, { fundo: DOURADO, sombra: '#C99500' });
      pin.texto('OVR', 131, y + 22, 13, FONTE_DISPLAY, COR.tinta);
      pin.texto('65', 131, y + 42, 26, FONTE_DISPLAY, COR.tinta);
      paragrafo(pin, 'A força do Jogador, feita das 5 Habilidades.', 176, y + 18, 86, 9.5, COR.placa, { alinhar: 'left' });
      y += 86;
      const habs: [string, number][] = [['Finalização', 72], ['Passe', 63], ['Drible', 66], ['Defesa', 41], ['Goleiro', 20]];
      habs.forEach(([h, v], i) => {
        const yy = y + i * 18;
        pin.texto(h, 22, yy + 6, 11, FONTE_TEXTO, '#FFFFFF', { alinhar: 'left', peso: 700 });
        pin.r(104, yy, 120, 11, COR.mata);
        pin.r(104, yy, Math.round((120 * v) / 99), 11, v >= 60 ? '#3DDC64' : v >= 40 ? DOURADO : '#FF6B5B');
        pin.texto(String(v), 246, yy + 6, 11, FONTE_DISPLAY, '#FFFFFF');
      });
      y += 100;
      paragrafo(pin, 'Elas mudam com o que você faz em campo: um gol sobe Finalização, ser driblado desce Defesa. Quem não joga não perde nada.', cx, y, 234, 10, COR.placa);
      break;
    }
    case 'FUNCIONA_DIA': {
      let y = topo(pin, 'Dia de jogo', pagina, o) + 4;
      papel(pin, '8 jogos por dia · das 11h às 18h', cx, y, 236, 26, 18);
      y += 42;
      y = item(pin, '1', 'Corte', '30 min antes do jogo, sai a Escalação dos dois Times.', y);
      y = item(pin, '2', 'Apito Inicial', `O jogo completo passa Ao Vivo no site e no App.`, y + 4);
      y = item(pin, '3', 'Reels', 'Depois, os melhores momentos aqui no perfil.', y + 4);
      y = item(pin, '4', 'Resumo às 19h', 'Placares, Tabela e votação do Craque da Rodada.', y + 4);
      break;
    }
    case 'FUNCIONA_AJUDE': {
      let y = topo(pin, 'Ajude seu Time', pagina, o) + 6;
      const blocos: [string, string][] = [
        ['CONFIRMO', 'Comente até o Corte (ou confirme no site): você passa na frente no rodízio da Escalação.'],
        ['Resenha', 'Comente no Reels do último jogo do seu Time: no jogo seguinte, você evolui 50% mais rápido.'],
        ['CRAQUE 3', 'No Resumo, comente o número do seu Craque da Rodada. Também dá pra votar no site.'],
      ];
      for (const [t, txt] of blocos) {
        pin.placa(14, y, 242, 74, { fundo: COR.mataMedia, sombra: COR.mata });
        tabuaComTexto(pin, t, cx, y + 6, 150, 26, 18);
        paragrafo(pin, txt, cx, y + 44, 226, 9.5, COR.placa);
        y += 82;
      }
      break;
    }
    case 'FUNCIONA_CAPITAO': {
      let y = topo(pin, 'O Capitão', pagina, o) + 6;
      boneco(pin, 'FRENTE_PARADO', uniforme('ARA', 'MEI', 'capitao'), cx - 27, y, 4.5);
      pin.placa(cx + 12, y + 30, 24, 14, { fundo: DOURADO, sombra: '#C99500', degrau: 1 });
      pin.texto('C', cx + 24, y + 37, 12, FONTE_DISPLAY, COR.tinta);
      y += 82;
      y = paragrafo(pin, 'Quem tem mais jogos pelo Time usa a faixa. Pelo site, com Vínculo, ele escolhe antes de cada jogo:', cx, y, 230, 10.5, COR.placa) + 4;
      tabuaComTexto(pin, 'Postura', cx - 60, y, 104, 28, 18);
      tabuaComTexto(pin, 'Formação', cx + 60, y, 104, 28, 18);
      y += 40;
      ['2-2-2', '2-3-1', '3-2-1', '3-1-2'].forEach((f, i) => papel(pin, f, 40 + i * 63, y, 54, 22, 16));
      y += 36;
      paragrafo(pin, 'Sem Vínculo ou suspenso, a faixa passa para o próximo.', cx, y, 230, 10, VERDE);
      break;
    }
    case 'SITE_SITE': {
      let y = topo(pin, 'Site e App', pagina, o) + 4;
      pin.placa(cx - 46, y, 92, 150, { fundo: '#1E1E1E', luz: '#3A3A3A', sombra: '#000000' });
      pin.r(cx - 40, y + 12, 80, 128, COR.mata);
      if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, cx, y + 54, 44);
      pin.placa(cx - 30, y + 90, 60, 16, { fundo: DOURADO, sombra: '#C99500', degrau: 1 });
      pin.texto('Ao Vivo', cx, y + 98, 12, FONTE_DISPLAY, COR.tinta);
      y += 164;
      papel(pin, SITE, cx, y, 236, 28, 20);
      y += 44;
      for (const l of ['O jogo completo, Ao Vivo', 'Tabela, Times e Jogadores', 'A Carreira e os troféus do seu Jogador']) {
        pin.texto(`• ${l}`, cx, y, 11, FONTE_TEXTO, COR.placa, { peso: 700 });
        y += 16;
      }
      break;
    }
    case 'SITE_APP': {
      let y = topo(pin, 'Instale o App', pagina, o) + 6;
      paragrafo(pin, 'É o próprio site, com ícone na tela inicial. Sem loja e sem baixar nada.', cx, y, 230, 10.5, COR.placa);
      y += 36;
      const sistemas: [string, string][] = [
        ['Android', `Abra ${SITE} no Chrome e toque em Instalar app.`],
        ['iPhone', 'No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.'],
      ];
      for (const [s, txt] of sistemas) {
        pin.placa(14, y, 242, 66, { fundo: COR.mataMedia, sombra: COR.mata });
        tabuaComTexto(pin, s, cx, y + 6, 120, 24, 17);
        paragrafo(pin, txt, cx, y + 42, 226, 10, COR.placa);
        y += 74;
      }
      y += 4;
      pin.placa(14, y, 242, 46, { fundo: '#5C3920', sombra: COR.contorno });
      paragrafo(pin, 'Veio pelo Instagram? Abra no navegador do celular: dentro do Instagram não dá.', cx, y + 14, 226, 10, '#FFE07A');
      break;
    }
    case 'SITE_AVISOS': {
      let y = topo(pin, 'Avisos e Vínculo', pagina, o) + 6;
      tabuaComTexto(pin, 'Avisos', cx, y, 140, 28, 19);
      y = paragrafo(pin, 'No App, em Mais › Avisos, escolha seus Times e receba:', cx, y + 42, 230, 10.5, COR.placa);
      y = paragrafo(pin, 'Escalação · 5 min antes do Apito · Gols · Fim de jogo', cx, y + 2, 236, 10.5, VERDE, { peso: 700 }) + 8;
      tabuaComTexto(pin, 'Vínculo', cx, y, 140, 28, 19);
      y = paragrafo(pin, 'No site, ache o seu Jogador, pegue o código e mande na DM da Liga. O Jogador fica ligado ao seu celular.', cx, y + 42, 230, 10.5, COR.placa) + 4;
      paragrafo(pin, 'Com ele: Presença, visual do boneco, Transferência e, se for Capitão, Postura e Formação.', cx, y, 230, 10, VERDE);
      break;
    }
    case 'TIMES_BARRO':
    case 'TIMES_GALHO': {
      const g: Grupo = story === 'TIMES_BARRO' ? 'CHAO' : 'COPA';
      let y = topo(pin, NOME_DO_GRUPO[g], pagina, o) + 2;
      GRUPOS_DA_A_DE_16[g].forEach((t, i) => {
        const col = i % 2;
        const x = 16 + col * 122;
        const yy = y + Math.floor(i / 2) * 58;
        pin.placa(x, yy, 116, 52, { fundo: COR.mataMedia, sombra: COR.mata });
        desenharEscudo(pin, t, x + 4, yy + 4, 1.8, { estrelas: false });
        paragrafo(pin, IDENTIDADE[t].nome, x + 42, yy + 18, 70, 10.5, '#FFFFFF', { alinhar: 'left', fonte: FONTE_DISPLAY, peso: 400, entre: 1.05 });
      });
      y += 4 * 58 + 6;
      paragrafo(pin, 'Temporada 2: os 2 primeiros de cada Grupo vão às Semifinais.', cx, y, 230, 10, VERDE);
      break;
    }
    case 'TIMES_CLASSICOS_BARRO':
    case 'TIMES_CLASSICOS_GALHO': {
      const g: Grupo = story === 'TIMES_CLASSICOS_BARRO' ? 'CHAO' : 'COPA';
      let y = topo(pin, `Clássicos do ${NOME_DO_GRUPO[g].replace('Grupo do ', '')}`, pagina, o);
      for (const c of classicosDoGrupo(g)) {
        pin.placa(14, y, 242, 28, { fundo: COR.mataMedia, sombra: COR.mata });
        desenharEscudo(pin, c.a, 20, y + 3, 0.9, { estrelas: false });
        desenharEscudo(pin, c.b, 50, y + 3, 0.9, { estrelas: false });
        pin.texto('x', 45, y + 14, 9, FONTE_DISPLAY, COR.placa);
        pin.texto(c.nome, 78, y + 9, pin.caber(c.nome, 172, 13, FONTE_DISPLAY), FONTE_DISPLAY, DOURADO, { alinhar: 'left' });
        pin.texto(`${nomeCurto(c.a)} x ${nomeCurto(c.b)}`, 78, y + 20, 9, FONTE_TEXTO, COR.placa, { alinhar: 'left', peso: 600 });
        y += 31;
      }
      paragrafo(pin, 'No Clássico, as Habilidades podem mudar até o dobro.', cx, y + 6, 230, 10, VERDE);
      break;
    }
    case 'PERFIS_QUEM': {
      let y = topo(pin, 'Seu Time no Insta', pagina, o) + 4;
      y = paragrafo(pin, 'Os Jogadores já criaram perfis dos seus Times:', cx, y, 230, 11, COR.placa) + 6;
      for (const p of PERFIS_DE_EXEMPLO) {
        pin.placa(14, y, 242, 44, { fundo: COR.mataMedia, sombra: COR.mata });
        desenharEscudo(pin, p.time, 22, y + 5, 1.4, { estrelas: false });
        pin.texto(p.arroba, 58, y + 15, pin.caber(p.arroba, 190, 15, FONTE_DISPLAY), FONTE_DISPLAY, '#FFFFFF', { alinhar: 'left' });
        pin.texto(IDENTIDADE[p.time].nome, 58, y + 31, 9, FONTE_TEXTO, COR.placaSombra, { alinhar: 'left', peso: 600 });
        y += 50;
      }
      y += 6;
      iconeInstagram(pin, cx - 16, y, 32, DOURADO);
      paragrafo(pin, 'Seu Time ainda não tem? Crie o perfil e vire o perfil oficial dele.', cx, y + 48, 230, 11, VERDE);
      break;
    }
    case 'PERFIS_REGRAS': {
      let y = topo(pin, 'Pra ser oficial', pagina, o) + 8;
      const regras = [
        'Quem cria é Jogador do Time.',
        '@varzeao_da_mata na bio.',
        'Nome e bicho do Time (escudo próprio pode).',
        'Nada de se passar pela Liga.',
        'Respeito aos rivais.',
      ];
      for (const r of regras) {
        pin.placa(18, y, 18, 16, { fundo: '#3E9B3A', sombra: '#2A6E27', degrau: 1 });
        // Visto em pixels (a fonte não tem o caractere).
        for (const [dx, dy] of [[5, 8], [6, 9], [7, 10], [8, 9], [9, 8], [10, 7], [11, 6], [12, 5]] as const) pin.r(18 + dx, y + dy, 2, 2, '#FFFFFF');
        const fim = paragrafo(pin, r, 44, y + 8, 210, 11, '#FFFFFF', { alinhar: 'left' });
        y = Math.max(y + 26, fim + 8);
      }
      y += 8;
      tabuaComTexto(pin, 'Peça pela DM da Liga', cx, y, 220, 32, 20);
      paragrafo(pin, 'Fica um perfil por Time: o primeiro que pedir.', cx, y + 48, 230, 10, VERDE);
      break;
    }
    case 'PERFIS_GANHA': {
      let y = topo(pin, 'O que ganha', pagina, o) + 8;
      y = item(pin, '1', 'Link no site', 'Na página do Time.', y);
      y = item(pin, '2', 'Seguido pela Liga', 'O @varzeao_da_mata segue o perfil.', y + 4);
      y = item(pin, '3', 'Repost nos Stories', 'Os posts do Time aparecem aqui.', y + 4);
      item(pin, '4', 'Colaborador', 'Em todo Reels de jogo do Time, junto com a Liga.', y + 4);
      break;
    }
    case 'CAMPEOES_T1': {
      const c = o.campeao ?? CAMPEOES.find((x) => x.temporada === 1);
      let y = topo(pin, 'Campeões', pagina, o) + 6;
      if (!c) break;
      tabuaComTexto(pin, `Temporada ${c.temporada}`, cx, y, 170, 30, 20);
      y += 40;
      trofeu(pin, cx, y + 50, 0.8);
      y += 108;
      desenharEscudo(pin, c.time, cx - 25, y, 2.5);
      y += 76;
      pin.texto(IDENTIDADE[c.time].nome, cx, y, pin.caber(IDENTIDADE[c.time].nome, 236, 24, FONTE_DISPLAY), FONTE_DISPLAY, DOURADO, { contorno: COR.mata });
      if (c.craque) pin.texto(`Craque da Temporada: ${c.craque}`, cx, y + 22, pin.caber(`Craque da Temporada: ${c.craque}`, 236, 11, FONTE_TEXTO, 700), FONTE_TEXTO, COR.placa, { peso: 700 });
      break;
    }
  }
}
