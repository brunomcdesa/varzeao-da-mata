import { describe, expect, it } from 'vitest';
import { interpretar } from '../src/comandos.js';

describe('Inscrição', () => {
  it('"Entrou" no lugar de "Entro": "Entrou arara ponta esquerda"', () => {
    expect(interpretar('Entrou arara ponta esquerda')).toEqual({ tipo: 'INSCRICAO', time: 'ARA', posicao: 'ATA' });
    expect(interpretar('entrou na onça')).toEqual({ tipo: 'INSCRICAO', time: 'ONC' });
  });

  it.each([
    ['ENTRO CAPIVARA ATA', 'CAP', 'ATA'],
    ['entro onça goleiro', 'ONC', 'GOL'],
    ['Entro na Onça como goleira 🐆🔥', 'ONC', 'GOL'],
    ['ENTRO ATA CAPIVARA', 'CAP', 'ATA'],
    ['entro no tatu de zagueiro!!!', 'TAT', 'ZAG'],
    ['ENTRO TAMANDUÁ MEIO CAMPO', 'TAM', 'MEI'],
    ['entro arara azul atacante', 'ARA', 'ATA'],
    ['Entro pro sagui, volante', 'SAG', 'MEI'],
    ['ENTRO TUCANO CAMISA 9', 'TUC', 'ATA'],
    ['entro preguiça defesa', 'PRE', 'ZAG'],
    ['  ENTRO   ONC   MEI  ', 'ONC', 'MEI'],
    ['entro no gol da capivara', 'CAP', 'GOL'],
    ['Entro na preguiça pra jogar de artilheiro, por favor', 'PRE', 'ATA'],
  ])('%s → %s %s', (texto, time, posicao) => {
    expect(interpretar(texto)).toEqual({ tipo: 'INSCRICAO', time, posicao });
  });

  it.each([
    ['entro atacante', 'SEM_TIME'],
    ['entro capivara onça ata', 'TIMES_DEMAIS'],
    ['entro capivara ata gol', 'POSICOES_DEMAIS'],
    ['ENTRO @amigo CAPIVARA ATA', 'MARCOU_TERCEIRO'],
  ])('%s → inválido (%s)', (texto, motivo) => {
    expect(interpretar(texto)).toEqual({ tipo: 'INVALIDO', prefixo: 'ENTRO', motivo });
  });
});

describe('Voto', () => {
  it('lê o número do Candidato (ADR-0011)', () => {
    expect(interpretar('CRAQUE 3')).toEqual({ tipo: 'VOTO', numero: 3 });
    // Pedido de vaga sem ENTRO (@eofamoso__2k).
    expect(interpretar('Queria vaga no tucano meia')).toEqual({ tipo: 'INSCRICAO', time: 'TUC', posicao: 'MEI' });
    expect(interpretar('tem vaga na arara?')).toEqual({ tipo: 'INSCRICAO', time: 'ARA' });
    expect(interpretar('voto nº 2')).toEqual({ tipo: 'VOTO', numero: 2 });
    expect(interpretar('craque #5 🔥')).toEqual({ tipo: 'VOTO', numero: 5 });
  });

  it('o número sozinho é voto solto (só vale no post da votação)', () => {
    expect(interpretar('3')).toEqual({ tipo: 'VOTO', numero: 3, solto: true });
    expect(interpretar(' 4!! 🐐')).toEqual({ tipo: 'VOTO', numero: 4, solto: true });
    expect(interpretar('10')).toEqual({ tipo: 'IGNORADO' });
    expect(interpretar('3x1 foi pouco')).toEqual({ tipo: 'IGNORADO' });
  });

  it('com duas Séries, a letra diz a Série: "B3", "A3", "CRAQUE B3" (ADR-0017)', () => {
    expect(interpretar('B3')).toEqual({ tipo: 'VOTO', numero: 3, serie: 'B', solto: true });
    expect(interpretar('a2')).toEqual({ tipo: 'VOTO', numero: 2, serie: 'A', solto: true });
    expect(interpretar('B 4 🔥')).toEqual({ tipo: 'VOTO', numero: 4, serie: 'B', solto: true });
    expect(interpretar('CRAQUE B3')).toEqual({ tipo: 'VOTO', numero: 3, serie: 'B' });
    expect(interpretar('craque série b 1')).toEqual({ tipo: 'VOTO', numero: 1, serie: 'B' });
    expect(interpretar('voto A5')).toEqual({ tipo: 'VOTO', numero: 5, serie: 'A' });
    // Sem letra continua sendo a A.
    expect(interpretar('CRAQUE 3')).toEqual({ tipo: 'VOTO', numero: 3 });
  });

  it('a Série B tem os Times novos: "ENTRO Jacaré atacante", "quero o lobo guará goleiro"', () => {
    expect(interpretar('ENTRO Jacaré atacante')).toEqual({ tipo: 'INSCRICAO', time: 'JAC', posicao: 'ATA' });
    expect(interpretar('ENTRO lobo guará goleiro')).toEqual({ tipo: 'INSCRICAO', time: 'LOB', posicao: 'GOL' });
    expect(interpretar('ENTRO cachorro do mato zagueiro')).toEqual({ tipo: 'INSCRICAO', time: 'CDM', posicao: 'ZAG' });
    expect(interpretar('ENTRO boto rosa meia')).toEqual({ tipo: 'INSCRICAO', time: 'BOT', posicao: 'MEI' });
    expect(interpretar('ENTRO Coruja atacante')).toEqual({ tipo: 'INSCRICAO', time: 'COR', posicao: 'ATA' });
  });

  it('com @ e sem número é inválido: o voto agora é por número', () => {
    expect(interpretar('CRAQUE @rafa')).toEqual({ tipo: 'INVALIDO', prefixo: 'CRAQUE', motivo: 'SEM_CANDIDATO' });
    expect(interpretar('CRAQUE 12')).toEqual({ tipo: 'INVALIDO', prefixo: 'CRAQUE', motivo: 'SEM_CANDIDATO' });
  });
});

describe('Comentários sem Comando', () => {
  it('pedido sem o ENTRO no começo também vale', () => {
    expect(interpretar('vou entrar na capivara')).toEqual({ tipo: 'INSCRICAO', time: 'CAP' });
    expect(interpretar('quero ENTRO CAPIVARA ATA')).toEqual({ tipo: 'INSCRICAO', time: 'CAP', posicao: 'ATA' });
  });

  it.each(['que jogaço!', '@amigo entro capivara ata', 'vai capivara', ''])('%s → ignorado', (texto) => {
    expect(interpretar(texto)).toEqual({ tipo: 'IGNORADO' });
  });

  describe('sem ENTRO', () => {
    it('vale quando o comentário é só time e posição', () => {
      expect(interpretar('Onça, atacante')).toEqual({ tipo: 'INSCRICAO', time: 'ONC', posicao: 'ATA' });
      expect(interpretar('capivara goleiro 🧤')).toEqual({ tipo: 'INSCRICAO', time: 'CAP', posicao: 'GOL' });
      expect(interpretar('Quero entrar na Arara de meia')).toEqual({ tipo: 'INSCRICAO', time: 'ARA', posicao: 'MEI' });
      expect(interpretar('zagueiro tatu')).toEqual({ tipo: 'INSCRICAO', time: 'TAT', posicao: 'ZAG' });
      // Só o Time, com pedido: entra na posição mais vazia (decidida na coleta).
      expect(interpretar('ENTRO CAPIVARA')).toEqual({ tipo: 'INSCRICAO', time: 'CAP' });
      expect(interpretar('Eu sou da arara')).toEqual({ tipo: 'INSCRICAO', time: 'ARA' });
      expect(interpretar('Quero ser da arara, meu nome é Ryquellme')).toEqual({ tipo: 'INSCRICAO', time: 'ARA' });
      expect(interpretar('Comente ENTRO (POSICAO) ARARA')).toEqual({ tipo: 'INSCRICAO', time: 'ARA' });
      // Formatos vistos nos comentários da estreia.
      expect(interpretar('Meia,Sagui')).toEqual({ tipo: 'INSCRICAO', time: 'SAG', posicao: 'MEI' });
      expect(interpretar('onça  ponta')).toEqual({ tipo: 'INSCRICAO', time: 'ONC', posicao: 'ATA' });
      expect(interpretar('Quero ser do Onça, Centroavante.')).toEqual({ tipo: 'INSCRICAO', time: 'ONC', posicao: 'ATA' });
      expect(interpretar('@varzeao_da_mata eu fiz lá sou atacante da arara')).toEqual({ tipo: 'INSCRICAO', time: 'ARA', posicao: 'ATA' });
      expect(interpretar('Entro - capivara , goleira ❤️')).toEqual({ tipo: 'INSCRICAO', time: 'CAP', posicao: 'GOL' });
      expect(interpretar('Capivara , ponta esquerda')).toEqual({ tipo: 'INSCRICAO', time: 'CAP', posicao: 'ATA' });
      expect(interpretar('Quer ser atacante dos Tamandua,me chamo Alisson')).toEqual({ tipo: 'INSCRICAO', time: 'TAM', posicao: 'ATA' });
    });

    it('pedidos ignorados em 10/11 passam a valer', () => {
      expect(interpretar('Quero ser da ARARA FC DE MEIO CAMPISTA CENTRAL')).toEqual({ tipo: 'INSCRICAO', time: 'ARA', posicao: 'MEI' });
      expect(interpretar('Cuida mano bote o meu, goleiro, onça, por favor mim bota nesse time')).toEqual({ tipo: 'INSCRICAO', time: 'ONC', posicao: 'GOL' });
      expect(interpretar('Na primeira partida do time de onça pode mim bota pra eu jogar por favor')).toEqual({ tipo: 'INSCRICAO', time: 'ONC' });
    });

    it('comemoração continua ignorada', () => {
      expect(interpretar('Gol meu vamo onça')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('Primeira vitória nossa e gol meu')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('Na primeira partida da onça o goleiro pegou tudo')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('empatei o jogo, vamo tucano')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('Vou ser titular no tucano?')).toEqual({ tipo: 'IGNORADO' });
    });

    it('não vale em frase sobre o jogo, com dois times ou marcando alguém', () => {
      expect(interpretar('o atacante da onça jogou muito')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('onça ou tatu, atacante')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('@amigo onça atacante')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('vai onça!')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('Onça!')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('@varzeao_da_mata me coloca por favor')).toEqual({ tipo: 'IGNORADO' });
    });
  });
});

describe('Transferência (ADR-0012)', () => {
  it.each([
    ['TRANSFERIR Preguiça', { tipo: 'TRANSFERENCIA', times: ['PRE'] }],
    ['transferir pra preguiça de zagueiro', { tipo: 'TRANSFERENCIA', times: ['PRE'], posicao: 'ZAG' }],
    ['Posso ir pro time da preguiça pra equilibrar?', { tipo: 'TRANSFERENCIA', times: ['PRE'] }],
    ['quero ir pra arara', { tipo: 'TRANSFERENCIA', times: ['ARA'] }],
    ['me transfere pra capivara', { tipo: 'TRANSFERENCIA', times: ['CAP'] }],
    ['quero virar zagueiro', { tipo: 'TRANSFERENCIA', times: [], posicao: 'ZAG' }],
    ['quero sair da onça e ir pra preguiça', { tipo: 'TRANSFERENCIA', times: ['ONC', 'PRE'] }],
    ['Oi, tem transferência? Por enquanto não quero mudar mas uma hora acho q vou querer', { tipo: 'INVALIDO', prefixo: 'TRANSFERIR', motivo: 'SEM_TIME' }],
  ])('%s', (texto, esperado) => {
    expect(interpretar(texto)).toEqual(esperado);
  });

  it.each([
    'Opa varzeao tudo bem então, meu amigo e o its___mu_27 ele está no time da onça mais ele quer ser transferido para o time da preguiça poderia mudar ele para o time da preguiça?',
    'transfere o its___mu pra preguiça',
    'meu irmão quer ir pra arara',
  ])('pedido por outra pessoa não é Transferência: %s', (texto) => {
    expect(interpretar(texto).tipo).toBe('IGNORADO');
  });

  it.each(['Vamos onça🔥', 'a onça vai ir pra final', 'o atacante da onça vai trocar de chuteira', 'vou pra cima onça'])('não é Transferência: %s', (texto) => {
    expect(interpretar(texto).tipo).not.toBe('TRANSFERENCIA');
  });
});
