import { describe, expect, it } from 'vitest';
import { SITE_OFICIAL, ehEnderecoAntigo, linkNoEnderecoNovo } from '../src/enderecoNovo.js';

describe('ehEnderecoAntigo', () => {
  it('reconhece o endereço principal antigo', () => {
    expect(ehEnderecoAntigo('varzeao-da-mata.pages.dev')).toBe(true);
    expect(ehEnderecoAntigo('Varzeao-da-Mata.pages.dev')).toBe(true);
  });

  it('não mostra a placa no domínio novo, nas prévias de branch nem no localhost', () => {
    expect(ehEnderecoAntigo('varzeaodamata.com.br')).toBe(false);
    expect(ehEnderecoAntigo('www.varzeaodamata.com.br')).toBe(false);
    expect(ehEnderecoAntigo('dominio-proprio.varzeao-da-mata.pages.dev')).toBe(false);
    expect(ehEnderecoAntigo('localhost')).toBe(false);
  });
});

describe('linkNoEnderecoNovo', () => {
  it('leva para a mesma página no domínio novo', () => {
    expect(SITE_OFICIAL).toBe('https://varzeaodamata.com.br');
    expect(linkNoEnderecoNovo('#/time/onca')).toBe('https://varzeaodamata.com.br/#/time/onca');
    expect(linkNoEnderecoNovo('#/vincular/abc')).toBe('https://varzeaodamata.com.br/#/vincular/abc');
  });

  it('sem página, vai para o início', () => {
    expect(linkNoEnderecoNovo('')).toBe('https://varzeaodamata.com.br/');
    expect(linkNoEnderecoNovo('#topo')).toBe('https://varzeaodamata.com.br/');
  });
});
