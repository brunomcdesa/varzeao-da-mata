import { describe, expect, it } from 'vitest';
import { interpretar } from '../src/comandos.js';

describe('Inscrição', () => {
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
    ['ENTRO CAPIVARA', 'SEM_POSICAO'],
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
    expect(interpretar('voto nº 2')).toEqual({ tipo: 'VOTO', numero: 2 });
    expect(interpretar('craque #5 🔥')).toEqual({ tipo: 'VOTO', numero: 5 });
  });

  it('o número sozinho é voto solto (só vale no post da votação)', () => {
    expect(interpretar('3')).toEqual({ tipo: 'VOTO', numero: 3, solto: true });
    expect(interpretar(' 4!! 🐐')).toEqual({ tipo: 'VOTO', numero: 4, solto: true });
    expect(interpretar('10')).toEqual({ tipo: 'IGNORADO' });
    expect(interpretar('3x1 foi pouco')).toEqual({ tipo: 'IGNORADO' });
  });

  it('com @ e sem número é inválido: o voto agora é por número', () => {
    expect(interpretar('CRAQUE @rafa')).toEqual({ tipo: 'INVALIDO', prefixo: 'CRAQUE', motivo: 'SEM_CANDIDATO' });
    expect(interpretar('CRAQUE 12')).toEqual({ tipo: 'INVALIDO', prefixo: 'CRAQUE', motivo: 'SEM_CANDIDATO' });
  });
});

describe('Comentários sem Comando', () => {
  it.each(['que jogaço!', 'vou entrar na capivara', '@amigo entro capivara ata', 'quero ENTRO CAPIVARA ATA', ''])('%s → ignorado', (texto) => {
    expect(interpretar(texto)).toEqual({ tipo: 'IGNORADO' });
  });

  describe('sem ENTRO', () => {
    it('vale quando o comentário é só time e posição', () => {
      expect(interpretar('Onça, atacante')).toEqual({ tipo: 'INSCRICAO', time: 'ONC', posicao: 'ATA' });
      expect(interpretar('capivara goleiro 🧤')).toEqual({ tipo: 'INSCRICAO', time: 'CAP', posicao: 'GOL' });
      expect(interpretar('Quero entrar na Arara de meia')).toEqual({ tipo: 'INSCRICAO', time: 'ARA', posicao: 'MEI' });
      expect(interpretar('zagueiro tatu')).toEqual({ tipo: 'INSCRICAO', time: 'TAT', posicao: 'ZAG' });
    });

    it('não vale em frase sobre o jogo, com dois times ou marcando alguém', () => {
      expect(interpretar('o atacante da onça jogou muito')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('onça ou tatu, atacante')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('@amigo onça atacante')).toEqual({ tipo: 'IGNORADO' });
      expect(interpretar('vai onça!')).toEqual({ tipo: 'IGNORADO' });
    });
  });
});
