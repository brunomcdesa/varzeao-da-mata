/**
 * Grava, sobe e posta (ou agenda) o Reels de apresentação da Liga, com a legenda pronta:
 *
 *   pnpm postar-apresentacao --em 19:00               (hoje às 19h, horário de Brasília)
 *   pnpm postar-apresentacao --em 2026-11-08T12:00
 *   pnpm postar-apresentacao --agora
 *   pnpm postar-apresentacao --video apresentacao.mp4 --em 19:00   (usa um vídeo já gravado)
 *   pnpm postar-apresentacao --so-legenda              (só mostra a legenda)
 *
 * Agendado, quem publica é a borda (o container vale 24 h, então o horário tem de ser nas
 * próximas 24 h). Depois de publicado, o coletar lê os comentários desse post sempre.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Instagram, conectar, gravarNaAgenda, guardarPostDeInscricao, legendaDaApresentacao, nuvemDoAmbiente, prepararBanco, tokenGuardado } from '../src/index.js';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(join(raizRepo, '.env'));
} catch {
  /* sem .env */
}

const { values: args } = parseArgs({
  options: {
    em: { type: 'string' },
    agora: { type: 'boolean' },
    video: { type: 'string' },
    estreia: { type: 'string' },
    'so-legenda': { type: 'boolean' },
  },
});
const base = process.env.INIT_CWD ?? process.cwd();
const sair = (m: string): never => {
  console.error(m);
  process.exit(1);
};

/** "19:00" (hoje) ou "2026-11-08T12:00", sempre no horário de Brasília. */
function horario(texto: string, agora: Date): Date {
  const hoje = new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  const iso = /^\d{1,2}:\d{2}$/.test(texto) ? `${hoje}T${texto.padStart(5, '0')}` : texto;
  const d = new Date(`${iso}:00-03:00`);
  if (Number.isNaN(d.getTime())) sair(`Horário inválido: ${texto}. Use 19:00 ou 2026-11-08T12:00.`);
  return d;
}

if (!process.env.DATABASE_URL) sair('Falta DATABASE_URL no .env.');
const banco = conectar();
try {
  await prepararBanco(banco);
  const temporada = (await banco.query<{ id: number; inicio: string | Date }>(`SELECT id, inicio FROM temporada ORDER BY numero DESC LIMIT 1`)).rows[0];
  if (!temporada) sair('Nenhuma Temporada criada (pnpm liga temporada --inicio AAAA-MM-DD).');
  const estreia = args.estreia ?? (temporada!.inicio instanceof Date ? temporada!.inicio.toISOString() : String(temporada!.inicio)).slice(0, 10);
  const legenda = legendaDaApresentacao(estreia);
  console.log(`Legenda:\n${legenda}\n`);
  if (args['so-legenda']) process.exit(0);

  const agora = new Date();
  if (!args.agora && !args.em) sair('Diga quando: --em 19:00, --em 2026-11-08T12:00 ou --agora.');
  const publicarEm = args.agora ? agora : horario(args.em!, agora);
  if (!args.agora && (publicarEm.getTime() <= agora.getTime() + 5 * 60_000 || publicarEm.getTime() > agora.getTime() + 23 * 3600_000)) {
    sair('O horário tem de ser entre 5 minutos e 23 horas a partir de agora (o container do Instagram vale 24 h).');
  }

  const nuvem = nuvemDoAmbiente() ?? sair('Faltam as variáveis do Cloudflare no .env.');
  const token = (await tokenGuardado(banco))?.token ?? process.env.IG_ACCESS_TOKEN;
  if (!process.env.IG_USER_ID || !token) sair('Faltam IG_USER_ID e IG_ACCESS_TOKEN no .env.');
  const ig = new Instagram({ userId: process.env.IG_USER_ID!, token: token! });

  // 1. O vídeo: o informado ou um gravado agora, com a voz do Locutor.
  let arquivo = args.video ? resolve(base, args.video) : '';
  let temporario = '';
  if (!arquivo) {
    if (!process.env.GEMINI_API_KEY) sair('Sem GEMINI_API_KEY o vídeo sai sem narração. Ponha a chave no .env ou passe --video.');
    temporario = await mkdtemp(join(tmpdir(), 'varzea-apresentacao-'));
    arquivo = join(temporario, 'apresentacao.mp4');
    const { gravarApresentacao } = await import('@liga/renderer/gravacao');
    const { DADOS_DA_APRESENTACAO } = await import('@liga/renderer');
    console.log('Gravando o vídeo...');
    await gravarApresentacao({ ...DADOS_DA_APRESENTACAO, estreia }, { saida: arquivo, crf: 18 });
  }

  // 2. Sobe para o bucket público (o Instagram baixa de lá).
  const chave = `videos/apresentacao-${Date.now()}.mp4`;
  await nuvem.armazenamento.enviar('publico', chave, new Uint8Array(await readFile(arquivo)), { tipo: 'video/mp4', cache: 'public, max-age=31536000, immutable' });
  if (temporario) await rm(temporario, { recursive: true, force: true });
  const videoUrl = nuvem.armazenamento.urlPublica(chave);
  console.log(`Vídeo no ar: ${videoUrl}`);

  // 3. Container do Reels com a legenda; espera o Instagram processar.
  console.log('Criando o Reels no Instagram (o processamento leva de 30 s a alguns minutos)...');
  const container = await ig.criarReels({ videoUrl, legenda, capaEmMs: 1500 });
  await ig.esperarContainer(container);

  // 4. Publica já ou deixa na agenda da borda.
  if (args.agora) {
    const mediaId = await ig.publicar(container);
    await guardarPostDeInscricao(banco, mediaId);
    console.log(`Publicado: ${(await ig.linkDaMidia(mediaId)) ?? mediaId}`);
  } else {
    await gravarNaAgenda(nuvem.agenda, { tipo: 'APRESENTACAO', ref: temporada!.id, containerId: container, publicarEm: publicarEm.toISOString() });
    const quando = publicarEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    console.log(`Agendado para ${quando} (horário de Brasília). A borda publica sozinha; o próximo coletar registra o post.`);
  }
} finally {
  await banco.fechar();
}
