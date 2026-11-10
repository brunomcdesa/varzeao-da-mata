# Troca de posição mantém o OVR

Pela ADR-0012, quem trocava de posição levava as Habilidades e o OVR era recalculado com os pesos da posição nova. Na prática, isso derrubava o Jogador: um atacante com OVR 68 virava goleiro com OVR 34, porque levava GOL 31. Ficava abaixo do Jogador da Base (55) e do piso da Inscrição (60).

**Decisão.** Na troca de posição, seja pela Transferência (comentário ou site) ou pelo mover-jogador (ADR-0029), o OVR continua o mesmo. As Habilidades são refeitas no perfil da posição nova, com uma variação derivada do id do Jogador, como na Inscrição (ADR-0010). Trocar só de Time não mexe nas Habilidades.

**Correção.** Quem trocou de posição pela regra antiga volta, pelo workflow `manutencao` (corrigir-trocas-de-posicao), ao OVR que tinha na posição de antes da troca, com o perfil da posição atual. A correção só sobe o OVR. Partidas já jogadas e o histórico não mudam.

Não muda a simulação: a VERSAO_SIM continua a mesma.
