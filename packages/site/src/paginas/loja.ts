/**
 * #/loja — a Loja (ADRs 0087 e 0099). Com Vínculo: o saldo, os Itens do Jogador e o boneco dele
 * de prévia; tocar num Item mostra no boneco e o botão compra, equipa ou tira. Sem Vínculo: os
 * Itens à mostra num boneco de exemplo e o convite para vincular.
 */
import { ITEM_POR_CODIGO, coresDosItens, temMoedas, type Carteira, type ItensEquipados, type JogadorPublico } from '@liga/shared';
import { ALTURA_SPRITE, LARGURA_SPRITE, sprite, visualDoJogador, type Pose } from '@liga/renderer';
import { atualizarCarteiraDoTopo } from '../carteiraDoTopo.js';
import { jogadores, liga } from '../dados.js';
import { temporadaDoApp } from '../instalacao.js';
import { acaoDoItem, corpoDaLoja, type EstadoDaLoja } from '../loja.js';
import { carteiraDoVinculo, enviarEscolhaDoVinculo, vinculoDisponivel } from '../meuPersonagem.js';
import { html } from '../ui.js';
import type { Pagina } from './tipos.js';

const POSES: Pose[] = ['FRENTE_PARADO', 'LADO_CORRE_A', 'COSTAS_PARADO', 'FRENTE_COMEMORA'];

/** Boneco de exemplo para quem abre sem Vínculo (uniforme de um Time, sem Itens). */
const EXEMPLO = { time: 'CAP', posicao: 'ATA', username: 'varzeaodamata' } as const;

export const paginaLoja: Pagina = async (main) => {
  const l = await liga();
  if (!temMoedas(temporadaDoApp(l) ?? 0)) {
    main.innerHTML = html`<section class="placa vazio"><h1>Loja</h1><p>A Loja abre na Temporada 3, junto com as Moedas.</p></section>`.s;
    return;
  }
  const [carteira, lista] = await Promise.all([carteiraDoVinculo(), jogadores().catch(() => [] as JogadorPublico[])]);
  const eu = carteira ? lista.find((j) => j.id === carteira.jogadorId) ?? null : null;
  let estado: EstadoDaLoja = estadoDe(carteira, eu);
  let selecionado: string | null = null;
  let quadro = 0;
  let timer = 0;

  const desenhar = () => {
    const canvas = main.querySelector<HTMLCanvasElement>('.previa-boneco');
    if (!canvas) return;
    const c = canvas.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const item = selecionado ? ITEM_POR_CODIGO.get(selecionado) : null;
    const equipados: ItensEquipados = item ? { ...estado.equipados, [item.encaixe]: item.codigo } : estado.equipados;
    const base = eu ? visualDoJogador(eu.time, eu.posicao, `@${eu.username}`) : visualDoJogador(EXEMPLO.time, EXEMPLO.posicao, EXEMPLO.username);
    const pose = POSES[quadro % POSES.length]!;
    const v = { ...base, ...(eu?.numero ? { numero: eu.numero } : {}), itens: coresDosItens(equipados, estado.goleiro) };
    c.drawImage(sprite(pose, v) as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  };

  const render = (aviso?: { texto: string; ok: boolean }) => {
    main.innerHTML = html`<section class="placa loja-pagina">
      ${eu ? html`<p class="tabua-titulo">${eu.apelido ?? `@${eu.username}`}</p>` : ''}
      <h1>Loja</h1>
      ${carteira ? '' : html`<p class="legenda">${vinculoDisponivel() ? html`Para comprar, vincule o seu personagem na página do seu Jogador (em <a href="#/jogadores">Jogadores</a>). As Moedas vêm do Salário e dos prêmios.` : 'A compra abre aqui em breve.'}</p>`}
      ${corpoDaLoja(estado, selecionado)}
    </section>`.s;
    const canvas = main.querySelector<HTMLCanvasElement>('.previa-boneco');
    if (canvas) {
      canvas.width = LARGURA_SPRITE * 8;
      canvas.height = ALTURA_SPRITE * 8;
    }
    if (aviso) {
      const p = main.querySelector<HTMLElement>('.estado-loja')!;
      p.textContent = aviso.texto;
      p.className = `estado-loja ${aviso.ok ? 'sucesso' : 'erro'}`;
    }
    // Sem Vínculo não há o que comprar: o botão some e fica só a prévia.
    if (!carteira) main.querySelector('[data-acao-loja]')?.remove();
    desenhar();
  };

  const aoClicar = async (e: MouseEvent) => {
    const alvo = e.target as HTMLElement;
    const amostra = alvo.closest<HTMLButtonElement>('button[data-item]');
    if (amostra) {
      selecionado = amostra.dataset.item === selecionado ? null : amostra.dataset.item!;
      render();
      return;
    }
    const botao = alvo.closest<HTMLButtonElement>('button[data-acao-loja]');
    const item = selecionado ? ITEM_POR_CODIGO.get(selecionado) : null;
    if (!botao || !item || !carteira) return;
    const acao = acaoDoItem(item, estado);
    botao.disabled = true;
    const r = await enviarEscolhaDoVinculo(acao.tipo === 'COMPRAR' ? 'COMPRA' : acao.tipo === 'EQUIPAR' ? 'EQUIPAR' : 'TIRAR', acao.tipo === 'TIRAR' ? item.encaixe : item.codigo);
    // Com a resposta na hora, relê a Carteira (saldo e Itens) e o topo.
    const nova = r.aplicada ? await carteiraDoVinculo() : null;
    if (nova) {
      estado = estadoDe(nova, eu);
      atualizarCarteiraDoTopo(nova.saldo);
    }
    render({ texto: r.mensagem, ok: r.ok });
  };
  // `main` é o mesmo em todas as páginas: o clique sai junto na limpeza.
  main.addEventListener('click', aoClicar);

  render();
  const girar = () => {
    quadro++;
    desenhar();
    timer = window.setTimeout(girar, 1100);
  };
  timer = window.setTimeout(girar, 1100);
  return () => {
    clearTimeout(timer);
    main.removeEventListener('click', aoClicar);
  };
};

function estadoDe(c: Carteira | null, eu: JogadorPublico | null): EstadoDaLoja {
  return {
    saldo: c ? c.saldo : null,
    donos: c?.loja?.donos ?? [],
    equipados: c?.loja?.equipados ?? {},
    goleiro: c?.loja?.goleiro ?? eu?.posicao === 'GOL',
    fase: c?.loja?.fase ?? 1,
  };
}
