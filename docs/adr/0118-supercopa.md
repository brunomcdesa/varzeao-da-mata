# ADR-0118: Supercopa — campeão da Série A × campeão da Copa, abrindo a Temporada

**Status:** aceito (27/11/2026)

## Contexto

A Copa A+B (ADR-0088) começou na T3, e os ADRs 0088 e 0092 deixaram a Supercopa (campeão da Liga
× campeão da Copa) para quando houvesse um campeão da Copa: a T4. O dono decidiu como ela
funciona em 27/11/2026, depois de uma rodada de perguntas sobre lacunas.

## Decisão

- **Quem joga:** o campeão da Série A e o campeão da Copa da Temporada anterior. Se o mesmo Time
  ganhou os dois, entra o vice da Série A (quem perdeu a Final dela). A Série B fica de fora.
- **Quando:** abre a Temporada seguinte, a partir da T4. Domingo às 18h, o dia seguinte ao
  nascimento da Temporada (no sábado, com o Craque da Temporada). A Copa passa a começar na terça
  (a Pré-temporada cresce um dia), e a Fase de Liga segue 3 dias depois do início da Copa. Na T4:
  Final da Série A da T3 na sexta 11/12/2026, Supercopa no domingo 13/12, Copa na terça 15/12 e
  Fase de Liga na sexta 18/12.
- **Janela de Transferências:** fechada do nascimento da Temporada até a Supercopa terminar (o
  fim do Ao Vivo dela). Pedidos, Convites e Trocas casadas são recusados com "a Janela abre depois
  da Supercopa". Abre ao fim da Supercopa e fecha no Corte do primeiro jogo da Copa, como antes.
- **Elenco:** só joga a Supercopa quem estava no Elenco na Final da Série A da Temporada anterior
  (inscrito até o Corte dela). Quem chega depois entra no Elenco, mas estreia na Copa.
- **Jogo:** jogo único, com Disputa de pênaltis no empate. Vale Clássico só pela regra de sempre
  (os dois rivais). Cartões não valem nada fora dela: ninguém fica suspenso nem pendurado pela
  Supercopa, e ninguém cumpre Suspensão nela. Ela não conta para o Capitão ativo (ADR-0114), nem
  para o Craque e a Seleção da Temporada, nem para o Título da Série.
- **Prêmio:** Título da Supercopa no Time e na Carreira (troféu próprio no site) e 20 Moedas
  para quem entrou em campo pelo campeão e para o Técnico ativo dele. Sem estrela no escudo.
- **Divulgação:** Reels do jogo (#supercopa) e Resumo do dia com o Craque da Supercopa, numa
  lista só de 5 Candidatos votada pelo número, e a cartela do campeão. O Resumo da Temporada
  anterior anuncia o jogo e o dia.

## Consequências

- A Supercopa mora na Rodada 100 do Mata-mata, com `partida.copa_etapa = 'SUPERCOPA'`
  (migração 035) e `temporada.campeao_supercopa_id`. As contas "só da Série" (`copa_etapa IS
  NULL`) já a deixam de fora; as da Copa a excluem pelo nome. O "primeiro jogo" que fecha a Janela
  não conta a Supercopa.
- `criarTemporada` cria a Supercopa 2 dias antes do primeiro dia da Copa; o job do Craque da
  Temporada passa o início da próxima como Final + 4 dias quando vai haver Supercopa.
- `fecharSupercopaPendente` (nos jobs `escalar` e `resumo`) grava o campeão e paga o Título.
- Ainda não existe o Reels Programado de Abertura da T4: quando ele for feito, deve anunciar a
  Supercopa e o fechamento da Janela até ela.
