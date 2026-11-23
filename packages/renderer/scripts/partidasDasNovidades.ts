/**
 * Partidas de exemplo dos Reels de Novidades da T2 (ADR-0063) e os trechos de jogo de cada
 * novidade. Tudo determinístico: as mesmas sementes dão sempre os mesmos trechos. Os nomes em
 * cima dos bonecos são apelidos inventados (nunca um @ de verdade).
 */
import { IDENTIDADE, VAGAS_DA_FORMACAO, habilidadesDoPerfil, type Escalacao, type Formacao, type PerfilDoJuiz, type Posicao, type Postura, type TimeId } from '@liga/shared';
import { criarRng, simularPartida, type Lado, type Lance } from '@liga/sim';
import { climaDaPartida } from '../src/clima.js';
import type { ClipeDeJogo, ClipeId, DadosDasNovidades, ReelsDeNovidades } from '../src/novidades.js';
import { Timeline } from '../src/timeline.js';
import type { PartidaParaVideo } from '../src/video.js';
import type { EventoSonoro } from '../src/narracao.js';

const APELIDOS = ['Rafa', 'Bia', 'Duda', 'Leo', 'Malu', 'Gui', 'Nanda', 'Pedrinho', 'Lari', 'Thiago', 'Carol', 'Vini', 'Ju', 'Digo', 'Mel', 'Caio', 'Babi', 'Tuca', 'Fefe', 'Nico', 'Zeca', 'Lulu'];

export interface OpcoesDaPartidaT2 {
  formacao?: Record<Lado, Formacao>;
  postura?: Record<Lado, Postura>;
  /** Partida com as regras da T3 (ADR-0094), com esse Perfil do Juiz. */
  t3?: PerfilDoJuiz;
}

/** Uma Partida da T2 com Banco (zagueiro, meia e atacante), apelidos e a Formação pedida. */
export function partidaT2(seed: number, mandante: TimeId, visitante: TimeId, o: OpcoesDaPartidaT2 = {}): PartidaParaVideo {
  const formacao = o.formacao ?? { mandante: '2-2-2', visitante: '2-2-2' };
  const montar = (time: TimeId, lado: Lado, s: number) => {
    const rng = criarRng(s);
    const vagas = VAGAS_DA_FORMACAO[formacao[lado]];
    const ordem: Posicao[] = (['GOL', 'ZAG', 'MEI', 'ATA'] as const).flatMap((p) => Array<Posicao>(vagas[p]).fill(p));
    const usados = new Set<string>();
    const nomes: string[] = [];
    const apelidos: string[] = [];
    const jogador = (posicao: Posicao, id: string) => {
      let a = rng.pick(APELIDOS);
      while (usados.has(a)) a = rng.pick(APELIDOS);
      usados.add(a);
      nomes.push(`${a.toLowerCase()}_${IDENTIDADE[time].bicho}`);
      apelidos.push(a);
      const ovr = 64 + rng.int(13);
      return { jogadorId: id, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) };
    };
    const jogadores = ordem.map((p, i) => jogador(p, `${time}-${i}`));
    const banco = (['ZAG', 'MEI', 'ATA'] as const).map((p, k) => jogador(p, `${time}-r${k}`));
    const esc: Escalacao = { time, jogadores, banco };
    return { esc, nomes, apelidos };
  };
  const a = montar(mandante, 'mandante', seed * 7 + 1);
  const b = montar(visitante, 'visitante', seed * 7 + 2);
  const resultado = simularPartida({
    mandante: a.esc,
    visitante: b.esc,
    seed,
    fase: 'LIGA',
    t2: { postura: o.postura ?? { mandante: 'OFENSIVA', visitante: 'EQUILIBRADA' }, formacao },
    ...(o.t3 ? { t3: { juiz: o.t3 } } : {}),
  });
  // Número da camisa de exemplo (ADR-0075), com sorteio próprio, que não mexe na Partida: um em
  // cada quatro fica de camisa lisa, como quem ainda não escolheu.
  const numeros = (nomes: string[], semente: number) => {
    const rng = criarRng(semente);
    const usados = new Set<number>();
    return nomes.map(() => {
      if (rng.int(4) === 0) return null;
      let n = 1 + rng.int(99);
      while (usados.has(n)) n = 1 + rng.int(99);
      usados.add(n);
      return n;
    });
  };
  return {
    resultado,
    escalacoes: { mandante: a.esc, visitante: b.esc },
    nomes: { mandante: a.nomes, visitante: b.nomes },
    apelidos: { mandante: a.apelidos, visitante: b.apelidos },
    numeros: { mandante: numeros(a.nomes, seed * 7 + 3), visitante: numeros(b.nomes, seed * 7 + 4) },
  };
}

interface Achado {
  partida: PartidaParaVideo;
  timeline: Timeline;
}

/** Procura, nas sementes de `de` em diante, a primeira Partida que tem o lance pedido. */
function procurar(
  montar: (seed: number) => PartidaParaVideo,
  teste: (l: Lance, p: PartidaParaVideo, tl: Timeline) => boolean,
  de = 1,
  ate = 400,
  semente: (seed: number) => boolean = () => true,
): { achado: Achado; indice: number } | null {
  for (let seed = de; seed <= ate; seed++) {
    if (!semente(seed)) continue;
    const partida = montar(seed);
    let timeline: Timeline | null = null;
    for (const [i, l] of partida.resultado.lances.entries()) {
      timeline ??= new Timeline(partida.resultado, partida.escalacoes);
      if (teste(l, partida, timeline)) return { achado: { partida, timeline }, indice: i };
    }
  }
  return null;
}

/** Trecho em volta da resolução do lance `i`. */
function trechoDoLance(tl: Timeline, i: number, antes: number, depois: number, sons: (r: number) => EventoSonoro[] = () => []): Omit<ClipeDeJogo, 'partida'> {
  const j = tl.janelas[i]!;
  const de = Math.max(j.inicio, j.resolucao - antes);
  return { de, chave: j.resolucao, ate: j.resolucao + depois, sons: sons(j.resolucao) };
}

/** Partidas e trechos de cada Reels. */
export function dadosDasNovidades(reels: ReelsDeNovidades, o: { estreia: string; publicadoEm: string }): DadosDasNovidades {
  const partidas: PartidaParaVideo[] = [];
  const clipes: Partial<Record<ClipeId, ClipeDeJogo>> = {};
  const guardar = (id: ClipeId, r: { achado: Achado; indice: number } | null, recorte: (tl: Timeline, i: number) => Omit<ClipeDeJogo, 'partida'>) => {
    if (!r) return;
    let k = partidas.findIndex((p) => p.resultado.seed === r.achado.partida.resultado.seed && p.resultado.times.mandante === r.achado.partida.resultado.times.mandante && p.resultado.times.visitante === r.achado.partida.resultado.times.visitante && p.resultado.formacao?.mandante === r.achado.partida.resultado.formacao?.mandante);
    if (k < 0) k = partidas.push(r.achado.partida) - 1;
    clipes[id] = { partida: k, ...recorte(r.achado.timeline, r.indice) };
  };
  // Onça × Jacaré no 2-2-2: a Partida "padrão" dos trechos de dentro de campo.
  const padrao = (seed: number) => partidaT2(seed, 'ONC', 'JAC');
  const gol = (r: number): EventoSonoro[] => [{ tipo: 'GOL', t: r }, { tipo: 'CORO', t: r + 20 }];

  if (reels === 'CAMPO' || reels === 'JOGADOR' || reels === 'SITE') {
    // O pênalti convertido (o canto aparece na cobrança) serve aos dois primeiros.
    guardar('PENALTI', procurar(padrao, (l) => l.bolaParada === 'PENALTI' && l.tipo === 'GOL'), (tl, i) => trechoDoLance(tl, i, 35, 40, gol));
  }
  if (reels === 'CAMPO') {
    guardar('FALTA_CARTAO', procurar(padrao, (l) => l.tipo === 'FALTA' && l.falta?.cartao === 'AMARELO' && l.falta.local === 'LONGE'), (tl, i) =>
      trechoDoLance(tl, i, 30, 38, (r) => [{ tipo: 'APITO_FALTA', t: r }]),
    );
    // Chute por cima da Barreira que vai ao gol (gol ou defesa): desde a Barreira formada
    // (25% da jogada) até depois da resolução, com o chute (60%) no meio do trecho.
    guardar('BARREIRA', procurar(padrao, (l) => l.bolaParada === 'FALTA_DIRETA' && (l.barreira?.length ?? 0) >= 2 && (l.tipo === 'GOL' || l.tipo === 'DEFESA')), (tl, i) => {
      const j = tl.janelas[i]!;
      const chute = j.inicio + (j.fim - j.inicio) * 0.6;
      return { de: j.inicio + (j.fim - j.inicio) * 0.25, chave: chute, ate: j.resolucao + (j.lance.tipo === 'GOL' ? 30 : 15), sons: [{ tipo: 'CHUTE', t: chute }, ...(j.lance.tipo === 'GOL' ? gol(j.resolucao) : [{ tipo: 'QUASE' as const, t: j.resolucao }])] };
    });
    guardar('ESCANTEIO', procurar(padrao, (l) => l.bolaParada === 'ESCANTEIO' && (l.tipo === 'GOL' || l.tipo === 'DEFESA')), (tl, i) =>
      trechoDoLance(tl, i, 45, 20, (r) => (tl.janelas[i]!.lance.tipo === 'GOL' ? gol(r) : [{ tipo: 'QUASE', t: r }])),
    );
    // Contra-ataque em que a defesa não voltou a tempo, e Marcação dupla com o passe para o livre.
    guardar('CONTRA_ATAQUE', procurar(padrao, (l) => !!l.contraAtaque && !l.contraAtaque.recomposto && (l.tipo === 'GOL' || l.tipo === 'DEFESA')), (tl, i) =>
      trechoDoLance(tl, i, 70, 25, (r) => (tl.janelas[i]!.lance.tipo === 'GOL' ? gol(r) : [{ tipo: 'QUASE', t: r }])),
    );
    guardar('MARCACAO_DUPLA', procurar(padrao, (l) => !!l.dobra?.passe && (l.tipo === 'GOL' || l.tipo === 'DEFESA')), (tl, i) =>
      trechoDoLance(tl, i, 60, 25, (r) => (tl.janelas[i]!.lance.tipo === 'GOL' ? gol(r) : [{ tipo: 'QUASE', t: r }])),
    );
    guardar('GOL_TORCIDA', procurar(padrao, (l) => l.tipo === 'GOL' && !l.bolaParada, 5), (tl, i) => trechoDoLance(tl, i, 25, 70, gol));
    // Chuva e o segundo uniforme na mesma Partida (camisas parecidas: Onça × Lobo-guará).
    guardar(
      'CLIMA',
      procurar(
        (seed) => partidaT2(seed, 'ONC', 'LOB'),
        (l, _p, tl) => tl.t2?.segundoUniforme !== null && l.tipo === 'DEFESA',
        1,
        400,
        (seed) => climaDaPartida(seed) === 'CHUVA',
      ),
      (tl, i) => trechoDoLance(tl, i, 45, 20, (r) => [{ tipo: 'QUASE', t: r }]),
    );
    guardar('TROCA', procurar(padrao, (_l, p) => (p.resultado.substituicoes?.length ?? 0) >= 2), (tl) => {
      const t = tl.trocas[0]!.t;
      return { de: t - 4, chave: t + 18, ate: t + 58, sons: [] };
    });
  }
  if (reels === 'CAPITAO') {
    // A jogada que deu certo: Tabela e Ligação direta que viraram gol; a Cobertura que desarmou.
    const deuCerto = (l: Lance) => (l.jogadaDaFormacao === 'COBERTURA' ? l.tipo === 'DESARME' : l.tipo === 'GOL');
    const jogada = (id: ClipeId, f: Formacao, tipo: NonNullable<Lance['jogadaDaFormacao']>) =>
      guardar(id, procurar((seed) => partidaT2(seed, 'CAP', 'TAM', { formacao: { mandante: f, visitante: '2-2-2' } }), (l) => l.jogadaDaFormacao === tipo && deuCerto(l) && l.ataque === (tipo === 'COBERTURA' ? 'visitante' : 'mandante')), (tl, i) =>
        trechoDoLance(tl, i, 70, 20, (r) => (tl.janelas[i]!.lance.tipo === 'GOL' ? gol(r) : [])),
      );
    jogada('TABELA', '2-3-1', 'TABELA');
    jogada('COBERTURA', '3-2-1', 'COBERTURA');
    jogada('LIGACAO_DIRETA', '3-1-2', 'LIGACAO_DIRETA');
  }
  if (reels === 'T3_CAMPO') {
    // Capivara × Tamanduá com as regras da T3 (ADR-0094).
    const t3 = (seed: number) => partidaT2(seed, 'CAP', 'TAM', { t3: 'NORMAL' });
    const quase = (tl: Timeline, i: number) => (r: number): EventoSonoro[] => (tl.janelas[i]!.lance.tipo === 'GOL' ? gol(r) : [{ tipo: 'QUASE', t: r }]);
    guardar('TRAVE', procurar(t3, (l) => !!l.trave), (tl, i) => trechoDoLance(tl, i, 50, 20, quase(tl, i)));
    // O rebote que virou gol, desde a defesa do goleiro (o lance anterior).
    guardar('REBOTE', procurar(t3, (l) => !!l.rebote && l.tipo === 'GOL'), (tl, i) => {
      const antes = tl.janelas[i - 1]!;
      const j = tl.janelas[i]!;
      return { de: Math.max(antes.inicio, antes.resolucao - 25), chave: j.resolucao, ate: j.resolucao + 25, sons: gol(j.resolucao) };
    });
    guardar('CHUTE_DE_LONGE', procurar(t3, (l, p) => !!l.chuteDeLonge && (l.tipo === 'GOL' || l.tipo === 'DEFESA') && p.escalacoes[l.ataque].jogadores[l.finalizador?.indice ?? -1]?.posicao === 'MEI'), (tl, i) =>
      trechoDoLance(tl, i, 40, 22, quase(tl, i)),
    );
    guardar('GOL_DE_PLACA', procurar(t3, (l) => !!l.golDePlaca), (tl, i) => trechoDoLance(tl, i, 55, 30, gol));
    guardar('PRESSAO', procurar(t3, (l) => !!l.pressao && (l.tipo === 'GOL' || l.tipo === 'DEFESA')), (tl, i) => trechoDoLance(tl, i, 50, 22, quase(tl, i)));
    // A placa dos Acréscimos: do fim dos 90 minutos até um pouco depois.
    guardar('ACRESCIMOS', procurar(t3, (l) => (l.acrescimo ?? 0) >= 2), (tl, i) => {
      const j = tl.janelas[i]!;
      return { de: j.inicio - 12, chave: j.inicio, ate: j.inicio + 40, sons: [] };
    });
  }
  return { reels, estreia: o.estreia, publicadoEm: o.publicadoEm, partidas, clipes };
}
