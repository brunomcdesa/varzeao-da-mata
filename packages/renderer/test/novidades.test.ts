import { describe, expect, it } from 'vitest';
import { NARRADORES } from '../src/narradores.js';
import { REELS_DE_NOVIDADES, RoteiroNovidades, cenasDasNovidades, narracaoDasNovidades, quandoEstreia, type ClipeId } from '../src/novidades.js';
import { dadosDasNovidades } from '../scripts/partidasDasNovidades.js';

const quando = { estreia: '2026-11-19', publicadoEm: '2026-11-18T15:00:00Z' };

describe('Novidades da T2 (ADR-0063)', () => {
  const dados = Object.fromEntries(REELS_DE_NOVIDADES.map((r) => [r, dadosDasNovidades(r, quando)])) as Record<(typeof REELS_DE_NOVIDADES)[number], ReturnType<typeof dadosDasNovidades>>;

  it('acha todos os trechos de jogo de cada Reels, sempre nos mesmos lances', () => {
    const esperados: Record<string, ClipeId[]> = {
      CAMPO: ['FALTA_CARTAO', 'PENALTI', 'BARREIRA', 'ESCANTEIO', 'CONTRA_ATAQUE', 'MARCACAO_DUPLA', 'GOL_TORCIDA', 'CLIMA', 'TROCA'],
      CAPITAO: ['TABELA', 'COBERTURA', 'LIGACAO_DIRETA'],
      JOGADOR: ['PENALTI'],
    };
    for (const [r, ids] of Object.entries(esperados)) {
      const d = dados[r as keyof typeof dados];
      for (const id of ids) {
        const c = d.clipes[id]!;
        expect(c, `${r} ${id}`).toBeDefined();
        expect(c.de).toBeLessThan(c.chave);
        expect(c.chave).toBeLessThan(c.ate);
      }
      // Cada cena de jogo do Reels tem o seu trecho: nenhuma sai.
      expect(cenasDasNovidades(d).filter((x) => 'clipe' in x.visual).length).toBe(r === 'JOGADOR' ? 1 : ids.length);
    }
    expect(dadosDasNovidades('CAPITAO', quando).clipes).toEqual(dados.CAPITAO.clipes);
  });

  it('os nomes em cima dos bonecos são apelidos, nunca um @', () => {
    for (const d of Object.values(dados)) for (const p of d.partidas) for (const lado of ['mandante', 'visitante'] as const) {
      expect(p.apelidos![lado].every((a) => a && !a.startsWith('@'))).toBe(true);
    }
  });

  it('cada Reels abre, termina na chamada e chama o próximo pelo horário', () => {
    for (const r of REELS_DE_NOVIDADES) {
      const cenas = cenasDasNovidades(dados[r]);
      expect(cenas[0]!.id).toBe('abertura');
      expect(cenas.at(-1)!.id).toBe('chamada');
      expect(cenas.at(-1)!.fala).toContain('amanhã');
    }
    expect(cenasDasNovidades(dados.CAMPO).at(-1)!.fala).toContain('às duas da tarde');
    expect(cenasDasNovidades(dados.JOGADOR).at(-1)!.fala).toContain('às seis da tarde');
    expect(cenasDasNovidades(dados.SITE).at(-1)!.fala).not.toContain('tem mais');
  });

  it('no Reels de dentro de campo, cada Narrador se apresenta com a própria voz', () => {
    const falas = narracaoDasNovidades(new RoteiroNovidades(dados.CAMPO));
    for (const n of NARRADORES) expect(falas.find((f) => f.texto === n.apresentacao)?.narrador).toBe(n.id);
    expect(falas.filter((f) => !NARRADORES.some((n) => n.apresentacao === f.texto)).every((f) => f.narrador === 'RITA')).toBe(true);
  });

  it('a narração estica as cenas e o Narrador nunca fala um @', () => {
    for (const r of REELS_DE_NOVIDADES) {
      const base = new RoteiroNovidades(dados[r]);
      const longo = new RoteiroNovidades(dados[r], { 1: { antes: 20 } });
      expect(longo.duracao).toBeGreaterThan(base.duracao);
      for (const f of narracaoDasNovidades(base)) expect(f.texto).not.toMatch(/@/);
    }
  });

  it('o Narrador fala de cada novidade essencial (nada fica de fora)', () => {
    const essenciais: Record<string, string[]> = {
      CAMPO: ['falta', 'juiz', 'amarelo', 'vermelho', 'com seis', 'jogo seguinte', 'pênalti', 'barreira', 'jogada ensaiada', 'escanteio', 'contra-ataque', 'zagueiros', 'arquibancada', 'elenco', 'grito de guerra', 'clima', 'lama', 'segundo uniforme', 'substituição', 'abaixo de cinco', 'duas trocas', 'banco', 'goleiro só', 'expulso não', 'cinco narradores', 'sorteado', 'apelido'],
      CAPITAO: ['mais partidas', 'vínculo', 'suspenso', 'faixa', 'corte', 'em segredo', 'ofensiva', 'equilibrada', 'defensiva', 'ritmo', 'formação', 'dois, dois, dois', 'jogo inteiro', 'nenhuma é melhor', 'somam', 'fora de posição', 'jogador da base', 'prioridade', 'tabela', 'cobertura', 'ligação direta'],
      JOGADOR: ['vínculo', 'código', 'DM', 'apelido', 'catorze letras', 'palavrão', 'uma vez por dia', 'especialização', 'artilheiro', 'pegador de pênalti', 'treino', 'cinquenta por cento', 'uma vez e meia', 'dois pontos', 'CONFIRMO', 'craque da rodada', 'dois jogos seguidos', 'resenha', 'clássico', 'canto', 'sorteado', 'seleção da rodada', 'muralha', 'matador', 'seleção da temporada'],
      SITE: ['app', 'sem loja', 'Android', 'iPhone', 'Instagram', 'avisos', 'escalação', 'apito inicial', 'gol', 'fim do jogo', 'ao vivo', 'melhores momentos', 'assistindo', 'reagir', 'replay', 'carreira', 'troféus', 'selo', 'estrela'],
    };
    for (const r of REELS_DE_NOVIDADES) {
      const tudo = cenasDasNovidades(dados[r]).map((x) => x.fala).join(' ').toLowerCase();
      for (const e of essenciais[r]!) expect(tudo, `${r}: ${e}`).toContain(e.toLowerCase());
    }
  });

  it('os sons dos trechos caem dentro do vídeo', () => {
    const r = new RoteiroNovidades(dados.CAMPO);
    for (const e of r.eventos()) {
      expect(e.t).toBeGreaterThanOrEqual(0);
      expect(e.t).toBeLessThanOrEqual(r.duracao);
    }
    expect(r.eventos().some((e) => e.tipo === 'APITO_FALTA')).toBe(true);
  });

  it('estreia no dia seguinte vira "amanhã"; mais longe, o dia da semana', () => {
    expect(quandoEstreia(quando).falado).toBe('amanhã');
    expect(quandoEstreia({ estreia: '2026-11-19', publicadoEm: '2026-11-17T15:00:00Z' }).falado).toBe('na quinta, dia dezenove');
    // 21h de Brasília ainda é o mesmo dia, mesmo já sendo dia seguinte em UTC.
    expect(quandoEstreia({ estreia: '2026-11-19', publicadoEm: '2026-11-19T00:00:00Z' }).falado).toBe('amanhã');
  });

  it('Seu Jogador: o número da camisa vem logo depois do apelido (ADR-0075)', () => {
    const ids = cenasDasNovidades(dados.JOGADOR).map((c) => c.id);
    expect(ids.indexOf('camisa')).toBe(ids.indexOf('apelido') + 1);
    const camisa = cenasDasNovidades(dados.JOGADOR).find((c) => c.id === 'camisa')!;
    expect(camisa.fala).toMatch(/um a noventa e nove/);
  });

  it('as Partidas de exemplo têm número da camisa, sem repetir no Time, e alguns de camisa lisa', () => {
    for (const p of dados.CAMPO.partidas) {
      for (const lado of ['mandante', 'visitante'] as const) {
        const ns = p.numeros![lado];
        expect(ns.length).toBe(p.nomes[lado].length);
        const usados = ns.filter((n): n is number => n !== null);
        expect(new Set(usados).size).toBe(usados.length);
        for (const n of usados) expect(n >= 1 && n <= 99).toBe(true);
      }
    }
  });
});
