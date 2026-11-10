/**
 * A Liga rodando no seu computador, sem Instagram e sem servidor.
 *
 *   pnpm liga temporada [--inicio 2026-11-07]        cria a Temporada (7 Rodadas, 12h/14h/16h/18h)
 *   USUARIO=fulano pnpm liga remover               remove um Jogador que ainda não jogou
 *   USUARIO=fulano TIME=onca POSICAO=zagueiro pnpm liga mover   muda o Time à mão (ADR-0029)
 *   pnpm liga comentarios                          os comentários lidos e o resultado de cada um
 *   pnpm liga mudar-inicio --inicio 2026-11-08      antecipa/adia a Temporada (antes do 1º jogo)
 *   pnpm liga inscricoes-de-teste [--quantidade 40]  "comentários" ENTRO de seguidores fictícios
 *   pnpm liga comentar --de rafa "ENTRO CAPIVARA ATA"
 *   pnpm liga jogar [--rodada N] [--sem-video]       roda as Partidas da próxima Rodada (e grava os Reels)
 *   pnpm liga resumo [--rodada N] [--previa pasta]   grava o Reels do Resumo da Rodada
 *   pnpm liga site [--agora 2026-11-07T21:00:00Z]    exporta os JSON do site (packages/site/public/dados)
 *   pnpm liga tabela | elencos | status
 *
 * O banco fica em .cache/liga-local (PGlite). Com DATABASE_URL definida, usa esse Postgres.
 * Os vídeos vão para ~/varzeao-videos (mude com --pasta). Chaves de voz vêm do .env da raiz.
 */
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { FALA_DO_TIME, IDENTIDADE, TIMES, type Posicao, type TimeId } from '@liga/shared';
import { criarRng } from '@liga/sim';
import {
  conectar,
  prepararBanco,
  criarTemporada,
  dadosDoResumo,
  escreverSite,
  exportarSite,
  craqueDaRodada,
  fecharRodada,
  processarComentario,
  moverJogador,
  interpretar,
  rodadaEmVotacao,
  rodarPartida,
  tokenGuardado,
  Instagram,
  tabela,
  type Banco,
  type DadosDoVideo,
} from '../src/index.js';
import { bancoLocal } from './banco-local.js';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(join(raizRepo, '.env'));
} catch {
  /* sem .env */
}

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    inicio: { type: 'string' },
    seed: { type: 'string' },
    quantidade: { type: 'string', default: '40' },
    de: { type: 'string' },
    rodada: { type: 'string' },
    'sem-video': { type: 'boolean', default: false },
    pasta: { type: 'string', default: join(homedir(), 'varzeao-videos') },
    previa: { type: 'string' },
    agora: { type: 'string' },
  },
});
const [comando, ...resto] = positionals;

const hojeEmBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const amanha = () => new Date(Date.now() - 3 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10);
const nomeCurto = (t: TimeId) => FALA_DO_TIME[t].curto;

async function temporadaAtual(b: Banco): Promise<{ id: number; numero: number; inicio: string }> {
  const t = (await b.query<{ id: number; numero: number; inicio: string | Date }>(`SELECT id, numero, inicio FROM temporada ORDER BY numero DESC LIMIT 1`)).rows[0];
  if (!t) throw new Error('Nenhuma Temporada. Rode: pnpm liga temporada');
  return { id: t.id, numero: t.numero, inicio: new Date(t.inicio).toISOString().slice(0, 10) };
}

async function main(): Promise<void> {
  const banco = process.env.DATABASE_URL ? conectar() : await bancoLocal(join(raizRepo, '.cache/liga-local'));
  try {
    if (process.env.DATABASE_URL) await prepararBanco(banco); // cria as tabelas no banco de produção
    switch (comando) {
      case 'temporada': {
        const numero = ((await banco.query<{ n: number | null }>(`SELECT max(numero) AS n FROM temporada`)).rows[0]!.n ?? 0) + 1;
        const inicio = args.inicio ?? amanha();
        const seed = args.seed ? Number(args.seed) : Math.floor(Math.random() * 2 ** 31);
        await criarTemporada(banco, { numero, primeiraRodada: inicio, seed });
        console.log(`Temporada ${numero} criada: 7 Rodadas a partir de ${inicio}.`);
        await mostrarCalendario(banco);
        break;
      }

      case 'mudar-inicio': {
        // Antecipa ou adia a Temporada atual enquanto nenhum jogo saiu do lugar.
        const t = await temporadaAtual(banco);
        if (!args.inicio || !/^\d{4}-\d{2}-\d{2}$/.test(args.inicio)) throw new Error('Use: pnpm liga mudar-inicio --inicio AAAA-MM-DD');
        const andou = (await banco.query<{ n: string }>(
          `SELECT count(*) AS n FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.status <> 'PENDENTE'`, [t.id],
        )).rows[0]!.n;
        if (Number(andou) > 0) throw new Error('A Temporada já tem jogos escalados ou jogados; não dá para mudar o início.');
        const dias = Math.round((Date.parse(`${args.inicio}T12:00:00Z`) - Date.parse(`${t.inicio}T12:00:00Z`)) / 86400_000);
        await banco.transacao(async (b) => {
          await b.query(`UPDATE temporada SET inicio = $2 WHERE id = $1`, [t.id, args.inicio]);
          await b.query(`UPDATE rodada SET data = data + $2::int WHERE temporada_id = $1`, [t.id, dias]);
          await b.query(`UPDATE partida p SET apito_inicial = p.apito_inicial + make_interval(days => $2::int) FROM rodada r WHERE r.id = p.rodada_id AND r.temporada_id = $1`, [t.id, dias]);
        });
        console.log(`Temporada ${t.numero}: início de ${t.inicio} para ${args.inicio} (${dias > 0 ? '+' : ''}${dias} dias).`);
        await mostrarCalendario(banco);
        break;
      }

      case 'inscricoes-de-teste': {
        const t = await temporadaAtual(banco);
        const rng = criarRng(Date.now() >>> 0);
        const NOMES = ['rafa', 'bia', 'duda', 'leo', 'malu', 'gui', 'nanda', 'pedrinho', 'lari', 'thiago', 'carol', 'vini', 'ju', 'digo', 'manu', 'caio', 'lu', 'beto', 'dani', 'gabi', 'joao', 'ana', 'enzo', 'lara', 'davi', 'mel', 'theo', 'iris', 'noah', 'cris'];
        const FRASES = ['ENTRO {T} {P}', 'entro na {t} de {p}', 'Entro {t} {p} 🔥', 'entro pro {t} como {p}', 'ENTRO {P} {T}!!'];
        const POS: [Posicao, string][] = [['GOL', 'goleiro'], ['ZAG', 'zagueiro'], ['ZAG', 'zaga'], ['MEI', 'meia'], ['MEI', 'volante'], ['ATA', 'atacante'], ['ATA', 'centroavante']];
        // Comentados na Pré-temporada, antes do Corte da primeira Partida.
        const quando = new Date(`${t.inicio}T00:00:00-03:00`).getTime() - 12 * 3600_000;
        const contagem: Record<string, number> = {};
        for (let i = 0; i < Number(args.quantidade); i++) {
          const nome = `${rng.pick(NOMES)}${rng.pick(['_', '.', ''])}${rng.pick([String(rng.int(99)), rng.pick(['fc', 'oficial', 'jr', 'mata'])])}`;
          const time = rng.pick([...TIMES]);
          const [, p] = rng.pick(POS);
          const texto = rng
            .pick(FRASES)
            .replace('{T}', nomeCurto(time).toUpperCase())
            .replace('{t}', nomeCurto(time))
            .replace('{P}', p.toUpperCase())
            .replace('{p}', p);
          const r = await processarComentario(
            banco,
            { igCommentId: randomUUID(), igMediaId: 'teste', igUserId: `teste-${nome}`, username: nome, texto, comentadoEm: new Date(quando + i * 60_000) },
            { rodadaEmVotacao: null },
          );
          contagem[r] = (contagem[r] ?? 0) + 1;
        }
        console.log('Resultados:', contagem);
        await mostrarElencos(banco);
        break;
      }

      case 'comentar': {
        if (!args.de || !resto.length) throw new Error('uso: pnpm liga comentar --de usuario "ENTRO CAPIVARA ATA"');
        const r = await processarComentario(
          banco,
          { igCommentId: randomUUID(), igMediaId: 'teste', igUserId: `teste-${args.de}`, username: args.de, texto: resto.join(' '), comentadoEm: new Date() },
          { rodadaEmVotacao: await rodadaEmVotacao(banco) },
        );
        console.log(r);
        break;
      }

      case 'jogar': {
        const t = await temporadaAtual(banco);
        const statusAlvo = args['sem-video'] ? 'SIMULADA' : 'RENDERIZADA';
        const rodada = (
          await banco.query<{ id: number; numero: number }>(
            args.rodada
              ? `SELECT id, numero FROM rodada WHERE temporada_id = $1 AND numero = $2`
              : `SELECT r.id, r.numero FROM rodada r WHERE r.temporada_id = $1 AND EXISTS (
                   SELECT 1 FROM partida p WHERE p.rodada_id = r.id AND p.status NOT IN ('${statusAlvo}', 'AGENDADA', 'PUBLICADA')
                     AND ('${statusAlvo}' = 'RENDERIZADA' OR p.status IN ('PENDENTE', 'ESCALADA')))
                 ORDER BY r.numero LIMIT 1`,
            args.rodada ? [t.id, Number(args.rodada)] : [t.id],
          )
        ).rows[0];
        if (!rodada) return console.log('Todas as Rodadas da Fase de Liga já foram jogadas.');

        const anterior = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE temporada_id = $1 AND numero = $2`, [t.id, rodada.numero - 1])).rows[0];
        const craque = anterior ? await craqueDaRodada(banco, anterior.id) : null;
        if (craque) console.log(`Craque da Rodada ${rodada.numero - 1}: @${craque.username} (lugar garantido)`);

        const gravador = args['sem-video'] ? null : (await import('@liga/renderer/gravacao')).gravarReels;
        const partidas = (await banco.query<{ id: number; mandante_id: TimeId; visitante_id: TimeId; apito_inicial: string | Date }>(
          `SELECT id, mandante_id, visitante_id, apito_inicial FROM partida WHERE rodada_id = $1 ORDER BY apito_inicial`,
          [rodada.id],
        )).rows;
        console.log(`\nRodada ${rodada.numero}`);
        for (const p of partidas) {
          const hora = (new Date(p.apito_inicial).getUTCHours() + 21) % 24;
          const saida = join(resolve(args.pasta!), `t${t.numero}-r${rodada.numero}-${hora}h-${p.mandante_id}x${p.visitante_id}.mp4`);
          const r = await rodarPartida(banco, p.id, {
            craque: craque?.id ?? null,
            ...(gravador ? { gravar: { gravador: (d: DadosDoVideo, s: string) => gravador(d, { saida: s }).then(() => {}), saida } } : {}),
          });
          const g = r.resultado.gols;
          console.log(
            `  ${hora}h  ${IDENTIDADE[p.mandante_id].sigla} ${g.mandante} x ${g.visitante} ${IDENTIDADE[p.visitante_id].sigla}` +
              (r.resultado.classico ? '  (Clássico)' : '') +
              (r.video ? `  → ${r.video.replace('file://', '')}` : ''),
          );
        }
        await fecharRodada(banco, rodada.id);
        console.log(`\nRodada ${rodada.numero} encerrada. Para o Resumo: pnpm liga resumo`);
        await mostrarTabela(banco, t.id);
        break;
      }

      case 'resumo': {
        const t = await temporadaAtual(banco);
        const rodada = (
          await banco.query<{ id: number; numero: number }>(
            args.rodada
              ? `SELECT id, numero FROM rodada WHERE temporada_id = $1 AND numero = $2`
              : `SELECT r.id, r.numero FROM rodada r WHERE r.temporada_id = $1 AND EXISTS (SELECT 1 FROM candidato c WHERE c.rodada_id = r.id) ORDER BY r.numero DESC LIMIT 1`,
            args.rodada ? [t.id, Number(args.rodada)] : [t.id],
          )
        ).rows[0];
        if (!rodada) throw new Error('Nenhuma Rodada encerrada ainda. Rode: pnpm liga jogar');
        await fecharRodada(banco, rodada.id);
        const dados = await dadosDoResumo(banco, rodada.id);
        const { gravarResumo } = await import('@liga/renderer/gravacao');
        const saida = join(resolve(args.pasta!), `t${t.numero}-r${rodada.numero}-resumo.mp4`);
        await gravarResumo(dados, { saida, ...(args.previa ? { previa: resolve(args.previa) } : {}) });
        break;
      }

      case 'site': {
        // --agora simula outro instante: útil localmente, onde as Partidas são jogadas antes do Apito.
        const agora = args.agora ? new Date(args.agora) : new Date();
        const pasta = join(raizRepo, 'packages/site/public/dados');
        const escritos = await escreverSite(await exportarSite(banco, agora), pasta);
        console.log(`${escritos.length} arquivos em ${pasta} (situação em ${agora.toISOString()})`);
        break;
      }

      case 'inscrever': {
        // Inscrição pedida pela DM (não por comentário): mesmas regras do ENTRO. Time cheio
        // realoca no mais vazio, na mesma posição. Sem resposta automática (é DM).
        const usuario = (process.env.USUARIO ?? '').replace(/^@/, '').trim();
        const pedido = `ENTRO ${process.env.TIME ?? ''} ${process.env.POSICAO ?? ''}`.trim();
        if (!usuario || !process.env.TIME) throw new Error('Use: USUARIO=fulano TIME=onca POSICAO=atacante pnpm liga inscrever');
        const token = (await tokenGuardado(banco))?.token ?? process.env.IG_ACCESS_TOKEN;
        const ig = process.env.IG_USER_ID && token ? new Instagram({ userId: process.env.IG_USER_ID, token }) : null;
        const id = (await ig?.idNaDm(usuario).catch(() => null)) ?? null;
        console.log(id ? `@${usuario} achado na DM (id ${id}).` : `@${usuario} não achado na DM: inscrevendo com id provisório.`);
        const r = await processarComentario(
          banco,
          { igCommentId: `dm-${randomUUID()}`, igMediaId: 'dm', igUserId: id ?? `dm-${usuario.toLowerCase()}`, username: usuario, texto: pedido, comentadoEm: new Date() },
          // FORCAR=true: escolha do dono, ignora o equilíbrio de Elencos (ADR-0029).
          { rodadaEmVotacao: null, realocar: true, forcar: process.env.FORCAR === 'true' },
        );
        const j = (await banco.query<{ time_id: string; posicao: string; ovr: number }>(`SELECT time_id, posicao, ovr FROM jogador WHERE lower(username) = lower($1)`, [usuario])).rows[0];
        console.log(`Resultado: ${r}${j ? ` → ${j.posicao} do ${j.time_id}, OVR ${j.ovr}` : ''}`);
        if (r !== 'INSCRITO' && r !== 'REALOCADO') process.exitCode = 1;
        break;
      }

      case 'mover': {
        // Muda o Time (e a posição, se vier) à mão, sem gastar a Transferência (ADR-0029).
        const usuario = (process.env.USUARIO ?? '').replace(/^@/, '').trim();
        const pedido = interpretar(`ENTRO ${process.env.TIME ?? ''} ${process.env.POSICAO ?? ''}`.trim());
        if (!usuario || pedido.tipo !== 'INSCRICAO') throw new Error('Use: USUARIO=fulano TIME=onca POSICAO=zagueiro pnpm liga mover');
        const r = await moverJogador(banco, usuario, pedido.time, pedido.posicao);
        console.log(`Movido: @${usuario} de ${r.de} para ${r.posicao} do ${r.para}, OVR ${r.ovr}.${r.perdeuCamisa ? ' A camisa já tinha dono no Time novo e foi liberada.' : ''}`);
        break;
      }

      case 'remover': {
        // Remove um Jogador que ainda não jogou (cadastro feito por engano).
        const usuario = (process.env.USUARIO ?? '').replace(/^@/, '').toLowerCase();
        if (!usuario) throw new Error('Use: USUARIO=fulano pnpm liga remover');
        const j = (await banco.query<{ id: string; username: string; time_id: string; posicao: string }>(
          `SELECT id::text AS id, username, time_id, posicao FROM jogador WHERE lower(username) = $1`, [usuario],
        )).rows[0];
        if (!j) throw new Error(`Nenhum Jogador @${usuario}.`);
        const usos = (await banco.query<{ n: string }>(
          `SELECT (SELECT count(*) FROM escalacao WHERE jogador_id = $1) + (SELECT count(*) FROM candidato WHERE jogador_id = $1) AS n`, [j.id],
        )).rows[0]!.n;
        if (Number(usos) > 0) throw new Error(`@${j.username} já foi escalado; não dá para remover sem apagar histórico.`);
        await banco.transacao(async (b) => {
          await b.query(`DELETE FROM voto WHERE jogador_id = $1`, [j.id]);
          await b.query(`DELETE FROM voto_site WHERE jogador_id = $1`, [j.id]);
          await b.query(`DELETE FROM jogador WHERE id = $1`, [j.id]);
        });
        console.log(`Removido: @${j.username} (${j.posicao} do ${j.time_id}).`);
        break;
      }

      case 'comentarios': {
        // Comentários lidos e o que o leitor fez com cada um (sem @ de quem comentou).
        // Com --usuario, só os comentários dessa pessoa (e aí mostra o @).
        const de = process.env.USUARIO?.replace(/^@/, '').toLowerCase() || null;
        const r = await banco.query<{ username: string; texto: string; tipo: string | null; resultado: string | null; comentado_em: Date }>(
          `SELECT username, texto, tipo, resultado, comentado_em FROM comando WHERE ($1::text IS NULL OR lower(username) = $1) ORDER BY comentado_em DESC LIMIT 300`,
          [de],
        );
        for (const c of r.rows) console.log(`${new Date(c.comentado_em).toISOString().slice(5, 16)}  ${(c.resultado ?? '?').padEnd(15)} ${de ? `@${c.username} ` : ''}${JSON.stringify(c.texto)}`);
        console.log(`${r.rows.length} comentário(s).`);
        break;
      }
      case 'tabela':
        await mostrarTabela(banco, (await temporadaAtual(banco)).id);
        break;
      case 'elencos':
        await mostrarElencos(banco);
        break;
      case 'status':
        await mostrarCalendario(banco);
        break;
      default:
        console.log('Comandos: temporada, inscricoes-de-teste, comentar, jogar, resumo, site, tabela, elencos, status (veja o topo de scripts/liga.ts)');
    }
  } finally {
    await banco.fechar();
  }
}

async function mostrarTabela(b: Banco, temporadaId: number): Promise<void> {
  console.log('\n   Time        P  J  V  E  D  SG');
  (await tabela(b, temporadaId)).forEach((l, i) =>
    console.log(
      `${String(i + 1).padStart(2)} ${nomeCurto(l.time).padEnd(10)} ${String(l.pontos).padStart(2)} ${String(l.jogos).padStart(2)} ${String(l.vitorias).padStart(2)} ${String(l.empates).padStart(2)} ${String(l.derrotas).padStart(2)} ${String(l.saldo).padStart(3)}`,
    ),
  );
}

async function mostrarElencos(b: Banco): Promise<void> {
  const linhas = (await b.query<{ time_id: TimeId; posicao: Posicao; n: string }>(`SELECT time_id, posicao, count(*) AS n FROM jogador WHERE NOT banido GROUP BY 1, 2`)).rows;
  console.log('\n   Time        GOL ZAG MEI ATA  total');
  for (const t of TIMES) {
    const de = (p: Posicao) => Number(linhas.find((l) => l.time_id === t && l.posicao === p)?.n ?? 0);
    const total = (['GOL', 'ZAG', 'MEI', 'ATA'] as const).reduce((s, p) => s + de(p), 0);
    console.log(`   ${nomeCurto(t).padEnd(10)} ${String(de('GOL')).padStart(3)} ${String(de('ZAG')).padStart(3)} ${String(de('MEI')).padStart(3)} ${String(de('ATA')).padStart(3)}  ${String(total).padStart(5)}`);
  }
}

async function mostrarCalendario(b: Banco): Promise<void> {
  const t = await temporadaAtual(b);
  const linhas = (
    await b.query<{ numero: number; data: string | Date; mandante_id: TimeId; visitante_id: TimeId; apito_inicial: string | Date; status: string; gols_mandante: number | null; gols_visitante: number | null }>(
      `SELECT r.numero, r.data, p.mandante_id, p.visitante_id, p.apito_inicial, p.status, p.gols_mandante, p.gols_visitante
       FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 ORDER BY p.apito_inicial`,
      [t.id],
    )
  ).rows;
  let atual = -1;
  for (const l of linhas) {
    if (l.numero !== atual) {
      atual = l.numero;
      console.log(`\nRodada ${l.numero} (${new Date(l.data).toISOString().slice(0, 10)})`);
    }
    const hora = (new Date(l.apito_inicial).getUTCHours() + 21) % 24;
    const placar = l.gols_mandante === null ? 'x' : `${l.gols_mandante} x ${l.gols_visitante}`;
    console.log(`  ${hora}h  ${nomeCurto(l.mandante_id).padStart(9)} ${placar.padEnd(5)} ${nomeCurto(l.visitante_id).padEnd(9)}  ${l.status}`);
  }
  console.log(`\n(hoje é ${hojeEmBrasilia()})`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
