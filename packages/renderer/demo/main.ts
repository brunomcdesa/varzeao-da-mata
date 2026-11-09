/**
 * Página de Replay de demonstração: sorteia Escalações, simula com a sim e reproduz
 * com o renderer, no mesmo modo "tempo de relógio" que o site usará para Ao Vivo e Replay.
 */
import { IDENTIDADE, TIMES, habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { criarRng, simularPartida, type Lado, type ResultadoPartida } from '@liga/sim';
import { DURACAO_JOGO, Timeline, VELOCIDADE_AO_VIVO, desenharQuadro } from '../src/index.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const APELIDOS = [
  'rafa', 'bia', 'duda', 'leo', 'malu', 'gui', 'nanda', 'pedrinho', 'lari', 'thiago',
  'carol', 'vini', 'ju', 'digo', 'mel', 'caio', 'babi', 'tuca', 'fefe', 'nico',
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('campo');
const ctx = canvas.getContext('2d')!;
const selMandante = $<HTMLSelectElement>('mandante');
const selVisitante = $<HTMLSelectElement>('visitante');
const forcaMandante = $<HTMLInputElement>('forca-mandante');
const forcaVisitante = $<HTMLInputElement>('forca-visitante');
const btnPlay = $<HTMLButtonElement>('play');
const btnNova = $<HTMLButtonElement>('nova');
const barra = $<HTMLInputElement>('barra');
const listaLances = $<HTMLOListElement>('lances');
const ficha = $<HTMLTableSectionElement>('ficha');
const resumo = $<HTMLParagraphElement>('resumo');
const rotuloSeed = $<HTMLSpanElement>('seed');

for (const sel of [selMandante, selVisitante]) {
  for (const id of TIMES) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = IDENTIDADE[id].nome;
    sel.append(opt);
  }
}
selMandante.value = 'CAP';
selVisitante.value = 'ONC';

let timeline: Timeline;
let nomes: Record<Lado, (string | null)[]>;
let t = 0;
let tocando = true;
let velocidade = VELOCIDADE_AO_VIVO;
let ultimo = performance.now();

function escalacao(time: TimeId, media: number, seed: number): { esc: Escalacao; nomes: string[] } {
  const rng = criarRng(seed);
  const usados = new Set<string>();
  const lista: string[] = [];
  const esc: Escalacao = {
    time,
    jogadores: ORDEM.map((posicao, i) => {
      let apelido = rng.pick(APELIDOS);
      while (usados.has(apelido)) apelido = rng.pick(APELIDOS);
      usados.add(apelido);
      lista.push(`@${apelido}_${IDENTIDADE[time].bicho}`);
      const ovr = Math.max(40, Math.min(99, media + rng.int(13) - 6));
      return { jogadorId: `${time}-${i}`, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) };
    }),
  };
  return { esc, nomes: lista };
}

function novaPartida(seed: number): void {
  const m = selMandante.value as TimeId;
  let v = selVisitante.value as TimeId;
  if (v === m) {
    v = TIMES.find((x) => x !== m)!;
    selVisitante.value = v;
  }
  const a = escalacao(m, Number(forcaMandante.value), seed * 7 + 1);
  const b = escalacao(v, Number(forcaVisitante.value), seed * 7 + 2);
  const resultado = simularPartida({ mandante: a.esc, visitante: b.esc, seed, fase: 'LIGA' });
  timeline = new Timeline(resultado, { mandante: a.esc, visitante: b.esc });
  nomes = { mandante: a.nomes, visitante: b.nomes };
  t = 0;
  rotuloSeed.textContent = String(seed);
  barra.max = String(DURACAO_JOGO);
  preencherLances(resultado);
  preencherFicha(resultado);
  atualizarResumo();
  definirTocando(true);
}

function textoDoLance(r: ResultadoPartida, i: number): string {
  const l = r.lances[i]!;
  const n = (s: { lado: Lado; indice: number } | undefined) => (s ? (nomes[s.lado][s.indice] ?? 'Base') : '');
  switch (l.tipo) {
    case 'GOL':
      return `Gol de ${n(l.finalizador)}, passe de ${n(l.criador)}`;
    case 'DEFESA':
      return `${n(l.defensor)} defende o chute de ${n(l.finalizador)}`;
    case 'FALTA':
      return `Falta de ${n(l.defensor)} em ${n(l.finalizador ?? l.criador)}${l.falta?.cartao === 'VERMELHO' ? ' (expulso)' : l.falta?.cartao === 'AMARELO' ? ' (amarelo)' : ''}`;
    case 'FORA':
      return `${n(l.finalizador)} chuta para fora`;
    case 'BLOQUEIO':
      return `${n(l.defensor)} bloqueia o chute de ${n(l.finalizador)}`;
    case 'DESARME':
      return `${n(l.defensor)} desarma ${n(l.drible ? l.finalizador : l.criador)}`;
  }
}

const ROTULO: Record<string, string> = { GOL: 'Gol', DEFESA: 'Defesa', BLOQUEIO: 'Bloqueio', FORA: 'Fora', DESARME: 'Desarme' };

function preencherLances(r: ResultadoPartida): void {
  listaLances.replaceChildren(
    ...r.lances.map((l, i) => {
      const li = document.createElement('li');
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = `lance tipo-${l.tipo.toLowerCase()}`;
      botao.dataset.indice = String(i);
      const sigla = IDENTIDADE[r.times[l.ataque]].sigla;
      botao.innerHTML = `<span class="min">${l.minuto}'</span><span class="chip">${ROTULO[l.tipo]}</span><span class="txt"></span><span class="sig">${sigla}</span>`;
      botao.querySelector('.txt')!.textContent = textoDoLance(r, i);
      botao.addEventListener('click', () => {
        t = Math.max(0, timeline.janelas[i]!.inicio);
        definirTocando(true);
      });
      li.append(botao);
      return li;
    }),
  );
}

function preencherFicha(r: ResultadoPartida): void {
  ficha.replaceChildren(
    ...r.desempenhos.map((d) => {
      const tr = document.createElement('tr');
      const nome = nomes[d.slot.lado][d.slot.indice] ?? 'Base';
      const delta = d.deltaOvr > 0 ? `+${d.deltaOvr}` : String(d.deltaOvr);
      const classe = d.deltaOvr > 0 ? 'sobe' : d.deltaOvr < 0 ? 'cai' : 'igual';
      const acoes = [
        d.gols ? `${d.gols} gol${d.gols > 1 ? 's' : ''}` : '',
        d.assistencias ? `${d.assistencias} assist.` : '',
        d.desarmes ? `${d.desarmes} desarme${d.desarmes > 1 ? 's' : ''}` : '',
        d.defesas ? `${d.defesas} defesa${d.defesas > 1 ? 's' : ''}` : '',
      ].filter(Boolean).join(' · ') || '—';
      tr.innerHTML = `<td class="sig"></td><td class="nome"></td><td>${d.posicao}</td><td class="acoes"></td><td class="num">${d.nota.toFixed(1)}</td><td class="num">${d.ovrAntes} → ${d.ovrDepois}</td><td class="num ${classe}">${delta}</td>`;
      tr.querySelector('.sig')!.textContent = IDENTIDADE[r.times[d.slot.lado]].sigla;
      tr.querySelector('.nome')!.textContent = nome;
      tr.querySelector('.acoes')!.textContent = acoes;
      return tr;
    }),
  );
}

function atualizarResumo(): void {
  const r = timeline.resultado;
  const m = IDENTIDADE[r.times.mandante];
  const v = IDENTIDADE[r.times.visitante];
  const media = (lado: Lado) =>
    Math.round(timeline.escalacoes[lado].jogadores.reduce((s, j) => s + j.ovr, 0) / 7);
  resumo.textContent = `${m.nome} (OVR médio ${media('mandante')}) × ${v.nome} (OVR médio ${media('visitante')})${r.classico ? ' · Clássico' : ''}`;
}

function definirTocando(sim: boolean): void {
  tocando = sim;
  btnPlay.textContent = tocando ? 'Pausar' : 'Continuar';
  btnPlay.setAttribute('aria-pressed', String(tocando));
  ultimo = performance.now();
}

function quadro(agora: number): void {
  const dt = (agora - ultimo) / 1000;
  ultimo = agora;
  if (tocando) {
    t = Math.min(DURACAO_JOGO, t + dt * velocidade);
    if (t >= DURACAO_JOGO) definirTocando(false);
  }
  const estado = timeline.estado(t);
  desenharQuadro(ctx, estado, {
    times: timeline.resultado.times,
    nomes,
  });
  barra.value = String(Math.round(t));
  for (const el of listaLances.querySelectorAll<HTMLButtonElement>('.lance')) {
    const i = Number(el.dataset.indice);
    el.classList.toggle('atual', i === estado.lanceAtual);
    el.classList.toggle('futuro', t < timeline.instanteDoLance(i));
  }
  requestAnimationFrame(quadro);
}

btnPlay.addEventListener('click', () => {
  if (!tocando && t >= DURACAO_JOGO) t = 0;
  definirTocando(!tocando);
});
btnNova.addEventListener('click', () => novaPartida(1 + Math.floor(Math.random() * 1_000_000)));
barra.addEventListener('input', () => {
  t = Number(barra.value);
});
for (const el of document.querySelectorAll<HTMLButtonElement>('[data-velocidade]')) {
  el.addEventListener('click', () => {
    velocidade = Number(el.dataset.velocidade);
    for (const outro of document.querySelectorAll<HTMLButtonElement>('[data-velocidade]')) {
      outro.setAttribute('aria-pressed', String(outro === el));
    }
  });
}
for (const el of [selMandante, selVisitante, forcaMandante, forcaVisitante]) {
  el.addEventListener('change', () => novaPartida(Number(rotuloSeed.textContent) || 2026));
}
for (const [input, saida] of [[forcaMandante, 'valor-mandante'], [forcaVisitante, 'valor-visitante']] as const) {
  input.addEventListener('input', () => {
    $(saida).textContent = input.value;
  });
}

document.fonts.ready.finally(() => {
  novaPartida(2026);
  requestAnimationFrame(quadro);
});
