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
  it('lê o @ do Candidato', () => {
    expect(interpretar('CRAQUE @Rafa_Capivara')).toEqual({ tipo: 'VOTO', username: 'rafa_capivara' });
    expect(interpretar('craque @bia.onca!!! 🔥')).toEqual({ tipo: 'VOTO', username: 'bia.onca' });
  });

  it('sem @ é inválido', () => {
    expect(interpretar('CRAQUE rafa')).toEqual({ tipo: 'INVALIDO', prefixo: 'CRAQUE', motivo: 'SEM_CANDIDATO' });
  });
});

describe('Comentários sem Comando', () => {
  it.each(['que jogaço!', 'vou entrar na capivara', '@amigo entro capivara ata', 'quero ENTRO CAPIVARA ATA', ''])('%s → ignorado', (texto) => {
    expect(interpretar(texto)).toEqual({ tipo: 'IGNORADO' });
  });
});
