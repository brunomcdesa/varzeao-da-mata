import { FALA_DO_TIME, type MataMataDaPartida } from '@liga/shared';
import { describe, expect, it } from 'vitest';
import { partidaDeTeste } from '../scripts/gravacao.js';
import { roteiroAoVivo } from '../src/aoVivo.js';
import { aberturaDoMataMata, desfechoDoMataMata, montarNarracao } from '../src/narracao.js';
import { RoteiroResumo, narracaoDoResumo, type DadosDoResumo } from '../src/resumo.js';
import { Roteiro } from '../src/roteiro.js';
import { Timeline } from '../src/timeline.js';

const SEMI: MataMataDaPartida = { etapa: 'SEMIFINAL', temporada: 1, serie: null };
const FINAL: MataMataDaPartida = { etapa: 'FINAL', temporada: 1, serie: null };

function narracao(mataMata: MataMataDaPartida | null, seed = 3) {
  const p = partidaDeTeste(seed, 'CAP', 'TAT', 'Final', 'MATA_MATA');
  const roteiro = new Roteiro(new Timeline(p.resultado, p.escalacoes));
  return { p, falas: montarNarracao(roteiro, p.apelidos, { mataMata }) };
}
const texto = (falas: { id: string; texto: string }[], id: string) => falas.find((f) => f.id === id)!.texto;

describe('Narrador no Mata-mata (ADR-0048)', () => {
  it('a abertura da Semifinal fala da vaga na Final', () => {
    const t = texto(narracao(SEMI).falas, 'abertura');
    expect(t).toMatch(/Semifinal|vaga na Final/);
    expect(t).toContain('Capivara contra Tatu');
    expect(t).not.toContain('Bola rolando no Varzeão da Mata!');
  });

  it('a abertura da Final fala do título da Temporada', () => {
    const t = texto(narracao(FINAL).falas, 'abertura');
    expect(t).toMatch(/Final/);
    expect(t).toContain('título da Temporada 1');
  });

  it('o fim da Semifinal diz quem foi pra Final; o da Final, o campeão', () => {
    const semi = narracao(SEMI);
    const v = semi.p.resultado.times[semi.p.resultado.vencedor!];
    const nome = `${FALA_DO_TIME[v].artigo.toUpperCase()} ${FALA_DO_TIME[v].curto}`;
    expect(texto(semi.falas, 'fim')).toContain(`${nome} está na Final!`);
    const final = narracao(FINAL);
    expect(texto(final.falas, 'fim')).toContain(`${nome} é campeão da Temporada 1 do Varzeão da Mata!`);
  });

  it('com duas Séries, fala da Série', () => {
    const b: MataMataDaPartida = { etapa: 'FINAL', temporada: 2, serie: 'B' };
    expect(aberturaDoMataMata(b, 'JAC', 'BOT', 1)).toContain('Série B');
    expect(desfechoDoMataMata(b, 'JAC')).toBe('O Jacaré é campeão da Série B da Temporada 2 do Varzeão da Mata!');
    expect(desfechoDoMataMata({ ...b, etapa: 'SEMIFINAL' }, 'SUC')).toBe('A Sucuri está na Final da Série B!');
  });

  it('o Clássico no Mata-mata continua sendo chamado de Clássico', () => {
    expect(aberturaDoMataMata(SEMI, 'CAP', 'ONC', 1)).toMatch(/^É o .+, valendo vaga na Final!/);
  });

  it('sem Mata-mata a narração não muda', () => {
    const p = partidaDeTeste(3, 'CAP', 'TAT');
    const roteiro = new Roteiro(new Timeline(p.resultado, p.escalacoes));
    expect(montarNarracao(roteiro, p.apelidos, { mataMata: null })).toEqual(montarNarracao(roteiro, p.apelidos));
  });

  it('no Ao Vivo, abertura, fim e o jogo corrido falam do que está em jogo', () => {
    const p = partidaDeTeste(3, 'CAP', 'TAT', 'Final', 'MATA_MATA');
    const tl = new Timeline(p.resultado, p.escalacoes);
    const falas = roteiroAoVivo(tl, p.apelidos, { mataMata: FINAL });
    expect(texto(falas, 'abertura')).toContain('título da Temporada 1');
    expect(texto(falas, 'fim')).toContain('é campeão da Temporada 1');
    const enche = falas.filter((f) => f.tipo === 'enchimento').map((f) => f.texto);
    expect(enche.some((t) => ['Vale a taça!', 'É Final, cada lance vale ouro!', 'Noventa minutos pra entrar na história da Temporada 1.'].includes(t))).toBe(true);
    const liga = roteiroAoVivo(tl, p.apelidos).filter((f) => f.tipo === 'enchimento').map((f) => f.texto);
    expect(liga).not.toContain('Vale a taça!');
  });
});

describe('Resumo das Semifinais: cartela "A Final" (ADR-0048)', () => {
  const base: DadosDoResumo = {
    temporada: 1,
    rodada: 8,
    fase: 'MATA_MATA',
    placares: [],
    tabela: [],
    novosContratados: [],
    totalNovos: 0,
    candidatos: [],
  };

  it('aparece depois dos placares e anuncia o jogo de amanhã', () => {
    const r = new RoteiroResumo({ ...base, final: [{ mandante: 'ONC', visitante: 'CAP', hora: 18 }] });
    expect(r.segmentos.map((s) => s.cartela)).toContain('FINALISTAS');
    const falas = narracaoDoResumo(r).map((f) => f.texto);
    expect(falas[0]).toBe('Fim das Semifinais no Varzeão da Mata! Bora pro resumo!');
    expect(falas).toContain('Tá definida a Final: Onça contra Capivara! Amanhã, às 18 horas, no Varzeão!');
  });

  it('com duas Séries, fala das duas Finais', () => {
    const r = new RoteiroResumo({ ...base, final: [{ mandante: 'ONC', visitante: 'CAP', hora: 18, serie: 'A' }, { mandante: 'JAC', visitante: 'BOT', hora: 18, serie: 'B' }] });
    expect(narracaoDoResumo(r).map((f) => f.texto)).toContain('Tá definida a Final! Na Série A, Onça contra Capivara. Na Série B, Jacaré contra Boto. Amanhã, às 18 horas, no Varzeão!');
  });

  it('fora das Semifinais não há a cartela', () => {
    expect(new RoteiroResumo(base).segmentos.map((s) => s.cartela)).not.toContain('FINALISTAS');
  });
});
