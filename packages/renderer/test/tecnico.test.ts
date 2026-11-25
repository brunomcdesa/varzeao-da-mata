import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida, type Lado } from '@liga/sim';
import { Timeline } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';
import { montarNarracao, referenciaDoTecnico } from '../src/narracao.js';
import { GRADES_DO_TECNICO, gestoDoTecnico, vestirTecnico } from '../src/tecnico.js';
import { comBracadeira, corDaBracadeira } from '../src/sprites.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId): Escalacao => ({ time, jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr: 70, habilidades: habilidadesDoPerfil(posicao, 70) })) });
const e = { mandante: esc('ONC'), visitante: esc('TAT') };
const slot = (lado: Lado) => ({ lado, indice: 3 });

describe('Técnico à beira do campo (ADR-0111)', () => {
  it('vibra no gol a favor, põe as mãos na cabeça no sofrido e reclama no cartão contra o Time', () => {
    const gol = { tipo: 'GOL', lado: 'mandante', protagonista: slot('mandante'), progresso: 0.3 } as const;
    expect(gestoDoTecnico({ destaque: gol }, 'mandante')).toBe('VIBRA');
    expect(gestoDoTecnico({ destaque: gol }, 'visitante')).toBe('MAOS_NA_CABECA');
    const cartao = { tipo: 'FALTA', lado: 'mandante', protagonista: slot('visitante'), progresso: 0.3, cartao: 'AMARELO' } as const;
    expect(gestoDoTecnico({ destaque: cartao }, 'visitante')).toBe('RECLAMA');
    expect(gestoDoTecnico({ destaque: cartao }, 'mandante')).toBe('PARADO');
    expect(gestoDoTecnico({ destaque: { tipo: 'FALTA', lado: 'mandante', protagonista: slot('visitante'), progresso: 0.3 } }, 'visitante')).toBe('PARADO');
    expect(gestoDoTecnico({ destaque: null }, 'mandante')).toBe('PARADO');
  });

  it('cada Item da Loja do Técnico muda a grade; sem Itens, é o agasalho', () => {
    const base = GRADES_DO_TECNICO.PARADO;
    expect(vestirTecnico(base, 'PARADO', null)).toEqual([...base]);
    const cheio = vestirTecnico(base, 'PARADO', { BONE: 'BONE_DO_TIME', OCULOS: 'OCULOS_ESCUROS', APITO: 'APITO_NO_PESCOCO', PRANCHETA: 'PRANCHETA_TATICA', ROUPA: 'ROUPA_TERNO' }).join('');
    for (const c of ['N', 'n', 'O', 'A', 'a', 'Q', 'q', 't', 'g']) expect(cheio).toContain(c);
    // Prancheta só com a mão livre: não aparece com as mãos na cabeça.
    expect(vestirTecnico(GRADES_DO_TECNICO.MAOS_NA_CABECA, 'MAOS_NA_CABECA', { PRANCHETA: 'PRANCHETA_TATICA' }).join('')).not.toContain('Q');
    for (const g of Object.values(GRADES_DO_TECNICO)) expect(g.every((l) => l.length === 12) && g.length === 16).toBe(true);
  });
});

describe('Braçadeira (ADR-0112)', () => {
  it('pinta a manga acima do braço da direita; amarela, ou azul em camisa amarelada', () => {
    const cabeca = ['....KKKK....', '...KHHHHK...', '..KHHHHHHK..', '..KHSSSSHK..', '..KSKSSKSK..', '..KSSSSSSK..', '...KSSSSK...'];
    const g = comBracadeira([...cabeca, '..KCCCCCCK..', '.KCCCccCCCK.', '.KSCCccCCSK.', '.KSKCCCCKSK.']);
    expect(g[8]).toBe('.KCCCccCCYK.');
    expect(g.join('').split('Y').length).toBe(2);
    expect(corDaBracadeira('#2F6FE0')).toBe('#F6D02F');
    expect(corDaBracadeira('#F2C400')).toBe('#2F6FE0');
  });
});

describe('Narrador com Técnico e Marcação (ADRs 0111 e 0112)', () => {
  const tl = (seed: number) => new Timeline(simularPartida({ ...e, seed, fase: 'LIGA', t2: { postura: { mandante: 'OFENSIVA', visitante: 'OFENSIVA' } } }), e);
  it('na Escalação: o Técnico pelo Apelido (ou pelo Time) e a Marcação individual', () => {
    const falas = montarNarracao(new Roteiro(tl(3)), undefined, { tecnicos: { mandante: { apelido: 'Seu Tonho' }, visitante: {} }, marcacoes: { visitante: { marcador: 1, alvo: 5 } } });
    const f = falas.find((x) => x.id === 'escalacao-beira')!;
    expect(f.texto).toBe('Na beira do campo, Seu Tonho, técnico da Onça, e o técnico do Tatu. Marcação individual! O zagueiro do Tatu vai colado no atacante da Onça.');
    expect(referenciaDoTecnico({ apelido: 'Seu Tonho' }, 'ONC', false)).toBe('Seu Tonho');
  });
  it('sem Técnico nem Marcação, nenhuma fala nova; no gol, às vezes o Técnico vibra', () => {
    expect(montarNarracao(new Roteiro(tl(3))).some((x) => x.id === 'escalacao-beira' || x.id.startsWith('tecnico-gol'))).toBe(false);
    let vibrou = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const falas = montarNarracao(new Roteiro(tl(seed)), undefined, { tecnicos: { mandante: {}, visitante: {} } });
      vibrou += falas.filter((x) => x.id.startsWith('tecnico-gol')).length;
      for (const x of falas.filter((y) => y.id.startsWith('tecnico-gol'))) expect(x.texto).toMatch(/o técnico d[ao] (Onça|Tatu)/i);
    }
    expect(vibrou).toBeGreaterThan(0);
  });
});
