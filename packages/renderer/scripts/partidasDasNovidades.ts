/**
 * Partidas de exemplo dos Reels de Novidades da T2 (ADR-0062) e os trechos de jogo de cada
 * novidade. Tudo determinístico: as mesmas sementes dão sempre os mesmos trechos. Os nomes em
 * cima dos bonecos são apelidos inventados (nunca um @ de verdade).
 */
import { IDENTIDADE, VAGAS_DA_FORMACAO, habilidadesDoPerfil, type Escalacao, type Formacao, type Posicao, type Postura, type TimeId } from '@liga/shared';
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
  });
  return {
    resultado,
    escalacoes: { mandante: a.esc, visitante: b.esc },
    nomes: { mandante: a.nomes, visitante: b.nomes },
    apelidos: { mandante: a.apelidos, visitante: b.apelidos },
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
  return { reels, estreia: o.estreia, publicadoEm: o.publicadoEm, partidas, clipes };
}
