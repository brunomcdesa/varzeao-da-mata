/**
 * Ponto de entrada dos jobs no GitHub Actions (e para testar na mão):
 *
 *   pnpm job coletar
 *   pnpm job partida [--sem-esperar]
 *   pnpm job resumo
 *   pnpm job boas-vindas [--enviar]   responde quem entrou antes das respostas automáticas
 *
 * Precisa de DATABASE_URL, do Instagram (IG_USER_ID, IG_ACCESS_TOKEN) e do Cloudflare
 * (veja .env.example). Sem Cloudflare, grava em .cache/nuvem-local; sem Instagram, não agenda.
 */
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgendaNaMemoria, dadosDoAgradecimentoT1, dadosDoAgradecimentoT2, dadosDoRebalanceamentoT2, dadosDoPerfilDoTime, estrelasNoBanco, Instagram, PastaLocal, conectar, jobBoasVindas, jobColetar, jobEscalar, postsDeInscricao, jobPartida, jobProgramados, jobResumo, nuvemDoAmbiente, prepararBanco, tokenGuardado, type ContextoDoJob } from '../src/index.js';
import { bancoLocal } from './banco-local.js';
import { REELS_PROGRAMADOS } from '@liga/shared';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(join(raizRepo, '.env'));
} catch {
  /* no Actions as variáveis vêm dos segredos */
}

const [qual, ...flags] = process.argv.slice(2);
if (!['coletar', 'escalar', 'partida', 'resumo', 'programados', 'boas-vindas', 'procurar', 'mensagens'].includes(qual ?? '')) {
  console.log('Uso: pnpm job coletar | partida [--sem-esperar] | resumo | programados | boas-vindas [--enviar]');
  process.exit(1);
}

const banco = process.env.DATABASE_URL ? conectar() : await bancoLocal(join(raizRepo, '.cache/liga-local'));
try {
  await prepararBanco(banco);
  const nuvem = nuvemDoAmbiente();
  if (!nuvem) console.log('Cloudflare não configurado: gravando em .cache/nuvem-local.');
  const token = (await tokenGuardado(banco))?.token ?? process.env.IG_ACCESS_TOKEN;
  const ig = process.env.IG_USER_ID && token ? new Instagram({ userId: process.env.IG_USER_ID, token, ...(process.env.IG_APP_ID ? { appId: process.env.IG_APP_ID } : {}), ...(process.env.IG_APP_SECRET ? { appSecret: process.env.IG_APP_SECRET } : {}) }) : null;
  if (!ig) console.log('Instagram não configurado: não lê comentários nem agenda Reels.');

  const precisaGravar = qual === 'partida' || qual === 'resumo' || qual === 'programados';
  const gravacao = precisaGravar ? await import('@liga/renderer/gravacao') : null;
  const ctx: ContextoDoJob = {
    banco,
    armazenamento: nuvem?.armazenamento ?? new PastaLocal(join(raizRepo, '.cache/nuvem-local')),
    agenda: nuvem?.agenda ?? new AgendaNaMemoria(),
    ig,
    ...(gravacao
      ? {
          gravarReels: (d, saida) => gravacao.gravarReels(d, { saida }).then(() => {}),
          gravarAoVivo: (d, saida) => gravacao.gravarNarracaoAoVivo(d, saida).then(() => {}),
          gravarResumo: (d, saida) => gravacao.gravarResumo(d, { saida }).then(() => {}),
        }
      : {}),
  };
  if (qual === 'mensagens') {
    // Diagnóstico: o token tem a permissão de mensagens e enxerga as DMs?
    const v = await ig!.validade().catch((e) => ({ erro: (e as Error).message }));
    console.log('token:', JSON.stringify(v));
    try {
      const cs = await ig!.conversas();
      console.log(`${cs.length} conversa(s) visível(is) pela API.`);
      for (const c of cs) console.log(`  ${c.updated_time ?? ''} ${(c.participants?.data ?? []).map((p) => p.username ?? '?').join(', ')}`);
    } catch (e) {
      console.log(`DMs: ${(e as Error).message}`);
    }
  } else if (qual === 'procurar') {
    // Diagnóstico: onde está o comentário de USUARIO (em todos os posts da conta, cru da API).
    const quem = (process.env.USUARIO ?? '').replace(/^@/, '').toLowerCase();
    const midias = await ig!.midiasDesde(new Date(0));
    console.log(`${midias.length} post(s); inscrição: ${JSON.stringify(await postsDeInscricao(banco))}`);
    let total = 0;
    for (const m of midias) {
      const cs = await ig!.comentariosCrus(m.id).catch((e) => (console.log(`${m.id}: ${(e as Error).message}`), []));
      total += cs.length;
      const semAutor = cs.filter((c) => !c.from?.id).length;
      console.log(`${m.id} ${m.timestamp} ${m.media_product_type} ${m.permalink}: ${cs.length} comentário(s), ${semAutor} sem from`);
      for (const c of cs) {
        const nome = (c.from?.username ?? c.username ?? '').toLowerCase();
        if (nome.includes(quem) || (c.text ?? '').toLowerCase().includes(quem)) console.log(`  ACHEI ${JSON.stringify(c)}`);
      }
    }
    console.log(`${total} comentário(s) no total.`);
  } else if (qual === 'programados') {
    const { DADOS_DA_ABERTURA_T2, dadosDaAberturaT3 } = await import('@liga/renderer');
    const { DIAS_DA_COPA } = await import('@liga/shared');
    const { seriesDaTemporadaPeloNumero } = await import('../src/programados.js');
    await jobProgramados({
      ...ctx,
      gravar: async (id, o, saida) => {
        if (id === 'abertura-t2') await gravacao!.gravarAberturaDaTemporada({ ...DADOS_DA_ABERTURA_T2, estreia: o.estreia, estrelas: await estrelasNoBanco(banco) }, { saida, crf: 18 });
        else if (id === 'abertura-t3') {
          // T3 (ADR-0088): as Séries de 8 do banco; a Fase de Liga começa depois dos dias da Copa.
          const s = await seriesDaTemporadaPeloNumero(banco, 3);
          const [a, m, d] = o.estreia.split('-').map(Number) as [number, number, number];
          const estreiaDaLiga = new Date(Date.UTC(a, m - 1, d + DIAS_DA_COPA, 12)).toISOString().slice(0, 10);
          await gravacao!.gravarAberturaDaTemporada(dadosDaAberturaT3({ serieA: s.A, serieB: s.B, estreia: o.estreia, estreiaDaLiga, estrelas: await estrelasNoBanco(banco) }), { saida, crf: 18 });
        }
        else if (id === 'agradecimento-t1') await gravacao!.gravarAgradecimentoT1(await dadosDoAgradecimentoT1(banco), { saida, crf: 18 });
        else if (id === 'agradecimento-t2') await gravacao!.gravarAgradecimentoT2(await dadosDoAgradecimentoT2(banco, { copaEm: o.estreia }), { saida, crf: 18 });
        else if (id === 'rebalanceamento-t2') await gravacao!.gravarRebalanceamentoT2(await dadosDoRebalanceamentoT2(banco, o.estreia), { saida, crf: 18 });
        else if (id === 'perfil-do-time') await gravacao!.gravarPerfilDoTime(await dadosDoPerfilDoTime(banco), { saida, crf: 18 });
        else if (id === 'mudanca-de-endereco') await gravacao!.gravarMudancaDeEndereco({ saida, crf: 18 });
        else if (id.startsWith('novidades-')) {
          // Novidades da T2 (ADR-0063) e da T3 (ADR-0092): Partidas de exemplo, sempre as mesmas.
          // "novidades-t3-loja" vira o Reels T3_LOJA.
          const reels = id.slice('novidades-'.length).toUpperCase().replace('-', '_') as 'CAMPO' | 'CAPITAO' | 'JOGADOR' | 'SITE' | 'T3_CAMPO' | 'T3_LOJA' | 'T3_PALPITE' | 'T3_CAPITAO';
          const publicadoEm = REELS_PROGRAMADOS.find((p) => p.id === id)!.publicarEm;
          await gravacao!.gravarNovidades(gravacao!.dadosDasNovidades(reels, { estreia: o.estreia, publicadoEm }), { saida, crf: 18 });
        }
        else throw new Error(`Programado sem gravação: ${id}`);
      },
    });
  } else if (qual === 'boas-vindas') await jobBoasVindas(ctx, { enviar: flags.includes('--enviar') });
  else if (qual === 'coletar') await jobColetar(ctx);
  else if (qual === 'escalar') await jobEscalar(ctx, { esperarCorte: !flags.includes('--sem-esperar') });
  else if (qual === 'partida') await jobPartida(ctx, { esperarCorte: !flags.includes('--sem-esperar') });
  else await jobResumo(ctx);
} finally {
  await banco.fechar();
}
