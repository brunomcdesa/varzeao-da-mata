/**
 * A Liga rodando no seu computador, sem Instagram e sem servidor.
 *
 *   pnpm liga temporada [--inicio 2026-11-07]        cria a Temporada (7 Rodadas, 12h/14h/16h/18h)
 *   pnpm liga inscricoes-de-teste [--quantidade 40]  "comentários" ENTRO de seguidores fictícios
 *   pnpm liga comentar --de rafa "ENTRO CAPIVARA ATA"
 *   pnpm liga jogar [--rodada N] [--sem-video]       roda as Partidas da próxima Rodada (e grava os Reels)
 *   pnpm liga resumo [--rodada N] [--previa pasta]   grava o Reels do Resumo da Rodada
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
  criarTemporada,
  dadosDoResumo,
  fecharRodada,
  processarComentario,
  rodarPartida,
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

/** Rodada com Candidatos cuja Rodada seguinte ainda não começou: é a que está em votação. */
async function rodadaEmVotacao(b: Banco): Promise<number | null> {
  const r = (
    await b.query<{ id: number }>(
      `SELECT r.id FROM rodada r
       WHERE EXISTS (SELECT 1 FROM candidato c WHERE c.rodada_id = r.id)
         AND NOT EXISTS (SELECT 1 FROM rodada s JOIN partida p ON p.rodada_id = s.id
                         WHERE s.temporada_id = r.temporada_id AND s.numero = r.numero + 1 AND p.status <> 'PENDENTE')
       ORDER BY r.numero DESC LIMIT 1`,
    )
  ).rows[0];
  return r?.id ?? null;
}

/** Craque da Rodada: o Candidato mais votado (empate: maior Nota). */
async function craqueDaRodada(b: Banco, rodadaId: number): Promise<{ id: string; username: string } | null> {
  const r = (
    await b.query<{ id: string; username: string }>(
      `SELECT j.id::text AS id, j.username FROM candidato c JOIN jogador j ON j.id = c.jogador_id
       LEFT JOIN voto v ON v.rodada_id = c.rodada_id AND v.jogador_id = c.jogador_id
       WHERE c.rodada_id = $1 GROUP BY j.id, c.nota ORDER BY count(v.ig_user_id) DESC, c.nota DESC, j.id LIMIT 1`,
      [rodadaId],
    )
  ).rows[0];
  return r ?? null;
}

async function main(): Promise<void> {
  const banco = process.env.DATABASE_URL ? conectar() : await bancoLocal(join(raizRepo, '.cache/liga-local'));
  try {
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
        console.log('Comandos: temporada, inscricoes-de-teste, comentar, jogar, resumo, tabela, elencos, status (veja o topo de scripts/liga.ts)');
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
