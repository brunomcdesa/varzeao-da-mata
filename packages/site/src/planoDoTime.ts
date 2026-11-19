/**
 * Plano do Capitão na página do Time (ADR-0086): quem tem Vínculo com um Jogador do Time vê a
 * Formação e a Postura que o Capitão escolheu para o próximo jogo. Os outros não veem: o
 * adversário não pode saber antes do Corte.
 */
import { DESCRICAO_DA_FORMACAO, FORMACAO_PADRAO, POSTURAS, ehFormacao, type Formacao, type Postura, type TimeId } from '@liga/shared';
import { desenhoDaFormacao } from './formacao.js';
import { contraO, quandoDoJogo } from './presenca.js';
import { html } from './ui.js';

/** Capitania e Presença do próximo jogo do Time (borda, `escolha/estado`). */
export interface Capitania {
  eu: boolean;
  capitao: string | null;
  postura: string;
  formacao?: string;
  presenca?: boolean;
  jogo?: { apito: string; adversario: TimeId } | null;
}

export const NOME_DA_POSTURA: Record<Postura, string> = { OFENSIVA: 'Ofensiva', EQUILIBRADA: 'Equilibrada', DEFENSIVA: 'Defensiva' };

/** Postura e Formação valendo (sem escolha do Capitão: Equilibrada no 2-2-2). */
export function planoDaCapitania(c: Capitania): { postura: Postura; formacao: Formacao } {
  return {
    postura: (POSTURAS as readonly string[]).includes(c.postura) ? (c.postura as Postura) : 'EQUILIBRADA',
    formacao: ehFormacao(c.formacao) ? c.formacao : FORMACAO_PADRAO,
  };
}

/** O bloco do plano, para quem é do Time. `jogadorId`: o link do painel, quando é o Capitão. */
export function blocoDoPlano(c: Capitania, jogadorId: string, agora = new Date()) {
  const { postura, formacao } = planoDaCapitania(c);
  const d = DESCRICAO_DA_FORMACAO[formacao];
  const jogo = c.jogo ? `${quandoDoJogo(c.jogo.apito, agora)}, ${contraO(c.jogo.adversario)}` : null;
  const capitao = c.eu
    ? html`<strong>Você</strong> é o Capitão. <a href="#/jogador/${jogadorId}">Mudar no seu painel</a> até o Corte.`
    : c.capitao
      ? html`Escolha do Capitão <strong>@${c.capitao}</strong>; dá para mudar até o Corte.`
      : html`Ainda sem Capitão: vale o padrão até alguém escolher.`;
  return html`<section class="plano-do-capitao placa" aria-labelledby="titulo-plano">
    <h2 id="titulo-plano" class="secao">Plano do Capitão <small>só quem é do Time vê</small></h2>
    <div class="plano-corpo">
      ${desenhoDaFormacao(formacao)}
      <div>
        ${jogo ? html`<p class="plano-jogo">Próximo jogo: ${jogo}</p>` : ''}
        <p class="plano-escolha"><span>Formação <strong>${d.nome}</strong>${d.jogada ? html` <em class="jogada-formacao">${d.jogada}</em>` : ''}</span><span>Postura <strong>${NOME_DA_POSTURA[postura]}</strong></span></p>
        <p class="legenda">${capitao}</p>
      </div>
    </div>
  </section>`;
}
