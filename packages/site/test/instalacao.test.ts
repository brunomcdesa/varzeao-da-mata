import { describe, expect, it } from 'vitest';
import { comoInstalar, ehIos, type Aparelho } from '../src/instalacao.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const INSTAGRAM_IOS = `${IPHONE.replace(' Safari/604.1', '')} Instagram 400.0.0.0 (iPhone15,2; iOS 18_5; pt_BR)`;
const INSTAGRAM_ANDROID = `${ANDROID} Instagram 400.0.0.0 Android`;
const COMPUTADOR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const aparelho = (userAgent: string, outros: Partial<Aparelho> = {}): Aparelho => ({
  userAgent,
  abertoComoApp: false,
  temPedidoNativo: false,
  pontosDeToque: 0,
  ...outros,
});

describe('comoInstalar', () => {
  it('não oferece nada quando já está aberto como App', () => {
    expect(comoInstalar(aparelho(IPHONE, { abertoComoApp: true, pontosDeToque: 5 }))).toBe('instalado');
    expect(comoInstalar(aparelho(ANDROID, { abertoComoApp: true, temPedidoNativo: true }))).toBe('instalado');
  });

  it('no navegador do Instagram, manda abrir no navegador do celular', () => {
    expect(comoInstalar(aparelho(INSTAGRAM_IOS, { pontosDeToque: 5 }))).toBe('instagram');
    expect(comoInstalar(aparelho(INSTAGRAM_ANDROID, { temPedidoNativo: true }))).toBe('instagram');
  });

  it('usa o pedido nativo quando o navegador oferece', () => {
    expect(comoInstalar(aparelho(ANDROID, { temPedidoNativo: true }))).toBe('botao');
    expect(comoInstalar(aparelho(COMPUTADOR, { temPedidoNativo: true }))).toBe('botao');
  });

  it('no iPhone e no iPad, ensina o Adicionar à Tela de Início', () => {
    expect(comoInstalar(aparelho(IPHONE, { pontosDeToque: 5 }))).toBe('ios');
    expect(comoInstalar(aparelho(IPAD, { pontosDeToque: 5 }))).toBe('ios');
  });

  it('no Android sem pedido nativo, ensina pelo menu do navegador', () => {
    expect(comoInstalar(aparelho(ANDROID))).toBe('android');
  });

  it('no computador sem pedido nativo, não insiste', () => {
    expect(comoInstalar(aparelho(COMPUTADOR))).toBeNull();
  });
});

describe('ehIos', () => {
  it('reconhece o iPad que se apresenta como Mac pelo toque', () => {
    expect(ehIos({ userAgent: IPAD, pontosDeToque: 5 })).toBe(true);
    expect(ehIos({ userAgent: IPAD, pontosDeToque: 0 })).toBe(false);
  });
});
