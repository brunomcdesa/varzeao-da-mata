/**
 * Reels de Novidades da Temporada 2 (ADR-0063): quatro Reels curtos, um por tema, na quarta antes
 * da estreia. Dentro de campo, Capitão, Seu Jogador e Site e App. As novidades de dentro de campo
 * e as Jogadas da Formação aparecem no próprio jogo (trechos de Partidas de exemplo, com a
 * legenda embaixo); o resto em cartelas, no estilo dos outros Reels de anúncio. Cada Reels tem o
 * seu Narrador; no de dentro de campo, os cinco Narradores se apresentam com a própria voz.
 */
import { ESPECIALIZACOES, NOME_DA_ESPECIALIZACAO, NOME_DA_HABILIDADE, coresDosItens, type ComemoracaoDaLoja, type ItensEquipados, type Posicao, type TimeId } from '@liga/shared';
import { boneco, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, desenharQuadro } from './desenho.js';
import type { EventoSonoro, Fala } from './narracao.js';
import { NARRADORES } from './narradores.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import { quadroDaComemoracao, sprite, type Pose, type Visual } from './sprites.js';
import { Timeline } from './timeline.js';
import { DURACAO_DO_CARTAO, cameraQueSegue, closeNoJuiz, desenharCartaoGigante, desenharEscudoDaLiga, tempoComPausa, veu, type MomentoDoCartao, type PartidaParaVideo } from './video.js';
import { desenharEstrelaSolta } from './escudos.js';

export type ReelsDeNovidades = 'CAMPO' | 'CAPITAO' | 'JOGADOR' | 'SITE' | 'T3_CAMPO' | 'T3_LOJA' | 'T3_PALPITE' | 'T3_CAPITAO' | 'T3_LOJA2';
/** As séries de Reels de cada Temporada: a T2 (ADR-0063) e a T3 (ADR-0092). */
export const SERIE_DE_NOVIDADES: Record<2 | 3, readonly ReelsDeNovidades[]> = {
  2: ['CAMPO', 'CAPITAO', 'JOGADOR', 'SITE'],
  3: ['T3_CAMPO', 'T3_LOJA', 'T3_PALPITE', 'T3_CAPITAO'],
};
/** Fora das séries: o anúncio da segunda fase da Loja, no meio da T3 (ADR-0101). */
export const REELS_DE_NOVIDADES: readonly ReelsDeNovidades[] = [...SERIE_DE_NOVIDADES[2], ...SERIE_DE_NOVIDADES[3], 'T3_LOJA2'];
export const temporadaDasNovidades = (r: ReelsDeNovidades): 2 | 3 => (r.startsWith('T3_') ? 3 : 2);
const serieDe = (r: ReelsDeNovidades) => SERIE_DE_NOVIDADES[temporadaDasNovidades(r)];
/** O id do Reels Programado (e do vídeo) de cada um. */
export const ID_DAS_NOVIDADES: Record<ReelsDeNovidades, string> = {
  CAMPO: 'novidades-campo', CAPITAO: 'novidades-capitao', JOGADOR: 'novidades-jogador', SITE: 'novidades-site',
  T3_CAMPO: 'novidades-t3-campo', T3_LOJA: 'novidades-t3-loja', T3_PALPITE: 'novidades-t3-palpite', T3_CAPITAO: 'novidades-t3-capitao',
  T3_LOJA2: 'novidades-t3-loja2',
};
/** Narrador de cada Reels. */
export const NARRADOR_DAS_NOVIDADES: Record<ReelsDeNovidades, string> = {
  CAMPO: 'RITA', CAPITAO: 'TURBO', JOGADOR: 'BETO', SITE: 'ZE',
  T3_CAMPO: 'TURBO', T3_LOJA: 'ZE', T3_PALPITE: 'BETO', T3_CAPITAO: 'RITA', T3_LOJA2: 'ZE',
};
/** Hora (Brasília) de cada um; o Reels anterior chama o seguinte. */
export const HORA_DAS_NOVIDADES: Record<ReelsDeNovidades, number> = {
  CAMPO: 12, CAPITAO: 14, JOGADOR: 16, SITE: 18,
  T3_CAMPO: 12, T3_LOJA: 14, T3_PALPITE: 16, T3_CAPITAO: 18, T3_LOJA2: 10,
};

/** Os trechos de jogo que os Reels usam (achados nas Partidas de exemplo pelo script de gravação). */
export type ClipeId =
  | 'FALTA_CARTAO' | 'PENALTI' | 'BARREIRA' | 'ESCANTEIO' | 'CONTRA_ATAQUE' | 'MARCACAO_DUPLA' | 'GOL_TORCIDA' | 'CLIMA' | 'TROCA'
  | 'TABELA' | 'COBERTURA' | 'LIGACAO_DIRETA'
  /** T3 (ADR-0094). */
  | 'TRAVE' | 'REBOTE' | 'CHUTE_DE_LONGE' | 'GOL_DE_PLACA' | 'PRESSAO' | 'ACRESCIMOS';

/** Um trecho de jogo: de `de` até `ate` (s de jogo), com o momento principal em `chave`. */
export interface ClipeDeJogo {
  partida: number;
  de: number;
  chave: number;
  ate: number;
  /** Sons do trecho, em s de jogo. */
  sons: EventoSonoro[];
}

export interface DadosDasNovidades {
  reels: ReelsDeNovidades;
  /** Dia da estreia (Rodada 1), AAAA-MM-DD, e o dia do post. */
  estreia: string;
  publicadoEm: string;
  /** Partidas de exemplo (T2) e os trechos achados nelas. Sem o trecho, a cena sai do Reels. */
  partidas: PartidaParaVideo[];
  clipes: Partial<Record<ClipeId, ClipeDeJogo>>;
}

type CartelaId =
  | 'ABERTURA' | 'NARRADORES' | 'NARRADOR' | 'CHAMADA'
  | 'CAPITAO' | 'POSTURA' | 'FORMACAO'
  | 'VINCULO' | 'APELIDO' | 'CAMISA' | 'ESPECIALIZACAO' | 'TREINO' | 'PRESENCA' | 'RESENHA' | 'SELECAO'
  | 'APP' | 'AVISOS' | 'AO_VIVO' | 'CARREIRA' | 'ESTRELA'
  /** T3 (ADRs 0087 a 0091 e 0101). */
  | 'JUIZ' | 'MOEDAS' | 'LOJA' | 'PALPITE' | 'CONQUISTAS' | 'BATEDORES'
  /** Segunda fase da Loja (ADR-0101). */
  | 'CORTES' | 'COMEMORACOES';

export interface CenaNovidade {
  id: string;
  /** Duração mínima (s); a narração estica. */
  base: number;
  fala: string;
  tom: 'normal' | 'animado';
  /** Outro Narrador nesta fala (a apresentação de cada um). */
  narrador?: string;
  visual:
    | { clipe: ClipeId; legenda: string }
    | { cartela: CartelaId; k?: number }
    /** Tábuas com nome e apoio (apoio com \n em mais de uma linha) e uma linha no rodapé. */
    | { cartela: 'LISTA'; titulo: string; itens: [string, string][]; rodape?: string };
}

const TITULO: Record<ReelsDeNovidades, string> = {
  CAMPO: 'Dentro de campo', CAPITAO: 'O Capitão', JOGADOR: 'Seu Jogador', SITE: 'Site e App',
  T3_CAMPO: 'Dentro de campo', T3_LOJA: 'Salário e Loja', T3_PALPITE: 'Palpite e Conquistas', T3_CAPITAO: 'Capitão e Batedores', T3_LOJA2: 'Loja nova',
};
/** Como o Reels anterior chama o seguinte ("às duas da tarde, tem mais: ..."). */
const CHAMADA_DO_PROXIMO: Record<ReelsDeNovidades, string> = {
  CAMPO: '', CAPITAO: 'o capitão', JOGADOR: 'o seu jogador', SITE: 'o site e o app',
  T3_CAMPO: '', T3_LOJA: 'o salário e a loja', T3_PALPITE: 'o palpite e as conquistas', T3_CAPITAO: 'o capitão e os batedores', T3_LOJA2: '',
};
const HORA_FALADA: Record<number, string> = { 10: 'às dez da manhã', 11: 'às onze', 12: 'ao meio-dia', 13: 'à uma da tarde', 14: 'às duas da tarde', 15: 'às três da tarde', 16: 'às quatro da tarde', 17: 'às cinco da tarde', 18: 'às seis da tarde', 19: 'às sete da noite', 20: 'às oito da noite', 21: 'às nove da noite' };
const DIA_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const NUMERO: Record<number, string> = { 1: 'um', 19: 'dezenove', 20: 'vinte', 21: 'vinte e um' };

/** "amanhã" ou "na quinta, dia dezenove". */
export function quandoEstreia(d: Pick<DadosDasNovidades, 'estreia' | 'publicadoEm'>): { falado: string; escrito: string } {
  const [a, m, dia] = d.estreia.split('-').map(Number) as [number, number, number];
  const estreia = Date.UTC(a, m - 1, dia, 12);
  const post = new Date(Date.parse(d.publicadoEm) - 3 * 3600_000);
  const hoje = Date.UTC(post.getUTCFullYear(), post.getUTCMonth(), post.getUTCDate(), 12);
  const semana = DIA_DA_SEMANA[new Date(estreia).getUTCDay()]!;
  const data = `${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  if (estreia - hoje === 86_400_000) return { falado: 'amanhã', escrito: `Amanhã, ${semana} ${data}` };
  return { falado: `${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}, dia ${NUMERO[dia] ?? dia}`, escrito: `${semana[0]!.toUpperCase()}${semana.slice(1)}, ${data}` };
}

/** As cenas de cada Reels, na ordem, com o texto falado. Cenas de jogo sem trecho saem. */
export function cenasDasNovidades(d: DadosDasNovidades): CenaNovidade[] {
  const serie = serieDe(d.reels);
  // Fora da série (a Loja nova), não chama ninguém.
  const proximo = serie.includes(d.reels) ? serie[serie.indexOf(d.reels) + 1] : undefined;
  const chamaProximo = proximo ? ` E ${HORA_FALADA[HORA_DAS_NOVIDADES[proximo]]}, tem mais: ${CHAMADA_DO_PROXIMO[proximo]}!` : '';
  const estreia = quandoEstreia(d).falado;
  const c = (id: string, base: number, fala: string, visual: CenaNovidade['visual'], tom: CenaNovidade['tom'] = 'normal', narrador?: string): CenaNovidade => ({ id, base, fala, visual, tom, ...(narrador ? { narrador } : {}) });
  const jogo = (clipe: ClipeId, legenda: string, fala: string, base = 6.5) => c(clipe.toLowerCase(), base, fala, { clipe, legenda });
  const lista = (id: string, titulo: string, itens: [string, string][], fala: string, rodape?: string, base = 7) => c(id, base, fala, { cartela: 'LISTA', titulo, itens, ...(rodape ? { rodape } : {}) });
  let cenas: CenaNovidade[];
  switch (d.reels) {
    case 'CAMPO':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada dois, parte um: dentro de campo! Presta atenção, que é muita coisa.', { cartela: 'ABERTURA' }, 'animado'),
        jogo('FALTA_CARTAO', 'Falta e cartão', 'Agora tem falta! Parte dos desarmes vira falta. E tem juiz em campo: ele corre atrás do lance, apita a falta e mostra o cartão.'),
        lista('cartoes', 'Cartões', [
          ['Amarelo', 'Às vezes, na falta.\nDois no mesmo jogo viram vermelho.'],
          ['Vermelho', 'Quando a falta impede um gol claro.\nExpulsa na hora: o Time fica com 6.'],
          ['Suspensão', 'Um vermelho, ou dois amarelos na\nTemporada: fora do jogo seguinte.'],
        ], 'O amarelo vem às vezes, na falta, e dois amarelos no mesmo jogo viram vermelho. O vermelho vem quando a falta impede um gol claro, e expulsa na hora: o time segue com seis até o fim. E um vermelho, ou dois amarelos na temporada, deixam o jogador fora do jogo seguinte.', 'Suspenso? Entra outro no lugar', 9),
        lista('local-da-falta', 'Onde foi a falta', [
          ['Dentro da área', 'Pênalti.'],
          ['Na entrada da área', 'Chute direto, com Barreira.'],
          ['Mais longe', 'Jogada ensaiada: cruzamento\npara a cabeçada ou toque curto.'],
        ], 'E o lugar da falta decide a cobrança. Dentro da área, é pênalti. Na entrada da área, chute direto, com barreira. Mais longe, jogada ensaiada: cruzamento pra cabeçada, ou um toque curto pro chute. E quem cobra é sempre o melhor do time em campo pra aquela cobrança.', 'Cobra o melhor do Time para a cobrança', 9),
        jogo('PENALTI', 'Pênalti', 'Olha o pênalti! Batedor contra goleiro, e cada um vai pro canto que escolheu no site.'),
        jogo('BARREIRA', 'Falta com barreira', 'Na entrada da área, a barreira fica entre a bola e o gol. O chute pode bater nela antes de chegar no goleiro.'),
        jogo('ESCANTEIO', 'Escanteio', 'Depois de uma defesa ou de um chute travado, vem o escanteio: cruzamento, cabeçada, e pode ser gol.'),
        jogo('CONTRA_ATAQUE', 'Contra-ataque', 'E tem contra-ataque: quando um time perde a bola com gente lá na frente, e a defesa não volta a tempo, o rival chega com vantagem.'),
        jogo('MARCACAO_DUPLA', 'Marcação dupla', 'Às vezes os dois zagueiros vão juntos no mesmo atacante. Fica mais difícil pra ele, mas um companheiro fica livre. Se o passe sai, é chute sem marcador.'),
        jogo('GOL_TORCIDA', 'Arquibancada', 'Do lado do campo, a arquibancada, nas cores de cada time. Quanto maior o elenco, maior a torcida. Ela comemora, sofre junto, e depois do gol canta o grito de guerra do time!', 8),
        jogo('CLIMA', 'Sol, chuva ou lama', 'Cada jogo tem o seu clima: sol, tempo nublado, chuva ou lama. Muda o visual e a fala do narrador, mas não decide nenhum lance. E quando as camisas se confundem, o visitante joga com o segundo uniforme.', 8),
        jogo('TROCA', 'Substituição', 'E no intervalo tem substituição! Quem está com nota abaixo de cinco pode sair, até duas trocas por time. O juiz levanta a placa, e quem sai vai pro lado da própria torcida.', 8),
        lista('banco', 'O Banco', [
          ['Todos que sobraram', 'Quem não entrou na Escalação\nfica no Banco.'],
          ['Mesma Posição primeiro', 'Sem reserva da Posição, entra\noutro de linha.'],
          ['Goleiro só por goleiro', 'Sem goleiro no Banco,\no goleiro fica em campo.'],
          ['Entrou, conta jogo', 'E o expulso não é substituído.'],
        ], 'No banco ficam todos que sobraram da escalação. Entra primeiro o reserva da mesma posição. Na linha, sem reserva da posição, entra outro jogador de linha. Goleiro só sai pra outro goleiro. Quem entrou conta o jogo. E o expulso não é substituído.', undefined, 10),
        c('narradores', 3, 'E agora são cinco narradores, cada um com a sua voz e o seu jeito. O narrador é sorteado a cada jogo.', { cartela: 'NARRADORES' }),
        ...NARRADORES.map((n, k) => c(`narrador-${k}`, 1.6, n.apresentacao, { cartela: 'NARRADOR', k }, 'animado', n.id)),
        lista('apelido-na-fala', 'Apelido na narração', [
          ['Em toda fala', 'O Narrador chama o Jogador\npelo apelido.'],
          ['Na primeira vez', 'Com a Posição e o Time:\n"Bruninho, atacante da Onça".'],
          ['Sem apelido', 'Continua pela Posição e pelo Time.'],
        ], 'E na temporada dois, o narrador fala o apelido do jogador em toda fala. Na primeira vez, com a posição e o time. Quem não tem apelido continua sendo chamado pela posição e pelo time.', 'O Narrador nunca fala o @', 8),
        c('chamada', 5, `A estreia é ${estreia}!${chamaProximo}`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'CAPITAO':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada dois, parte dois: o capitão!', { cartela: 'ABERTURA' }, 'animado'),
        c('capitao', 7, 'Todo time tem um capitão: o jogador com mais partidas pelo time. Ele precisa ter o vínculo no site. Sem vínculo, ou suspenso, a faixa passa pro próximo da lista que tenha vínculo.', { cartela: 'CAPITAO' }),
        lista('faixa', 'A faixa C', [
          ['Pública', 'O "C" aparece no site, no Elenco\ne na Escalação.'],
          ['Em campo', 'Se o Capitão ficou de fora, a faixa\nvai para o primeiro que entrou.'],
        ], 'A faixa é pública: o C aparece do lado do nome dele no site, no elenco e na escalação. E se o rodízio deixou o capitão de fora, em campo a faixa vai pro primeiro da lista que entrou.', undefined, 7),
        c('postura', 9, 'Antes de cada jogo, até o corte, trinta minutos antes do apito inicial, ele escolhe a postura pelo site, em segredo. Ofensiva: o time ataca mais e deixa a defesa exposta. Equilibrada: não muda nada, e é a postura quando ele não escolhe. Defensiva: o time se fecha e ataca menos.', { cartela: 'POSTURA' }),
        lista('ritmo', 'Postura e Ritmo', [
          ['Dois Ofensivos', 'Jogo mais aberto, com mais lances.'],
          ['Dois Defensivos', 'Jogo mais travado, com menos lances.'],
        ], 'E a postura dos dois times mexe no ritmo: dois times ofensivos deixam o jogo mais aberto, com mais lances. Dois defensivos deixam o jogo mais travado.', 'Só o Capitão vê as opções', 7),
        c('formacao', 9, 'Junto com a postura, e também até o corte, ele escolhe a formação. São quatro: dois, dois, dois, o padrão quando ele não escolhe; dois, três, um; três, dois, um; e três, um, dois. Vale pro jogo inteiro.', { cartela: 'FORMACAO' }),
        lista('formacoes', 'Cada uma tem um jeito', [
          ['2-3-1 · Meio forte', 'Os meias tabelam e chutam mais\nde fora; a defesa fica exposta.'],
          ['3-2-1 · Defesa forte', 'O terceiro zagueiro faz a\nCobertura; o ataque perde força.'],
          ['3-1-2 · Contra-ataque', 'O zagueiro lança direto para o\nataque; o meio perde mais a bola.'],
        ], 'No dois, três, um, o meio fica forte: os meias tabelam e chutam mais de fora, mas a defesa fica exposta. No três, dois, um, a defesa fica forte, e o ataque perde força. No três, um, dois, é contra-ataque: o zagueiro lança direto pra dupla de ataque, e o meio perde mais a bola. Nenhuma é melhor que as outras. E postura e formação somam, com limite.', 'Nenhuma é melhor que as outras', 12),
        lista('vagas', 'As vagas', [
          ['Seguem a Formação', 'Com 1 atacante, os atacantes do\nTime revezam uma vaga só.'],
          ['Fora de posição', 'Faltou gente? Entra um de outra\nPosição, com o OVR da vaga.'],
          ['Jogador da Base', 'Só quando não sobra ninguém.'],
          ['Ficou de fora?', 'Quem a Formação cortou tem\nprioridade no jogo seguinte.'],
        ], 'As vagas da escalação seguem a formação. Faltou gente numa posição? Entra alguém de outra posição, fora de posição, com o OVR calculado pra vaga. O jogador da base só entra quando não sobra ninguém. E quem a formação deixou de fora ganha prioridade no jogo seguinte do time.', undefined, 11),
        jogo('TABELA', 'Tabela · 2-3-1', 'E cada formação tem a sua jogada. No dois, três, um, a tabela: o meia toca pro outro meia e recebe de volta antes de criar.', 7),
        jogo('COBERTURA', 'Cobertura · 3-2-1', 'No três, dois, um, a cobertura: quando o atacante dribla o marcador, o zagueiro da sobra chega pra mais um desarme.', 7),
        jogo('LIGACAO_DIRETA', 'Ligação direta · 3-1-2', 'E no três, um, dois, a ligação direta: o zagueiro lança direto pros atacantes, sem passar pelo meio. O dois, dois, dois não tem jogada própria.', 7),
        c('chamada', 5, `Capitão, entra no site e escolhe antes do corte! A estreia é ${estreia}.${chamaProximo}`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'JOGADOR':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada dois, parte três: o seu jogador!', { cartela: 'ABERTURA' }, 'animado'),
        c('vinculo', 7, 'Quase tudo do seu jogador se faz pelo site, com o vínculo: no site, você acha o seu jogador, pega o código e manda na DM da liga. Pronto: o jogador fica ligado ao seu celular.', { cartela: 'VINCULO' }),
        c('apelido', 8, 'Escolhe um apelido: de duas a catorze letras, sem palavrão, e que ninguém mais da liga tenha. Ele aparece em cima do seu jogador, nos Reels, no ao vivo e no site, e o narrador fala o apelido nos lances. Dá pra trocar uma vez por dia.', { cartela: 'APELIDO' }),
        c('camisa', 7, 'E agora tem número na camisa! No site, você escolhe de um a noventa e nove, sem repetir no seu time. Ele aparece nas costas do seu jogador, nos Reels, no ao vivo e no replay.', { cartela: 'CAMISA' }),
        c('especializacao', 10, 'A especialização é o seu jeito de jogar: três por posição. No ataque, artilheiro, driblador ou oportunista. No meio, armador, volante ou meia-atacante. Na zaga, xerife, bloqueador ou antecipação. E no gol, paredão, gato ou pegador de pênalti.', { cartela: 'ESPECIALIZACAO' }),
        lista('especializacao-regras', 'Especialização', [
          ['Melhora e piora', 'Ganha num Duelo e perde um pouco\nem outro: o OVR continua valendo.'],
          ['Uma por jogo', 'Vale a partir do próximo jogo.'],
          ['Troca uma vez por dia', 'Sem escolha, joga como antes.'],
        ], 'Cada uma melhora uma coisa e piora um pouco outra, pro OVR continuar valendo. Vale a partir do próximo jogo, e dá pra trocar uma vez por dia. Sem escolha, você joga como antes.', 'O que cada uma faz está no site', 8),
        c('treino', 7, 'No treino, você escolhe uma habilidade de foco: os ganhos dela sobem cinquenta por cento mais rápido, sem tirar das outras.', { cartela: 'TREINO' }),
        lista('evolucao', 'Evolução na T2', [
          ['Ganhos 1,5 vez', 'Para todo mundo. As perdas\ncontinuam iguais.'],
          ['Limite por jogo', '2 pontos por Habilidade;\n4 no Clássico.'],
          ['Os bônus somam', 'Treino, Resenha e o Bônus\nda Temporada 1.'],
        ], 'E na temporada dois, todo mundo evolui mais rápido: os ganhos de habilidade valem uma vez e meia, e as perdas continuam iguais. O limite por jogo continua: dois pontos por habilidade, quatro no clássico. E os bônus somam: treino, resenha e o bônus da temporada um.', undefined, 9),
        c('presenca', 8, 'Vai jogar? Comenta CONFIRMO no post, ou confirma no site, até o corte do próximo jogo do seu time. Quem confirma passa na frente no rodízio, logo depois do craque da rodada. A confirmação vale só pra aquele jogo.', { cartela: 'PRESENCA' }),
        lista('fila', 'A fila da Escalação', [
          ['1. Craque da Rodada', 'O da Rodada anterior.'],
          ['2. Quem tem prioridade', 'Presença, 2 jogos seguidos fora,\ncortado pela Formação e Resenha\nno Clássico.'],
          ['3. O rodízio', 'Quem jogou menos, depois quem\njogou há mais tempo.'],
        ], 'A fila de cada posição fica assim: primeiro o craque da rodada anterior. Depois, quem tem prioridade: quem confirmou presença, quem ficou dois jogos seguidos de fora, quem a formação cortou, e, no clássico, quem tem resenha. Depois, o rodízio de sempre: quem jogou menos, e quem jogou há mais tempo.', 'Ficou 2 jogos fora? Prioridade', 12),
        c('resenha', 9, 'Comentou no Reels do último jogo do seu time, até o corte do próximo? Isso é resenha: as suas habilidades sobem cinquenta por cento mais rápido nesse jogo, se você for escalado. E se o próximo jogo for o clássico, você ainda passa na frente no rodízio.', { cartela: 'RESENHA' }),
        jogo('PENALTI', 'Seu canto', 'No pênalti, vale o canto que você escolheu no site: esquerda, meio ou direita. Pra batedor e goleiro, no jogo e na disputa do mata-mata. Acertar o canto ajuda o goleiro; errar ajuda o batedor. Quem não escolhe tem o canto sorteado.', 9),
        c('selecao', 9, 'E toda rodada sai a seleção da rodada: o muralha, o carrapato, o garçom e o matador, a maior nota de cada posição. Sai sozinha no resumo, sem voto, e vira troféu na carreira. No fim, tem a seleção da temporada.', { cartela: 'SELECAO' }),
        c('chamada', 5, `A estreia é ${estreia}!${chamaProximo}`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'SITE':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada dois, parte quatro: o site e o app!', { cartela: 'ABERTURA' }, 'animado'),
        c('app', 7, 'O site do Varzeão agora vira app no celular: ícone na tela inicial e tela cheia. Sem loja e sem baixar nada: é o mesmo site, sempre atualizado.', { cartela: 'APP' }),
        lista('instalar', 'Como instalar', [
          ['Android', 'No Chrome, toque em\n"Instalar o App".'],
          ['iPhone', 'No Safari: Compartilhar e\n"Adicionar à Tela de Início".'],
          ['Veio pelo Instagram?', 'Abra no navegador do celular:\ndentro do Instagram não dá.'],
        ], 'No Android, abre o site no Chrome e toca em instalar o app. No iPhone, no Safari, toca em compartilhar e depois em adicionar à tela de início. Abriu pelo Instagram? Abre no navegador do celular primeiro, porque dentro do Instagram não dá pra instalar.', 'No iPhone, vincule de novo dentro do App', 10),
        c('avisos', 9, 'Liga os avisos e escolhe os seus times. Chega aviso quando sai a escalação, cinco minutos antes do apito inicial, a cada gol e no fim do jogo, com o placar. O aviso do gol nunca chega antes do lance aparecer no ao vivo. No iPhone, os avisos só chegam com o app instalado.', { cartela: 'AVISOS' }),
        c('ao-vivo', 8, 'O jogo completo passa ao vivo no site e no app; o Reels é só os melhores momentos. E no ao vivo aparece quanta gente está assistindo.', { cartela: 'AO_VIVO' }),
        lista('reacoes', 'Reações', [
          ['Gol, Fogo, Susto e Palmas', 'Sobem na tela de todo mundo.'],
          ['Uma por segundo', 'Para cada pessoa assistindo.'],
          ['Só no Ao Vivo', 'Não ficam no Replay.'],
        ], 'E dá pra reagir: gol, fogo, susto e palmas. A reação sobe na tela de todo mundo que está assistindo, uma por segundo. E não fica no replay: perdeu o jogo, o replay mostra a partida lance a lance.', undefined, 8),
        c('carreira', 9, 'E cada jogador ganha a página de carreira: temporada por temporada, o time e a série, jogos, gols, assistências, nota média, OVR do começo e do fim, cartões e troféus. E quem jogou a temporada um ganha o selo Temporada Um.', { cartela: 'CARREIRA' }),
        c('estrela', 7, 'E o campeão ganha estrela no escudo: dourada pelo título da Série A. E quando tiver Série B, prata pelo título dela. Ela aparece em todo lugar: no site, nos Reels e no ao vivo.', { cartela: 'ESTRELA' }),
        c('chamada', 5, `A temporada dois começa ${estreia}! São dezesseis times na Série A, em dois grupos, um jogo por hora, das onze às seis da tarde. Link na bio!`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    // ------------------------------------------------ T3 (ADR-0092)
    case 'T3_CAMPO':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada três, parte um: dentro de campo! Tem lance novo no jogo.', { cartela: 'ABERTURA' }, 'animado'),
        jogo('TRAVE', 'Na trave!', 'Agora a bola bate na trave! O chute que ia pra fora às vezes explode no poste, e o narrador grita junto.'),
        jogo('REBOTE', 'Rebote', 'E tem rebote: o goleiro defende, a bola sobra na área, e começa a briga do atacante com o zagueiro. Quem chega primeiro, chuta de novo ou afasta.', 7.5),
        jogo('CHUTE_DE_LONGE', 'Chute de longe', 'O meia e até o zagueiro agora arriscam de longe! O chute sai de fora da área e pode surpreender o goleiro.', 7),
        jogo('GOL_DE_PLACA', 'Gol de placa', 'E quando sai um golaço, é gol de placa! Ele aparece em câmera lenta no Reels, ganha placa na tela, e o primeiro do jogador vale conquista.', 7.5),
        jogo('PRESSAO', 'Pressão final', 'Nos quinze minutos finais, quem perde por um ou dois gols parte pra pressão: o time ataca mais e deixa a defesa aberta. No mata-mata e na Copa, o empate também pressiona.', 8),
        jogo('ACRESCIMOS', 'Acréscimos', 'E tem acréscimo! No fim do segundo tempo, o juiz levanta a placa com os minutos a mais, de um a quatro. Ainda dá tempo de virar.', 7),
        c('juiz', 9, 'E cada jogo tem o perfil do juiz, sorteado e mostrado na escalação. O rigoroso marca mais falta e dá mais cartão. O deixa jogar marca menos. E o normal fica no meio. O narrador avisa no apito inicial.', { cartela: 'JUIZ' }),
        c('chamada', 5, `A temporada três começa ${estreia}, com a Copa!${chamaProximo}`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'T3_LOJA':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada três, parte dois: salário e loja! Agora o seu jogador ganha moedas.', { cartela: 'ABERTURA' }, 'animado'),
        c('moedas', 8, 'Todo jogador do elenco recebe salário: dez moedas por rodada, jogando ou não, na Série A e na B. E é só ter o jogador: sem vínculo também acumula.', { cartela: 'MOEDAS' }),
        lista('premios', 'Prêmios', [
          ['Gol 3 · Assistência 2', 'Por lance, na Liga e na Copa.'],
          ['Seleção 5 · Craque 10', 'Seleção da Rodada e\nCraque da Rodada.'],
          ['Título', 'A: 50 · B: 30 · Copa: 40\npara quem entrou em campo.'],
        ], 'E tem prêmio: três moedas por gol e duas por assistência. Cinco na seleção da rodada, dez pro craque da rodada. E título vale muito: cinquenta na Série A, trinta na B e quarenta na Copa, pra quem entrou em campo.', 'Cartão vermelho não desconta', 10),
        lista('largada', 'Todo mundo do zero', [
          ['Começa na Pré-temporada', 'Junto com a Copa.'],
          ['Bônus de veterano', '20 Moedas por Temporada\njogada antes (T1 e T2).'],
          ['Só compram visual', 'Nada de OVR, Habilidade\nou vaga na Escalação.'],
        ], 'A conta começa do zero na pré-temporada, junto com a Copa. Quem já jogou ganha um bônus: vinte moedas por temporada jogada. E moeda só compra visual: não compra OVR, habilidade, nem vaga na escalação.', undefined, 9),
        c('loja', 9, 'E as moedas são pra loja, no site e no app. Chuteira colorida, munhequeira, faixa na cabeça e luva pro goleiro. Item básico custa vinte moedas. O dourado é raro e custa cem.', { cartela: 'LOJA' }),
        lista('como-comprar', 'Como comprar', [
          ['A sacola no topo', 'No site e no App, com Vínculo:\no saldo aparece do lado.'],
          ['É seu para sempre', 'Troca o equipado sem pagar\nde novo.'],
          ['Vale do próximo jogo', 'A Escalação guarda o que estava\nequipado no Corte.'],
        ], 'Pra comprar, toca na sacola no topo do site ou do app, com o vínculo. O saldo aparece do lado. O item é seu pra sempre: dá pra trocar o equipado sem pagar de novo. E vale a partir do próximo jogo: a escalação guarda o que estava equipado no corte.', 'Aparência e número continuam grátis', 10),
        lista('em-breve', 'No meio da Temporada', [
          ['Penteados e barba', 'Cortes novos para o boneco.'],
          ['Comemoração de gol', 'Item raro: o boneco comemora\ndo seu jeito no gol.'],
        ], 'E no meio da temporada chega mais: penteados e barba novos, e a comemoração de gol, um item raro pro seu jogador comemorar do jeito dele.', undefined, 7),
        c('chamada', 5, `A temporada três começa ${estreia}!${chamaProximo}`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'T3_PALPITE':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada três, parte três: palpite e conquistas!', { cartela: 'ABERTURA' }, 'animado'),
        c('palpite', 9, 'Agora dá pra dar palpite no placar! Na página de cada partida, com o vínculo, até o corte. Acertou o resultado, ganha duas moedas. Acertou o placar exato, ganha cinco.', { cartela: 'PALPITE' }),
        lista('palpite-regras', 'Palpite', [
          ['Em todo jogo', 'Até no do seu Time e na Copa.'],
          ['Até 10 Moedas por dia', 'O que passar do teto conta\nsó no ranking.'],
          ['Pênaltis', 'Vale o placar dos 90 minutos.'],
        ], 'Vale em todo jogo, até no do seu time e na Copa. O teto é dez moedas de palpite por dia, e o que passar conta no ranking dos palpiteiros. Errar não tira nada. E se for pros pênaltis, vale o placar dos noventa minutos.', 'Ranking dos Palpiteiros no site', 10),
        c('conquistas', 10, 'E tem conquistas: marcos da carreira, que viram selo na página do jogador e pagam moedas. As fáceis valem cinco, como a estreia e o primeiro gol. As médias valem dez, como o hat-trick e o gol de placa. E as difíceis valem vinte, como vinte gols na carreira ou três títulos.', { cartela: 'CONQUISTAS' }),
        lista('conquistas-regras', 'Conquistas', [
          ['Uma vez só', 'Cada Conquista é ganha uma vez\nna Carreira.'],
          ['T1 e T2 dão o selo', 'Moedas só pelo que for feito\nda T3 em diante.'],
        ], 'Cada conquista vale uma vez na carreira. O que você já fez na temporada um e na dois dá o selo, mas moeda, só pelo que fizer da temporada três em diante, incluindo a Copa.', undefined, 8),
        c('chamada', 5, `A temporada três começa ${estreia}!${chamaProximo}`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'T3_CAPITAO':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada três, parte quatro: o capitão e os batedores!', { cartela: 'ABERTURA' }, 'animado'),
        c('batedores', 9, 'Agora o capitão escolhe os batedores: a ordem dos cinco primeiros na disputa de pênaltis. Escolhe junto com a formação e a postura, até o corte.', { cartela: 'BATEDORES' }),
        lista('batedores-regras', 'Na hora da Disputa', [
          ['Não está em campo?', 'É pulado e entra o próximo\nda lista.'],
          ['Depois dos 5', 'Segue a ordem automática.'],
          ['Sem escolha', 'Vale a ordem automática,\ncomo antes.'],
        ], 'Na hora da disputa, quem não está em campo é pulado, e entra o próximo da lista. Depois dos cinco, segue a ordem automática. E se o capitão não escolher, vale a ordem automática, como antes.', undefined, 9),
        lista('pagina-do-time', 'Na página do Time', [
          ['O Capitão escolhe ali', 'Formação, Postura e Batedores,\ntambém na página do Time.'],
          ['O Time vê o plano', 'Quem tem Vínculo com o Time\nvê. Os rivais, não.'],
        ], 'E o capitão pode escolher tudo também na página do time: formação, postura e batedores. Os companheiros com vínculo veem o plano. Os rivais não veem nada.', 'Escolhe até o Corte', 8),
        c('chamada', 5, `A temporada três começa ${estreia}, com a Copa! Entra no site e confere tudo. Link na bio!`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'T3_LOJA2':
      cenas = [
        c('abertura', 4.5, 'Chegou a segunda fase da loja! Tem visual novo pro seu jogador.', { cartela: 'ABERTURA' }, 'animado'),
        c('cortes', 9, 'Quatro penteados novos: cabelo longo, raspado, tranças e topete. E três barbas: bigode, cavanhaque e barba cheia. Cada um custa vinte moedas, e fica na cor do cabelo que você já escolheu.', { cartela: 'CORTES' }),
        c('comemoracoes', 10, 'E agora o seu jogador comemora do jeito dele! Aviãozinho, mortal, joelhada ou dancinha. É item raro: cem moedas. Aparece no gol, no ao vivo, no replay e no Reels.', { cartela: 'COMEMORACOES' }),
        lista('como', 'Na Loja', [
          ['A sacola no topo', 'No site e no App, com Vínculo.'],
          ['Vale do próximo jogo', 'A Escalação guarda o que estava\nequipado no Corte.'],
        ], 'Tá tudo na loja, na sacola no topo do site e do app, com o vínculo. E vale a partir do próximo jogo.', undefined, 6.5),
        c('chamada', 4.5, 'Corre lá e deixa o seu jogador com a sua cara! Link na bio.', { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
  }
  return cenas.filter((x) => !('clipe' in x.visual) || d.clipes[x.visual.clipe]);
}

// ---------------------------------------------------------------- roteiro

export type SegmentoNovidade = Segmento & { cena: CenaNovidade };
const CORTE = 0.3;

export class RoteiroNovidades {
  readonly cenas: CenaNovidade[];
  readonly segmentos: SegmentoNovidade[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDasNovidades,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    this.cenas = cenasDasNovidades(dados);
    let cursor = 0;
    this.segmentos = this.cenas.map((cena, i) => {
      const inicio = cursor;
      cursor += Math.max(cena.base, minimos[i]?.antes ?? 0);
      // Trecho de jogo: música baixa, como nos lances do Reels da Partida.
      return { tipo: 'clipe' in cena.visual ? 'TROCA' : 'ABERTURA', cena, inicio, fim: cursor };
    });
    this.duracao = cursor;
  }

  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  em(tBruto: number): { segmento: SegmentoNovidade; indice: number; tempo: number; progresso: number; escurecer: number } {
    const t = Math.min(Math.max(tBruto, 0), this.duracao - 1e-9);
    const indice = Math.max(0, this.segmentos.findIndex((s) => t < s.fim));
    const segmento = this.segmentos[indice]!;
    const tempo = t - segmento.inicio;
    const meio = CORTE / 2;
    // Os Narradores se apresentam em sequência, sem escurecer entre eles.
    const emSequencia = (i: number) => this.segmentos[i]?.cena.visual && 'cartela' in this.segmentos[i]!.cena.visual && ['NARRADORES', 'NARRADOR'].includes((this.segmentos[i]!.cena.visual as { cartela: string }).cartela);
    const juntaAntes = indice > 0 && emSequencia(indice) && emSequencia(indice - 1);
    const juntaDepois = emSequencia(indice) && emSequencia(indice + 1);
    const entrada = indice === 0 || juntaAntes ? 1 : Math.min(1, tempo / meio);
    const saida = indice === this.segmentos.length - 1 || juntaDepois ? 1 : Math.min(1, (segmento.fim - t) / meio);
    return { segmento, indice, tempo, progresso: tempo / (segmento.fim - segmento.inicio), escurecer: 1 - Math.min(entrada, saida) };
  }

  /** Instante de jogo de um trecho no progresso `p` (0–1): o momento principal cai em 55%. */
  static tJogo(c: ClipeDeJogo, p: number): number {
    const PIVO = 0.55;
    return p < PIVO ? c.de + (c.chave - c.de) * (p / PIVO) : c.chave + (c.ate - c.chave) * ((p - PIVO) / (1 - PIVO));
  }

  /** Sons dos trechos de jogo, já no tempo do vídeo. */
  eventos(): EventoSonoro[] {
    const out: EventoSonoro[] = [{ tipo: 'APITO_FINAL', t: 0.1 }];
    for (const s of this.segmentos) {
      if (!('clipe' in s.cena.visual)) continue;
      const c = this.dados.clipes[s.cena.visual.clipe]!;
      const dur = s.fim - s.inicio;
      for (const e of c.sons) {
        // Inverte o mapa de tJogo para achar o instante no vídeo.
        const p = e.t <= c.chave ? 0.55 * ((e.t - c.de) / Math.max(1e-6, c.chave - c.de)) : 0.55 + 0.45 * ((e.t - c.chave) / Math.max(1e-6, c.ate - c.chave));
        if (p >= 0 && p <= 1) out.push({ tipo: e.tipo, t: s.inicio + p * dur });
      }
    }
    out.push({ tipo: 'APITO_FINAL', t: this.duracao - 1.2 });
    return out;
  }
}

/** Uma fala por cena, com o Narrador dela (quando não é o do Reels). */
export function narracaoDasNovidades(roteiro: RoteiroNovidades): (Fala & { narrador: string })[] {
  const padrao = NARRADOR_DAS_NOVIDADES[roteiro.dados.reels];
  return roteiro.segmentos.map((s, i) => ({
    id: `novidades-${roteiro.dados.reels.toLowerCase()}-${i}`,
    texto: s.cena.fala,
    inicio: s.inicio + (s.cena.narrador ? 0.1 : 0.35),
    limite: s.fim,
    tom: s.cena.tom,
    segmento: i,
    parte: 'antes',
    narrador: s.cena.narrador ?? padrao,
  }));
}

// ---------------------------------------------------------------- desenho

export interface OpcoesNovidades {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
  /** Emojis das Reações (imagens), na ordem ⚽ 🔥 😱 👏. */
  emojis?: readonly CanvasImageSource[];
}

const VERDE = '#A5CF8E';
const DOURADO = '#F2C14E';
const TELA = '#F3E6C9';
const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

/** As Timelines das Partidas de exemplo, montadas uma vez por Roteiro. */
const timelines = new WeakMap<RoteiroNovidades, Timeline[]>();
function timelinesDe(r: RoteiroNovidades): Timeline[] {
  let t = timelines.get(r);
  if (!t) {
    t = r.dados.partidas.map((p) => new Timeline(p.resultado, p.escalacoes, p.torcida ? { torcida: p.torcida } : {}));
    timelines.set(r, t);
  }
  return t;
}

/**
 * Trechos com a câmera do Reels de Partida. A Arquibancada, o Clima e a Substituição ficam com o
 * campo inteiro, como no Reels: a torcida e o banco ficam nas laterais.
 */
const COM_CAMERA: ReadonlySet<ClipeId> = new Set<ClipeId>(['FALTA_CARTAO', 'PENALTI', 'BARREIRA', 'ESCANTEIO', 'CONTRA_ATAQUE', 'MARCACAO_DUPLA', 'TRAVE', 'REBOTE', 'CHUTE_DE_LONGE', 'GOL_DE_PLACA', 'PRESSAO']);

/**
 * O cartão num trecho de jogo das novidades (ADR-0074), no tempo da cena: o trecho depois do
 * momento principal faz o papel do "depois da resolução" do Reels de Partida.
 */
function momentoNoClipe(tl: Timeline, c: ClipeDeJogo, dur: number): { trecho: Segmento; momento: MomentoDoCartao } | null {
  const card = tl.cartoes.find((x) => x.t > c.chave && x.t < c.ate);
  if (!card) return null;
  const PIVO = 0.55;
  const trecho = { tipo: 'LANCE', inicio: 0, fim: dur, resolucao: dur * PIVO, jogoInicio: c.de, jogoResolucao: c.chave, jogoFim: c.ate } as Segmento;
  const k = (c.ate - c.chave) / (dur * (1 - PIVO));
  const inicio = trecho.resolucao! + (card.t - c.chave) / k;
  const fim = inicio + DURACAO_DO_CARTAO;
  if (fim > dur - 0.4) return null;
  return { trecho, momento: { inicio, fim, tJogo: card.t, cartao: card.cartao, lado: card.lado, ocupante: card.ocupante } };
}

function opcoesDoJogo(p: PartidaParaVideo, o: OpcoesNovidades) {
  return {
    times: p.resultado.times,
    nomes: p.nomes,
    ...(p.apelidos ? { apelidos: p.apelidos } : {}),
    ...(p.numeros ? { numeros: p.numeros } : {}),
    ...(p.itens ? { itens: p.itens } : {}),
    ...(p.gritos ? { gritos: p.gritos } : {}),
    ...(o.fonteDisplay ? { fonteDisplay: o.fonteDisplay } : {}),
    ...(o.fonteTexto ? { fonteTexto: o.fonteTexto } : {}),
  };
}

export function desenharQuadroNovidades(ctx: CanvasRenderingContext2D, roteiro: RoteiroNovidades, tVideo: number, o: OpcoesNovidades = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  const t = q.tempo;
  const cena = q.segmento.cena;
  const passo = Math.floor(tVideo * 4);
  ctx.imageSmoothingEnabled = false;

  const surge = (a: number, desenhar: () => void, dy = 10) => {
    if (a <= 0) return;
    pin.ctx.save();
    pin.ctx.globalAlpha *= a;
    pin.ctx.translate(0, (1 - a) * dy * pin.px);
    desenhar();
    pin.ctx.restore();
  };
  const linha = (txt: string, y: number, tam = 13, cor: string = COR.placa, largura = 230) =>
    pin.texto(txt, COLUNAS / 2, y, pin.caber(txt, largura, tam, texto, 700), texto, cor, { peso: 700 });
  /** Deslocamento vertical do conteúdo da cartela (para centralizar); o título não desce. */
  let desce = 0;
  const titulo = (txt: string, y = 34) => {
    const a = entre(t, 0, 0.35);
    y -= desce;
    pin.ctx.globalAlpha = a;
    pin.tabua(COLUNAS / 2 - 118, y - (1 - a) * 8, 236, 34);
    pin.texto(txt, COLUNAS / 2, y + 17 - (1 - a) * 8, pin.caber(txt, 216, 24, display), display, COR.amarelo, { contorno: COR.contorno });
    pin.ctx.globalAlpha = 1;
  };
  const selo = () => {
    // "Novidades da T2 · 2/4" no canto de cima das cartelas.
    const serie = serieDe(d.reels);
    const k = serie.indexOf(d.reels);
    pin.texto(`Novidades da T${temporadaDasNovidades(d.reels)}${k >= 0 ? ` · ${k + 1}/${serie.length}` : ''}`, COLUNAS / 2, 14, 10, texto, VERDE, { peso: 700 });
  };
  const corre = (k: number): Pose => ((passo + k) % 2 ? 'FRENTE_CORRE_A' : 'FRENTE_CORRE_B');
  const cartao = (x: number, y: number, cor: string, esc = 1) => {
    pin.r(x - 1, y - 1, 10 * esc + 2, 14 * esc + 2, COR.contorno);
    pin.r(x, y, 10 * esc, 14 * esc, cor);
  };
  /** Tábua com um ícone à esquerda, nome e uma linha de apoio. */
  const item = (y: number, h: number, nome: string, apoio: string, icone?: (cx: number, cy: number) => void) => {
    pin.tabua(14, y, 242, h);
    const x0 = icone ? 62 : 28;
    if (icone) icone(38, y + h / 2);
    pin.texto(nome, x0, y + h / 2 - 9, pin.caber(nome, 256 - x0 - 10, 17, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
    pin.texto(apoio, x0, y + h / 2 + 10, pin.caber(apoio, 256 - x0 - 10, 10.5, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
  };
  /** Celular: moldura escura e tela no tom do site. Devolve a área da tela. */
  const celular = (x: number, y: number, w: number, h: number) => {
    pin.placa(x, y, w, h, { fundo: '#1E1E1E', luz: '#3A3A3A', sombra: '#000000' });
    pin.r(x + 5, y + 12, w - 10, h - 22, TELA);
    pin.r(x + w / 2 - 10, y + 5, 20, 3, '#3A3A3A');
    return { x: x + 5, y: y + 12, w: w - 10, h: h - 22 };
  };
  const escudoLiga = (cx: number, cy: number, tam: number) => {
    if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, cx, cy, tam);
    else {
      pin.r(cx - tam / 2, cy - tam / 2, tam, tam, COR.madeira);
    }
  };

  // ------------------------------------------------ trecho de jogo
  if ('clipe' in cena.visual) {
    const c = d.clipes[cena.visual.clipe]!;
    const tl = timelinesDe(roteiro)[c.partida]!;
    const opcoes = opcoesDoJogo(d.partidas[c.partida]!, o);
    if (!COM_CAMERA.has(cena.visual.clipe)) desenharQuadro(ctx, tl.estado(RoteiroNovidades.tJogo(c, q.progresso)), opcoes);
    else {
      // Como no Reels de Partida (ADR-0072, ADR-0074): câmera seguindo a bola e, na falta com
      // cartão, o lance quase parado com o close no juiz e o cartão gigante.
      const dur = q.segmento.fim - q.segmento.inicio;
      const jogoEm = (tv: number) => RoteiroNovidades.tJogo(c, Math.min(1, Math.max(0, tv / dur)));
      const cartao = momentoNoClipe(tl, c, dur);
      const tJogo = cartao ? tempoComPausa(cartao.trecho, cartao.momento, t, jogoEm(t)) : jogoEm(t);
      const estado = tl.estado(tJogo);
      const camera = cameraQueSegue(tl, (dv) => jogoEm(t + dv));
      const noClose = cartao && t >= cartao.momento.inicio - 0.1 && t < cartao.momento.fim + 0.15;
      const gigante = cartao && t >= cartao.momento.inicio && t < cartao.momento.fim;
      desenharQuadro(ctx, estado, { ...opcoes, camera: noClose ? closeNoJuiz(estado, camera) : camera, ...(gigante ? { semLetreiro: true } : {}) });
      if (gigante) desenharCartaoGigante(pin, cartao.momento, (t - cartao.momento.inicio) / (cartao.momento.fim - cartao.momento.inicio), opcoes);
    }
    const leg = cena.visual.legenda;
    surge(entre(t, 0.15, 0.5), () => {
      pin.tabua(24, 446, 222, 30);
      pin.texto(leg, COLUNAS / 2, 461, pin.caber(leg, 200, 22, display), display, COR.amarelo, { contorno: COR.contorno });
    }, 8);
    escurecer(ctx, q.escurecer);
    return;
  }

  // ------------------------------------------------ cartelas
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  veu(pin, 0.84);
  selo();
  const cartela = cena.visual.cartela;
  // Centraliza na vertical o que vem embaixo do título (medido nas prévias).
  desce = DESCE[cartela] ?? 0;
  pin.ctx.save();
  pin.ctx.translate(0, desce * pin.px);
  switch (cartela) {
    case 'ABERTURA': {
      surge(entre(t, 0, 0.5), () => escudoLiga(COLUNAS / 2, 104, 92));
      surge(entre(t, 0.35, 0.8), () => pin.texto('Novidades da', COLUNAS / 2, 184, 30, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 }));
      const nomeDaTemporada = `Temporada ${temporadaDasNovidades(d.reels)}`;
      surge(entre(t, 0.55, 1.0), () => pin.texto(nomeDaTemporada, COLUNAS / 2, 222, pin.caber(nomeDaTemporada, 240, 44, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 }));
      surge(entre(t, 1.1, 1.6), () => {
        const nome = TITULO[d.reels];
        pin.tabua(30, 262, 210, 50);
        pin.texto(nome, COLUNAS / 2, 288, pin.caber(nome, 190, 32, display), display, '#FFFFFF', { contorno: COR.contorno });
      });
      surge(entre(t, 1.6, 2.0), () => {
        const serie = serieDe(d.reels);
        const k = serie.indexOf(d.reels);
        if (k >= 0) serie.forEach((r, i) => {
          const x = COLUNAS / 2 - 54 + i * 36;
          pin.r(x - 1, 335, 26, 14, COR.contorno);
          pin.r(x, 336, 24, 12, i === k ? COR.amarelo : i < k ? VERDE : '#55452F');
          pin.texto(String(i + 1), x + 12, 342, 10, display, COR.contorno);
          void r;
        });
      });
      // Um boneco de cada Posição, comemorando.
      surge(entre(t, 2.0, 2.5), () => {
        const fila: [TimeId, Posicao][] = [['ONC', 'ATA'], ['CAP', 'MEI'], ['JAC', 'ZAG'], ['TAT', 'GOL'], ['QUA', 'ATA']];
        fila.forEach(([time, pos], k) => {
          const salto = (passo + k) % 4 === 0 ? 2 : 0;
          boneco(pin, pos === 'GOL' ? 'FRENTE_PARADO' : corre(k), uniforme(time, pos, `novidade-${k}`), 22 + k * 48, 372 - salto, 2.3);
        });
      });
      break;
    }

    case 'NARRADORES':
    case 'NARRADOR': {
      titulo('Cinco Narradores');
      const ativo = cartela === 'NARRADOR' ? (cena.visual.k ?? 0) : -1;
      NARRADORES.forEach((n, k) => {
        const y = 82 + k * 64;
        const de = cartela === 'NARRADORES' ? 0.3 + k * 0.3 : 0;
        surge(cartela === 'NARRADORES' ? entre(t, de, de + 0.35) : 1, () => {
          const aceso = k === ativo;
          pin.ctx.globalAlpha *= ativo >= 0 && !aceso ? 0.45 : 1;
          pin.tabua(aceso ? 10 : 18, y, aceso ? 250 : 234, 56);
          // Microfone.
          const mx = aceso ? 34 : 40;
          pin.r(mx - 5, y + 12, 10, 16, COR.contorno);
          pin.r(mx - 4, y + 13, 8, 14, aceso ? COR.amarelo : '#9C9C9C');
          for (let g = 0; g < 3; g++) pin.r(mx - 4, y + 16 + g * 4, 8, 1, COR.contorno);
          pin.r(mx - 1, y + 29, 2, 8, COR.contorno);
          pin.r(mx - 6, y + 37, 12, 2, COR.contorno);
          pin.texto(n.nome, mx + 18, y + 20, pin.caber(n.nome, 170, 20, display), display, aceso ? COR.amarelo : COR.placa, { alinhar: 'left', contorno: COR.contorno });
          const fala = `"${n.apresentacao}"`;
          pin.texto(fala, mx + 18, y + 40, pin.caber(fala, 184 - (aceso ? 0 : 8), 10, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
          if (aceso) {
            // Ondas de som.
            for (let w = 0; w < 3; w++) {
              const on = (passo + w) % 3 !== 0;
              if (on) pin.r(238 + w * 5, y + 22 - w * 3, 2, 8 + w * 6, VERDE);
            }
          }
        });
      });
      surge(entre(t, 1.8, 2.2), () => linha('Sorteado a cada jogo', 412, 13, VERDE));
      break;
    }

    case 'CHAMADA': {
      if (d.reels === 'T3_LOJA2') {
        // A Loja nova sai no meio da Temporada: sem estreia, só o convite.
        surge(entre(t, 0, 0.5), () => escudoLiga(COLUNAS / 2, 96, 80));
        surge(entre(t, 0.3, 0.8), () => {
          pin.texto('A Loja já abriu', COLUNAS / 2, 172, pin.caber('A Loja já abriu', 240, 30, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
          pin.texto('Link na bio', COLUNAS / 2, 210, 22, display, COR.placa, { contorno: COR.contorno });
        });
        break;
      }
      const q2 = quandoEstreia(d);
      surge(entre(t, 0, 0.5), () => escudoLiga(COLUNAS / 2, 96, 80));
      surge(entre(t, 0.3, 0.8), () => {
        pin.texto('Estreia', COLUNAS / 2, 168, 30, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto(q2.escrito, COLUNAS / 2, 206, pin.caber(q2.escrito, 240, 36, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 0.9, 1.3), () => {
        pin.tabua(24, 236, 222, 64);
        if (temporadaDasNovidades(d.reels) === 3) {
          // T3: a Copa abre a Temporada, depois A e B de 8 (ADRs 0050 e 0088).
          linha('Começa com a Copa: 16 Times', 256, 14, COR.placa, 196);
          linha('Depois, Séries A e B de 8 Times', 280, 14, COR.placa, 196);
        } else {
          // T2 em Grupos (ADR-0064).
          linha('Série A · 16 Times em 2 Grupos', 256, 14, COR.placa, 196);
          linha('Um jogo por hora, das 11h às 18h', 280, 14, COR.placa, 196);
        }
      });
      const serieDaChamada = serieDe(d.reels);
      const proximo = serieDaChamada.includes(d.reels) ? serieDaChamada[serieDaChamada.indexOf(d.reels) + 1] : undefined;
      surge(entre(t, 1.6, 2.0), () => {
        if (proximo) {
          pin.tabua(34, 318, 202, 58);
          linha(`Hoje, ${HORA_DAS_NOVIDADES[proximo]}h`, 336, 13, VERDE);
          pin.texto(TITULO[proximo], COLUNAS / 2, 358, pin.caber(TITULO[proximo], 180, 24, display), display, COR.amarelo, { contorno: COR.contorno });
        } else {
          const pulso = 1 + 0.04 * Math.sin(t * 6);
          pin.texto('Link na bio!', COLUNAS / 2, 346, 34 * pulso, display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        }
      });
      surge(entre(t, 2.0, 2.4), () => {
        boneco(pin, 'FRENTE_COMEMORA', uniforme('ONC', 'ATA', 'chamada-a'), 50, 396, 2.4);
        boneco(pin, (passo % 2 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO') as Pose, uniforme('JAC', 'MEI', 'chamada-b'), 192, 396, 2.4);
      });
      break;
    }

    case 'LISTA': {
      const v = cena.visual as { titulo: string; itens: [string, string][]; rodape?: string };
      titulo(v.titulo);
      const dur = q.segmento.fim - q.segmento.inicio;
      const n = v.itens.length;
      const linhas = v.itens.map(([, apoio]) => apoio.split('\n').length);
      const alturas = linhas.map((l) => 40 + l * 16);
      const vao = 10;
      const total = alturas.reduce((a, b) => a + b, 0) + vao * (n - 1) + (v.rodape ? 34 : 0);
      // Centralizada entre o título e o pé da tela.
      let y = Math.max(80, 80 + (372 - total) / 2);
      v.itens.forEach(([nome, apoio], k) => {
        // Cada tábua entra mais ou menos quando o Narrador chega nela.
        const de = 0.3 + (k * (dur * 0.75)) / n;
        const h = alturas[k]!;
        const yy = y;
        surge(entre(t, de, de + 0.35), () => {
          pin.tabua(14, yy, 242, h);
          pin.texto(nome, 28, yy + 19, pin.caber(nome, 214, 20, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          apoio.split('\n').forEach((l, i) => pin.texto(l, 28, yy + 40 + i * 16, pin.caber(l, 214, 13, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 }));
        }, 10);
        y += h + vao;
      });
      if (v.rodape) surge(entre(t, 0.3 + dur * 0.75, 0.65 + dur * 0.75), () => linha(v.rodape!, Math.min(446, y + 14), 13, VERDE, 222));
      break;
    }
    // ------------------------------------------------ cartelas da T3
    case 'JUIZ': {
      titulo('Perfil do Juiz');
      const perfis: [string, string, string, number][] = [
        ['Rigoroso', 'Mais falta e mais cartão', '#E5482F', 0.6],
        ['Normal', 'O de sempre', COR.amarelo, 3.4],
        ['Deixa jogar', 'Menos falta, menos cartão', VERDE, 2.0],
      ];
      perfis.forEach(([nome, apoio, cor, de], k) => {
        const y = 88 + k * 82;
        surge(entre(t, de, de + 0.4), () => {
          pin.tabua(14, y, 242, 70);
          // O juiz de preto com o apito, e um cartão na cor do perfil.
          boneco(pin, 'FRENTE_APITO', { camisa: '#1E1E1E', detalhe: '#F2F2EE', calcao: '#1E1E1E', meiao: '#1E1E1E', pele: '#C68B59', cabelo: '#1C130D' }, 22, y + 9, 3.2);
          cartao(70, y + 18, cor, 1.6);
          pin.texto(nome, 104, y + 25, pin.caber(nome, 140, 22, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(apoio, 104, y + 47, pin.caber(apoio, 146, 12, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
        });
      });
      surge(entre(t, 4.4, 4.8), () => linha('Sorteado e mostrado na Escalação', 352, 13, VERDE, 226));
      break;
    }
    case 'MOEDAS': {
      titulo('Salário');
      const moeda = (cx: number, cy: number, r: number) => {
        pin.r(cx - r, cy - r, 2 * r, 2 * r, COR.contorno);
        pin.r(cx - r + 2, cy - r + 2, 2 * r - 4, 2 * r - 4, '#F2C230');
        pin.r(cx - r + 2, cy + r - 6, 2 * r - 4, 4, '#C9962A');
        pin.r(cx + r - 6, cy - r + 2, 4, 2 * r - 4, '#C9962A');
        pin.texto('$', cx - 1, cy - 1, r * 1.1, display, '#8A5A12');
      };
      surge(entre(t, 0.3, 0.8), () => {
        // A pilha de moedas pulando, uma a uma.
        for (let k = 0; k < 4; k++) {
          const pulo = (passo + k) % 4 === 0 ? 3 : 0;
          moeda(COLUNAS / 2 - 54 + k * 36, 118 - pulo, 14);
        }
      });
      surge(entre(t, 0.8, 1.3), () => {
        pin.texto('10 Moedas', COLUNAS / 2, 176, 40, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('por Rodada', COLUNAS / 2, 210, 22, display, COR.placa, { contorno: COR.contorno });
      });
      surge(entre(t, 2.2, 2.6), () => item(238, 52, 'Jogando ou não', 'Todo o Elenco, na Série A e na B', (cx, cy) => moeda(cx, cy, 11)));
      surge(entre(t, 4.4, 4.8), () => item(300, 52, 'Sem Vínculo também', 'As Moedas acumulam do mesmo jeito', (cx, cy) => {
        pin.r(cx - 7, cy - 12, 14, 24, COR.contorno);
        pin.r(cx - 6, cy - 11, 12, 20, '#8FD3FF');
      }));
      break;
    }
    case 'LOJA': {
      titulo('A Loja');
      // Quatro bonecos, um com cada Item; o último é o goleiro com a luva, e o do meio tem o dourado.
      const fila: [TimeId, Posicao, ItensEquipados, string, string][] = [
        ['ONC', 'ATA', { CHUTEIRA: 'CHUTEIRA_AZUL' }, 'Chuteira', '20'],
        ['CAP', 'MEI', { MUNHEQUEIRA: 'MUNHEQUEIRA_BRANCA' }, 'Munhequeira', '20'],
        ['JAC', 'ZAG', { FAIXA: 'FAIXA_DOURADA', CHUTEIRA: 'CHUTEIRA_DOURADA' }, 'Dourado', '100'],
        ['TAT', 'GOL', { LUVA: 'LUVA_LARANJA' }, 'Luva', '20'],
      ];
      fila.forEach(([time, pos, itens, nome, preco], k) => {
        const de = 0.5 + k * 1.1;
        const x = 10 + k * 63;
        surge(entre(t, de, de + 0.4), () => {
          const raro = preco === '100';
          pin.placa(x, 92, 58, 128, raro ? { fundo: '#5C4613', luz: '#F2C14E', sombra: COR.contorno } : { fundo: COR.madeira, luz: COR.madeiraLuz, sombra: COR.contorno });
          const pose: Pose = pos === 'GOL' ? 'FRENTE_COMEMORA' : corre(k);
          boneco(pin, pose, { ...uniforme(time, pos, `loja-${k}`), itens: coresDosItens(itens, pos === 'GOL') }, x + 5, 102, 4);
          pin.texto(nome, x + 29, 184, pin.caber(nome, 54, 14, display), display, raro ? DOURADO : COR.placa, { contorno: COR.contorno });
          pin.r(x + 13, 196, 32, 16, COR.contorno);
          pin.r(x + 14, 197, 30, 14, raro ? DOURADO : COR.amarelo);
          pin.texto(preco, x + 29, 204, 12, display, COR.contorno);
        });
      });
      surge(entre(t, 5.2, 5.6), () => {
        pin.tabua(20, 240, 230, 76);
        linha('Básico: 20 Moedas', 262, 15, COR.placa, 210);
        linha('Raro (dourado): 100 Moedas', 290, 15, DOURADO, 210);
      });
      surge(entre(t, 6.4, 6.8), () => linha('No site e no App, com Vínculo', 340, 13, VERDE, 226));
      break;
    }
    case 'PALPITE': {
      titulo('Palpite');
      const tela = celular(64, 76, 142, 236);
      surge(entre(t, 0.3, 0.8), () => {
        pin.texto('Seu Palpite', tela.x + tela.w / 2, tela.y + 20, 18, display, COR.contorno);
        desenharEscudo(pin, 'CAP', tela.x + 14, tela.y + 44, 0.9);
        desenharEscudo(pin, 'ONC', tela.x + tela.w - 44, tela.y + 44, 0.9);
        const placar = [2, 1];
        placar.forEach((n, k) => {
          const x = tela.x + 18 + k * 66;
          pin.r(x - 1, tela.y + 87, 32, 34, COR.contorno);
          pin.r(x, tela.y + 88, 30, 32, '#FFF8E6');
          pin.texto(String(n), x + 15, tela.y + 104, 24, display, COR.contorno);
        });
        pin.texto('×', tela.x + tela.w / 2, tela.y + 104, 16, display, COR.contorno);
        pin.r(tela.x + 20, tela.y + 136, tela.w - 40, 22, COR.amarelo);
        pin.texto('Palpitar', tela.x + tela.w / 2, tela.y + 147, 14, display, COR.contorno);
        pin.texto('até o Corte', tela.x + tela.w / 2, tela.y + 176, 11, texto, '#6B5640', { peso: 700 });
      });
      surge(entre(t, 4.4, 4.8), () => {
        pin.tabua(20, 326, 230, 80);
        linha('Resultado certo: 2 Moedas', 348, 15, COR.placa, 210);
        linha('Placar exato: 5 Moedas', 378, 15, COR.amarelo, 210);
      });
      break;
    }
    case 'CONQUISTAS': {
      titulo('Conquistas');
      const niveis: [string, string, string, string[], number][] = [
        ['Fácil', '5', VERDE, ['Estreia', 'Primeiro gol', 'Primeira vitória'], 2.0],
        ['Média', '10', '#8FD3FF', ['Hat-trick', 'Gol de placa', 'Muralha'], 4.4],
        ['Difícil', '20', DOURADO, ['Artilheiro de raiz', 'Veterano', 'Colecionador'], 6.8],
      ];
      niveis.forEach(([nome, valor, cor, selos, de], k) => {
        const y = 86 + k * 108;
        surge(entre(t, de, de + 0.4), () => {
          pin.tabua(14, y, 242, 96);
          pin.texto(nome, 28, y + 20, 22, display, cor, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(`+${valor} Moedas`, 242, y + 20, 15, display, COR.amarelo, { alinhar: 'right', contorno: COR.contorno });
          selos.forEach((sel, i) => {
            const yy = y + 42 + i * 17;
            pin.r(28, yy - 6, 8, 8, COR.contorno);
            pin.r(29, yy - 5, 6, 6, cor);
            pin.texto(sel, 42, yy - 1, pin.caber(sel, 200, 12, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
          });
        });
      });
      surge(entre(t, 8.4, 8.8), () => linha('Selo na página de Carreira', 412, 13, VERDE, 226));
      break;
    }
    case 'BATEDORES': {
      titulo('Batedores');
      const apelidos = ['Rafa', 'Bia', 'Duda', 'Leo', 'Malu'];
      const posicoes: Posicao[] = ['ATA', 'MEI', 'ATA', 'ZAG', 'MEI'];
      apelidos.forEach((nome, k) => {
        const de = 0.4 + k * 0.5;
        const y = 82 + k * 54;
        surge(entre(t, de, de + 0.35), () => {
          pin.tabua(30, y, 210, 46);
          pin.r(40, y + 11, 24, 24, COR.contorno);
          pin.r(41, y + 12, 22, 22, COR.amarelo);
          pin.texto(String(k + 1), 52, y + 23, 18, display, COR.contorno);
          boneco(pin, 'FRENTE_PARADO', uniforme('ONC', posicoes[k]!, `batedor-${k}`), 74, y + 5, 2.3);
          pin.texto(nome, 110, y + 23, pin.caber(nome, 120, 20, display), display, COR.placa, { alinhar: 'left', contorno: COR.contorno });
        }, 8);
      });
      surge(entre(t, 3.4, 3.8), () => linha('Com a Formação e a Postura', 372, 13, COR.placa, 226));
      surge(entre(t, 4.2, 4.6), () => linha('Só o Capitão · até o Corte', 396, 13, VERDE, 226));
      break;
    }
    case 'CORTES': {
      titulo('Penteados e barbas');
      const cortes: [string, Partial<Pick<Visual, 'corte' | 'barba'>>, string, string][] = [
        ['Longo', { corte: 'LONGO' }, '#7A4A22', '#C68B59'],
        ['Raspado', { corte: 'RASPADO' }, '#1C130D', '#E0AC7E'],
        ['Tranças', { corte: 'TRANCAS' }, '#1C130D', '#6E4426'],
        ['Topete', { corte: 'TOPETE' }, '#B98A3E', '#F3CDA8'],
        ['Bigode', { barba: 'BIGODE' }, '#1C130D', '#C68B59'],
        ['Cavanhaque', { barba: 'CAVANHAQUE' }, '#2E1D12', '#9A6238'],
        ['Barba cheia', { barba: 'CHEIA' }, '#4A2E19', '#E0AC7E'],
      ];
      cortes.forEach(([nome, estilo, cabelo, pele], k) => {
        const linha = k < 4 ? 0 : 1;
        const coluna = linha === 0 ? k : k - 4;
        const porLinha = linha === 0 ? 4 : 3;
        const x = COLUNAS / 2 - (porLinha * 62) / 2 + coluna * 62;
        const y = 82 + linha * 150;
        const de = 0.3 + k * 0.7;
        surge(entre(t, de, de + 0.4), () => {
          pin.tabua(x + 2, y, 58, 138);
          boneco(pin, linha === 0 && k % 2 ? 'COSTAS_PARADO' : 'FRENTE_PARADO', { ...uniforme('CAP', 'MEI', `corte-${k}`), cabelo, pele, ...estilo }, x + 7, y + 10, 4);
          pin.texto(nome, x + 31, y + 120, pin.caber(nome, 54, 12, display), display, COR.placa, { contorno: COR.contorno });
        });
      });
      surge(entre(t, 5.4, 5.8), () => linha('20 Moedas cada · na cor do seu cabelo', 400, 13, VERDE, 226));
      break;
    }
    case 'COMEMORACOES': {
      titulo('Comemoração de gol');
      const lista4: [string, ComemoracaoDaLoja][] = [['Aviãozinho', 'AVIAOZINHO'], ['Mortal', 'MORTAL'], ['Joelhada', 'JOELHADA'], ['Dancinha', 'DANCINHA']];
      lista4.forEach(([nome, com], k) => {
        const x = 16 + (k % 2) * 122;
        const y = 80 + Math.floor(k / 2) * 150;
        const de = 0.4 + k * 1.4;
        surge(entre(t, de, de + 0.4), () => {
          pin.placa(x, y, 116, 140, { fundo: '#5C4613', luz: '#F2C14E', sombra: COR.contorno });
          // A comemoração em loop: 1 s, mais uma pausa curta.
          const f = Math.min(1, (t % 1.4) / 1);
          const q = quadroDaComemoracao(com, f);
          const img = sprite(q.pose, { ...uniforme('ONC', 'ATA', `com-${k}`), comemoracao: com });
          const esc = 4 * pin.px;
          const c = pin.ctx;
          c.save();
          c.translate((x + 58) * pin.px, (y + 66 - q.pulo * 4) * pin.px);
          if (q.angulo) c.rotate(q.angulo);
          if (q.espelhar) c.scale(-1, 1);
          c.drawImage(img as CanvasImageSource, -6 * esc, -8 * esc, 12 * esc, 16 * esc);
          c.restore();
          pin.texto(nome, x + 58, y + 124, pin.caber(nome, 104, 16, display), display, DOURADO, { contorno: COR.contorno });
        });
      });
      surge(entre(t, 6.4, 6.8), () => linha('Item raro: 100 Moedas', 392, 15, DOURADO, 226));
      surge(entre(t, 7.2, 7.6), () => linha('No gol: Ao Vivo, Replay e Reels', 418, 13, VERDE, 226));
      break;
    }
    case 'ESTRELA': {
      titulo('Estrela de Título');
      // O escudo da Liga como exemplo (não é de nenhum Time), com a estrela em cima.
      const exemplo = (cx: number, tipo: 'ouro' | 'prata', nome: string, apoio: string) => {
        const tp = 4;
        desenharEstrelaSolta(pin.ctx as CanvasRenderingContext2D, tipo, (cx - 3.5 * tp) * pin.px, 88 * pin.px, tp * pin.px);
        escudoLiga(cx, 158, 76);
        pin.texto(nome, cx, 220, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto(apoio, cx, 240, 12, texto, COR.placa, { peso: 700 });
      };
      surge(entre(t, 0.4, 0.8), () => exemplo(74, 'ouro', 'Dourada', 'Título da Série A'));
      surge(entre(t, 1.6, 2.0), () => exemplo(196, 'prata', 'Prata', 'Título da Série B'));
      surge(entre(t, 2.6, 3.0), () => {
        pin.tabua(20, 268, 230, 92);
        linha('Uma estrela por título,', 288, 14, COR.placa, 210);
        linha('lado a lado em cima do escudo', 308, 14, COR.placa, 210);
        linha('No site, nos Reels e no Ao Vivo', 336, 13, VERDE, 210);
      });
      break;
    }
    case 'CAPITAO': {
      titulo('O Capitão');
      surge(entre(t, 0.3, 0.8), () => {
        boneco(pin, 'FRENTE_PARADO', uniforme('ONC', 'ZAG', 'capitao'), COLUNAS / 2 - 30, 84, 5);
        // Faixa de capitão no braço.
        pin.r(COLUNAS / 2 + 18, 84 + 7 * 5, 12, 9, COR.contorno);
        pin.r(COLUNAS / 2 + 19, 84 + 7 * 5 + 1, 10, 7, COR.amarelo);
        pin.texto('C', COLUNAS / 2 + 24, 84 + 7 * 5 + 5, 9, display, COR.contorno);
      });
      surge(entre(t, 1.2, 1.6), () => item(184, 52, 'Mais Partidas pelo Time', 'Quem jogou mais vezes leva a faixa', (cx, cy) => {
        pin.r(cx - 10, cy - 8, 20, 16, COR.contorno);
        pin.r(cx - 9, cy - 7, 18, 14, COR.amarelo);
        pin.texto('C', cx, cy, 14, display, COR.contorno);
      }));
      surge(entre(t, 2.6, 3.0), () => item(246, 52, 'Com Vínculo no site', 'Sem Vínculo ou suspenso, a faixa passa', (cx, cy) => {
        pin.r(cx - 7, cy - 12, 14, 24, COR.contorno);
        pin.r(cx - 6, cy - 11, 12, 20, '#8FD3FF');
      }));
      surge(entre(t, 4.0, 4.4), () => item(308, 52, 'Escolhe pelo site', 'Postura e Formação, até o Corte', (cx, cy) => {
        pin.r(cx - 9, cy - 9, 18, 18, COR.contorno);
        pin.r(cx - 8, cy - 8, 16, 16, VERDE);
        pin.r(cx - 5, cy - 1, 3, 3, COR.contorno);
        pin.r(cx - 2, cy + 1, 3, 3, COR.contorno);
        pin.r(cx + 1, cy - 2, 3, 3, COR.contorno);
        pin.r(cx + 4, cy - 5, 3, 3, COR.contorno);
      }));
      break;
    }
    case 'POSTURA': {
      titulo('Postura');
      const opcoes: [string, string, string][] = [
        ['Ofensiva', 'Ataca mais e se expõe mais', '#D9534F'],
        ['Equilibrada', 'Sem mudar nada (sem escolha, é ela)', DOURADO],
        ['Defensiva', 'Se fecha atrás e ataca menos', '#5B8FD9'],
      ];
      opcoes.forEach(([nome, apoio, cor], k) => surge(entre(t, 0.4 + k * 0.9, 0.8 + k * 0.9), () => item(86 + k * 78, 66, nome, apoio, (cx, cy) => {
        // Seta: para cima (ataca), dupla (equilíbrio), para baixo (defende).
        pin.r(cx - 12, cy - 12, 24, 24, COR.contorno);
        pin.r(cx - 11, cy - 11, 22, 22, cor);
        const dir = k === 0 ? -1 : k === 2 ? 1 : 0;
        if (dir === 0) {
          pin.r(cx - 7, cy - 4, 14, 3, COR.contorno);
          pin.r(cx - 7, cy + 2, 14, 3, COR.contorno);
        } else {
          // Ponta em cima (ataca) ou embaixo (defende).
          const ponta = dir < 0 ? cy - 8 : cy + 7;
          for (let s = 0; s < 5; s++) pin.r(cx - s, ponta - dir * s, 1 + 2 * s, 1, COR.contorno);
          pin.r(cx - 2, dir < 0 ? cy - 3 : cy - 5, 4, 8, COR.contorno);
        }
      })));
      surge(entre(t, 3.4, 3.8), () => {
        pin.r(70, 334, 130, 34, COR.contorno);
        pin.r(71, 335, 128, 32, '#2B2B2B');
        pin.texto('Em segredo', COLUNAS / 2, 351, 20, display, COR.amarelo);
      });
      surge(entre(t, 3.8, 4.2), () => linha('O rival só descobre no Apito Inicial', 392, 12, VERDE));
      break;
    }
    case 'FORMACAO': {
      titulo('Formação');
      const formacoes: [string, number[], string | null][] = [
        ['2-2-2', [2, 2, 2], null],
        ['2-3-1', [2, 3, 1], 'Tabela'],
        ['3-2-1', [3, 2, 1], 'Cobertura'],
        ['3-1-2', [3, 1, 2], 'Ligação direta'],
      ];
      formacoes.forEach(([nome, linhas, jogada], k) => {
        const x = 16 + (k % 2) * 122;
        const y = 76 + Math.floor(k / 2) * 158;
        surge(entre(t, 0.5 + k * 0.6, 0.9 + k * 0.6), () => {
          pin.tabua(x, y, 116, 150);
          // Mini campo: goleiro embaixo, ataque em cima.
          const cx = x + 58;
          pin.r(x + 10, y + 10, 96, 104, COR.contorno);
          pin.r(x + 11, y + 11, 94, 102, COR.grama);
          pin.r(x + 11, y + 61, 94, 1, COR.cal);
          pin.r(cx - 16, y + 102, 32, 11, COR.gramaFaixa);
          const ponto = (px: number, py: number, cor: string) => {
            pin.r(px - 4, py - 4, 8, 8, COR.contorno);
            pin.r(px - 3, py - 3, 6, 6, cor);
          };
          ponto(cx, y + 104, '#2B2B2B');
          const ys = [y + 86, y + 60, y + 32];
          const cores = ['#5B8FD9', VERDE, '#D9534F'];
          linhas.forEach((n, l) => {
            for (let i = 0; i < n; i++) ponto(cx + (i - (n - 1) / 2) * 26, ys[l]! + (n === 3 && i === 1 && l === 0 ? 5 : 0), cores[l]!);
          });
          pin.texto(nome, cx, y + 126, 22, display, COR.amarelo, { contorno: COR.contorno });
          pin.texto(jogada ?? 'Padrão', cx, y + 142, pin.caber(jogada ?? 'Padrão', 104, 11, texto, 700), texto, jogada ? VERDE : COR.placaSombra, { peso: 700 });
        }, 12);
      });
      surge(entre(t, 3.4, 3.8), () => linha('As vagas da Escalação seguem a Formação', 404, 12, VERDE));
      break;
    }

    // ------------------------------------------ Seu Jogador
    case 'VINCULO': {
      titulo('Vínculo');
      const s = celular(70, 82, 130, 220);
      surge(entre(t, 0.4, 0.8), () => {
        pin.texto('Seu código', s.x + s.w / 2, s.y + 26, 16, display, COR.tinta);
        pin.r(s.x + 14, s.y + 42, s.w - 28, 34, COR.contorno);
        pin.r(s.x + 15, s.y + 43, s.w - 30, 32, '#FFFFFF');
        pin.texto('7K2Q', s.x + s.w / 2, s.y + 60, 26, display, COR.tinta);
      });
      surge(entre(t, 1.4, 1.8), () => {
        pin.r(s.x + 10, s.y + 96, s.w - 20, 1, COR.placaSombra);
        pin.texto('Mande na DM', s.x + s.w / 2, s.y + 112, 13, texto, COR.tinta, { peso: 700 });
        pin.texto('da Liga', s.x + s.w / 2, s.y + 128, 13, texto, COR.tinta, { peso: 700 });
      });
      surge(entre(t, 2.6, 3.0), () => {
        pin.r(s.x + 14, s.y + 150, s.w - 28, 28, '#2E7D32');
        pin.texto('Vinculado', s.x + s.w / 2, s.y + 164, 13, texto, '#FFFFFF', { peso: 700 });
      });
      surge(entre(t, 3.2, 3.6), () => linha('Cuide do seu Jogador pelo celular', 338, 13, VERDE));
      break;
    }
    case 'APELIDO': {
      titulo('Apelido');
      surge(entre(t, 0.3, 0.8), () => {
        // O boneco com o apelido em cima, como no jogo.
        const nome = 'Bruninho';
        pin.texto(nome, COLUNAS / 2, 96, 20, texto, '#FFFFFF', { contorno: COR.contorno, peso: 700 });
        boneco(pin, corre(0), uniforme('ONC', 'ATA', 'apelido'), COLUNAS / 2 - 27, 110, 4.5);
      });
      surge(entre(t, 1.5, 1.9), () => {
        pin.tabua(20, 210, 230, 74);
        linha('"Bruninho, atacante da Onça,', 236, 13, COR.placa, 210);
        linha('arranca pela esquerda!"', 258, 13, COR.placa, 210);
      });
      surge(entre(t, 2.4, 2.8), () => linha('Em cima do boneco e na voz do Narrador', 312, 12, VERDE));
      break;
    }
    case 'CAMISA': {
      titulo('Número da camisa');
      // O boneco de costas, como no jogo, e o número escolhido no site.
      surge(entre(t, 0.3, 0.8), () => {
        boneco(pin, 'COSTAS_PARADO', { ...uniforme('ONC', 'ATA', 'apelido'), numero: 10 }, COLUNAS / 2 - 36, 72, 6);
      });
      surge(entre(t, 1.4, 1.8), () => {
        pin.tabua(30, 186, 210, 54);
        linha('De 1 a 99', 205, 16, COR.amarelo, 190);
        linha('Sem repetir no seu Time', 225, 12, COR.placa, 190);
      });
      surge(entre(t, 2.6, 3.0), () => linha('Nas costas do seu Jogador', 268, 13, VERDE));
      surge(entre(t, 3.2, 3.6), () => linha('No Reels, no Ao Vivo e no Replay', 288, 12, COR.placa));
      break;
    }
    case 'ESPECIALIZACAO': {
      titulo('Especialização');
      const pos: [Posicao, string][] = [['ATA', 'Atacante'], ['MEI', 'Meia'], ['ZAG', 'Zagueiro'], ['GOL', 'Goleiro']];
      pos.forEach(([p, nome], k) => {
        const y = 78 + k * 80;
        surge(entre(t, 0.4 + k * 0.6, 0.8 + k * 0.6), () => {
          pin.tabua(14, y, 242, 74);
          boneco(pin, 'FRENTE_PARADO', uniforme('CAP', p, `esp-${k}`), 22, y + 14, 2.8);
          pin.texto(nome, 66, y + 15, 16, display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          (ESPECIALIZACOES[p] as readonly string[]).forEach((e, i) => {
            const nomeE = NOME_DA_ESPECIALIZACAO[e as keyof typeof NOME_DA_ESPECIALIZACAO];
            pin.texto(`· ${nomeE}`, 66, y + 33 + i * 13, 11.5, texto, COR.placa, { alinhar: 'left', peso: 700 });
          });
        }, 12);
      });
      surge(entre(t, 3.4, 3.8), () => linha('Melhora uma coisa, piora outra', 412, 13, VERDE));
      break;
    }
    case 'TREINO': {
      titulo('Treino');
      const habs: [string, number, boolean][] = [[NOME_DA_HABILIDADE.FIN, 62, true], [NOME_DA_HABILIDADE.DRI, 55, false], [NOME_DA_HABILIDADE.PAS, 48, false]];
      habs.forEach(([nome, base, foco], k) => {
        const y = 96 + k * 64;
        surge(entre(t, 0.3 + k * 0.3, 0.7 + k * 0.3), () => {
          pin.tabua(14, y, 242, 54);
          pin.texto(nome, 28, y + 18, 16, display, foco ? COR.amarelo : COR.placa, { alinhar: 'left', contorno: COR.contorno });
          const sobe = foco ? 14 * entre(t, 1.6, 3.6) : 4 * entre(t, 1.6, 3.6);
          const v = Math.round(base + sobe);
          const w = 200;
          pin.r(27, y + 33, w + 2, 9, COR.contorno);
          pin.r(28, y + 34, w, 7, COR.placaSombra);
          pin.r(28, y + 34, Math.round((w * v) / 100), 7, foco ? VERDE : '#C9A46A');
          pin.texto(String(v), 238, y + 38, 13, display, '#FFFFFF', { contorno: COR.contorno });
          if (foco) {
            pin.r(204, y + 10, 40, 14, COR.amarelo);
            pin.texto('FOCO', 224, y + 17, 13, display, COR.contorno);
          }
        }, 10);
      });
      surge(entre(t, 2.4, 2.8), () => linha('O foco sobe mais rápido', 316, 14, VERDE));
      break;
    }
    case 'PRESENCA': {
      titulo('Presença');
      surge(entre(t, 0.3, 0.7), () => {
        // Comentário no post.
        pin.r(20, 88, 230, 50, COR.contorno);
        pin.r(21, 89, 228, 48, '#FFFFFF');
        pin.r(30, 99, 26, 26, '#C9A46A');
        pin.texto('seu_jogador', 64, 104, 11, texto, '#6B6B6B', { alinhar: 'left', peso: 700 });
        pin.texto('CONFIRMO', 64, 123, 18, display, COR.tinta, { alinhar: 'left' });
      });
      surge(entre(t, 1.4, 1.8), () => linha('ou "Confirmar presença" no site', 158, 12, COR.placa));
      // A fila do rodízio: o boneco que confirmou passa na frente.
      surge(entre(t, 2.2, 2.6), () => {
        pin.tabua(14, 184, 242, 128);
        linha('Rodízio da Escalação', 202, 13, COR.amarelo);
        const f = entre(t, 3.0, 4.2);
        for (let k = 0; k < 5; k++) {
          const eu = k === 4;
          const pos = eu ? 4 - 3 * f : k >= 1 ? k + (k >= 1 ? f : 0) : k;
          const x = 34 + pos * 42;
          boneco(pin, eu ? corre(0) : 'FRENTE_PARADO', uniforme('JAC', 'MEI', eu ? 'presenca-eu' : `presenca-${k}`), x, 230, 2.6);
          if (eu) {
            pin.r(x + 6, 220, 20, 8, '#2E7D32');
            for (let c = 0; c < 3; c++) pin.r(x + 11 + c, 223 + c, 1, 1, '#FFFFFF');
            for (let c = 0; c < 5; c++) pin.r(x + 14 + c, 225 - c, 1, 1, '#FFFFFF');
          }
        }
        linha('Logo depois do Craque', 296, 11, VERDE);
      });
      break;
    }
    case 'RESENHA': {
      titulo('Resenha');
      surge(entre(t, 0.3, 0.7), () => {
        pin.r(20, 88, 230, 50, COR.contorno);
        pin.r(21, 89, 228, 48, '#FFFFFF');
        pin.r(30, 99, 26, 26, '#C9A46A');
        pin.texto('seu_jogador', 64, 104, 11, texto, '#6B6B6B', { alinhar: 'left', peso: 700 });
        pin.texto('Semana que vem tem mais!', 64, 123, pin.caber('Semana que vem tem mais!', 176, 13, texto, 700), texto, COR.tinta, { alinhar: 'left', peso: 700 });
      });
      surge(entre(t, 1.0, 1.4), () => linha('no Reels do último jogo do seu Time', 158, 12, COR.placa));
      surge(entre(t, 2.0, 2.4), () => item(184, 60, 'Habilidades 50% mais rápido', 'na próxima Partida em que jogar', (cx, cy) => {
        for (let s = 0; s < 6; s++) pin.r(cx - s, cy - 8 + s, 1 + 2 * s, 1, VERDE);
        pin.r(cx - 3, cy - 2, 6, 10, VERDE);
      }));
      surge(entre(t, 3.6, 4.0), () => item(254, 60, 'No Clássico, passa na frente', 'no rodízio, junto com a Presença', (cx, cy) => {
        pin.r(cx - 10, cy - 8, 20, 16, COR.contorno);
        pin.r(cx - 9, cy - 7, 18, 14, '#D9534F');
        pin.texto('×', cx, cy, 14, display, '#FFFFFF');
      }));
      break;
    }
    case 'SELECAO': {
      titulo('Seleção da Rodada');
      const sel: [Posicao, string, string, TimeId, string][] = [
        ['GOL', 'Muralha', 'Goleiro', 'TAT', '8,9'],
        ['ZAG', 'Carrapato', 'Zagueiro', 'CAP', '8,4'],
        ['MEI', 'Garçom', 'Meia', 'JAC', '9,1'],
        ['ATA', 'Matador', 'Atacante', 'ONC', '9,6'],
      ];
      sel.forEach(([p, nome, posicao, time, nota], k) => {
        const y = 80 + k * 74;
        surge(entre(t, 0.4 + k * 0.6, 0.8 + k * 0.6), () => {
          pin.tabua(14, y, 242, 66);
          boneco(pin, 'FRENTE_COMEMORA', uniforme(time, p, `sel-${k}`), 24, y + 10, 2.7);
          pin.texto(nome, 64, y + 24, 22, display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(posicao, 64, y + 46, 12, texto, COR.placa, { alinhar: 'left', peso: 700 });
          desenharEscudo(pin, time, 168, y + 21, 1);
          pin.r(198, y + 20, 46, 26, COR.contorno);
          pin.texto(nota, 221, y + 33, 20, display, '#FFFFFF');
        }, 12);
      });
      surge(entre(t, 3.2, 3.6), () => linha('Maior Nota da Posição: troféu', 392, 13, VERDE));
      break;
    }

    // ------------------------------------------ Site e App
    case 'APP': {
      titulo('O App');
      const s = celular(60, 80, 150, 270);
      // Tela inicial do celular, com o ícone do Varzeão aparecendo.
      pin.r(s.x, s.y, s.w, s.h, '#2E4A6B');
      const icones = ['#E57373', '#81C784', '#64B5F6', '#FFD54F', '#BA68C8', '#4DB6AC', '#FF8A65'];
      for (let k = 0; k < 8; k++) {
        const x = s.x + 12 + (k % 4) * 34;
        const y = s.y + 14 + Math.floor(k / 4) * 44;
        if (k === 5) {
          surge(entre(t, 1.0, 1.5), () => {
            const pulso = 1 + 0.08 * Math.sin(t * 6) * entre(t, 1.5, 2);
            escudoLiga(x + 12, y + 12, 24 * pulso);
            pin.texto('Varzeão', x + 12, y + 32, 8, texto, '#FFFFFF', { peso: 700 });
          }, 0);
        } else {
          pin.r(x, y, 24, 24, icones[k % icones.length]!);
        }
      }
      surge(entre(t, 2.0, 2.4), () => {
        pin.tabua(20, 362, 230, 60);
        linha('Ícone na tela inicial e tela cheia', 380, 12);
        linha('É o mesmo site, sem loja', 402, 12, VERDE);
      });
      break;
    }
    case 'AVISOS': {
      titulo('Avisos');
      const s = celular(18, 74, 234, 330);
      pin.r(s.x, s.y, s.w, s.h, '#2E4A6B');
      pin.texto('15:58', s.x + s.w / 2, s.y + 24, 26, display, '#FFFFFF');
      const avisos: [string, string, number][] = [
        ['Saiu a Escalação', 'Onça × Jacaré, às 16h.', 0.6],
        ['Daqui a 5 min: Onça × Jacaré', 'Abra o App e veja o Ao Vivo.', 1.6],
        ['GOL da Onça!', 'Onça 1 × 0 Jacaré', 2.6],
        ['Fim de jogo', 'Onça 2 × 1 Jacaré', 3.6],
      ];
      avisos.forEach(([tit, sub, de], k) => {
        surge(entre(t, de, de + 0.35), () => {
          const y = s.y + 46 + k * 64;
          pin.r(s.x + 5, y, s.w - 10, 58, 'rgba(255,255,255,0.94)');
          escudoLiga(s.x + 22, y + 29, 24);
          pin.texto(tit, s.x + 40, y + 20, pin.caber(tit, s.w - 50, 15, texto, 700), texto, COR.tinta, { alinhar: 'left', peso: 700 });
          pin.texto(sub, s.x + 40, y + 40, pin.caber(sub, s.w - 50, 12.5, texto, 600), texto, '#444444', { alinhar: 'left', peso: 600 });
        }, -10);
      });
      surge(entre(t, 4.4, 4.8), () => linha('Você escolhe os Times', 424, 15, VERDE));
      break;
    }
    case 'AO_VIVO': {
      titulo('Ao Vivo');
      const s = celular(45, 74, 180, 320);
      // O jogo de verdade, numa Partida de exemplo, dentro do celular.
      const tl = timelinesDe(roteiro)[0];
      if (tl && typeof OffscreenCanvas !== 'undefined') {
        const off = new OffscreenCanvas(COLUNAS * 2, LINHAS * 2);
        const octx = off.getContext('2d')!;
        desenharQuadro(octx as unknown as CanvasRenderingContext2D, tl.estado(30 * 60 + t * 20), opcoesDoJogo(d.partidas[0]!, o));
        const h = (s.w * LINHAS) / COLUNAS;
        pin.ctx.save();
        pin.ctx.beginPath();
        pin.ctx.rect(s.x * pin.px, s.y * pin.px, s.w * pin.px, s.h * pin.px);
        pin.ctx.clip();
        pin.ctx.imageSmoothingEnabled = true;
        pin.ctx.drawImage(off, s.x * pin.px, (s.y + 18) * pin.px, s.w * pin.px, h * pin.px);
        pin.ctx.restore();
        pin.ctx.imageSmoothingEnabled = false;
      }
      // Faixa do Público.
      pin.r(s.x, s.y, s.w, 18, '#1E1E1E');
      pin.r(s.x + 8, s.y + 6, 6, 6, '#E53935');
      const publico = Math.round(37 + 12 * entre(t, 0.5, 4));
      pin.texto(`AO VIVO · ${publico} assistindo`, s.x + 20, s.y + 9, 12, texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
      // Reações subindo.
      const emojis = o.emojis ?? [];
      for (let k = 0; k < 14; k++) {
        const nasce = 1.0 + k * 0.32;
        const vida = t - nasce;
        if (vida < 0 || vida > 2.2) continue;
        const img = emojis[k % Math.max(1, emojis.length)];
        const x = s.x + 20 + ((k * 53) % (s.w - 40));
        const y = s.y + s.h - 20 - vida * 90;
        pin.ctx.globalAlpha = Math.min(1, (2.2 - vida) / 0.5);
        if (img) {
          pin.ctx.imageSmoothingEnabled = true;
          pin.ctx.drawImage(img, (x - 9) * pin.px, (y - 9) * pin.px, 18 * pin.px, 18 * pin.px);
          pin.ctx.imageSmoothingEnabled = false;
        } else pin.r(x - 6, y - 6, 12, 12, COR.amarelo);
        pin.ctx.globalAlpha = 1;
      }
      surge(entre(t, 2.4, 2.8), () => {
        pin.tabua(20, 402, 230, 50);
        linha('Público e Reações', 418, 14, COR.amarelo);
        const nomes = ['Gol', 'Fogo', 'Susto', 'Palmas'];
        nomes.forEach((n, k) => {
          const x = 28 + k * 53;
          const img = emojis[k];
          if (img) {
            pin.ctx.imageSmoothingEnabled = true;
            pin.ctx.drawImage(img, x * pin.px, 431 * pin.px, 12 * pin.px, 12 * pin.px);
            pin.ctx.imageSmoothingEnabled = false;
          }
          pin.texto(n, x + 15, 438, 10, texto, COR.placa, { alinhar: 'left', peso: 700 });
        });
      });
      break;
    }
    case 'CARREIRA': {
      titulo('Carreira');
      const s = celular(18, 72, 234, 352);
      surge(entre(t, 0.3, 0.7), () => {
        boneco(pin, 'FRENTE_PARADO', uniforme('ONC', 'ATA', 'carreira'), s.x + 10, s.y + 8, 3.2);
        pin.texto('Bruninho', s.x + 56, s.y + 22, 22, display, COR.tinta, { alinhar: 'left' });
        pin.texto('Atacante · Onça', s.x + 56, s.y + 42, 13, texto, '#6B5A3E', { alinhar: 'left', peso: 700 });
      });
      const temporadas: [string, string, string, boolean][] = [
        ['Temporada 2', 'Onça · Série A · 3 jogos · 2 gols', 'OVR 68 → 70', false],
        ['Temporada 1', 'Onça · 7 jogos · 5 gols · 2 assist.', 'OVR 64 → 68', true],
      ];
      temporadas.forEach(([nome, linha1, ovr, selo], k) => {
        surge(entre(t, 1.2 + k * 0.9, 1.6 + k * 0.9), () => {
          const y = s.y + 64 + k * 82;
          pin.r(s.x + 6, y, s.w - 12, 74, '#FFFFFF');
          pin.r(s.x + 6, y, 4, 74, COR.amarelo);
          pin.texto(nome, s.x + 18, y + 15, 18, display, COR.tinta, { alinhar: 'left' });
          pin.texto(linha1, s.x + 18, y + 36, pin.caber(linha1, s.w - 34, 12, texto, 700), texto, '#333333', { alinhar: 'left', peso: 700 });
          pin.texto(ovr, s.x + 18, y + 57, 12.5, texto, '#2E7D32', { alinhar: 'left', peso: 700 });
          if (selo) {
            pin.placa(s.x + s.w - 84, y + 46, 70, 22, { fundo: '#5B3A1E', luz: DOURADO, sombra: '#3A2410', degrau: 2 });
            pin.texto('Selo T1', s.x + s.w - 49, y + 57, 12, texto, DOURADO, { peso: 700 });
          }
        }, 8);
      });
      surge(entre(t, 3.2, 3.6), () => {
        const y = s.y + 238;
        pin.texto('Troféus', s.x + 12, y, 18, display, COR.tinta, { alinhar: 'left' });
        const trofeus = ['Matador', 'Craque da Rodada', 'Rei do Clássico'];
        const larg = [54, 88, 72];
        let x = s.x + 4;
        trofeus.forEach((tr, k) => {
          pin.r(x, y + 14, larg[k]!, 26, COR.contorno);
          pin.r(x + 1, y + 15, larg[k]! - 2, 24, DOURADO);
          pin.texto(tr, x + larg[k]! / 2, y + 27, pin.caber(tr, larg[k]! - 6, 11, texto, 700), texto, COR.contorno, { peso: 700 });
          x += larg[k]! + 3;
        });
      });
      surge(entre(t, 4.2, 4.6), () => linha('Temporada por Temporada', 440, 15, VERDE));
      break;
    }
  }
  pin.ctx.restore();
  escurecer(ctx, q.escurecer);
}

/** Quanto o conteúdo de cada cartela desce para ficar no meio da tela (a LISTA se centraliza sozinha). */
const DESCE: Partial<Record<string, number>> = {
  CAPITAO: 34, POSTURA: 22, FORMACAO: 16, NARRADORES: 14, NARRADOR: 14,
  VINCULO: 44, APELIDO: 52, ESPECIALIZACAO: 14, TREINO: 58, PRESENCA: 58, RESENHA: 56, SELECAO: 24,
  APP: 14, ESTRELA: 40,
};

function escurecer(ctx: CanvasRenderingContext2D, alfa: number): void {
  if (alfa <= 0) return;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
