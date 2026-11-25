# ADR-0114: Capitão ativo — a faixa sai de quem fica parado

**Status:** aceito (25/11/2026)

## Contexto

O Técnico perde o cargo depois de 3 jogos sem decidir (ADR-0111), mas o Capitão não tinha regra
nenhuma: o primeiro da ordem (mais Partidas pelo Time, com Vínculo) ficava com a faixa mesmo sem
nunca escolher Formação, Postura ou qualquer outra coisa. Capitão e Técnico precisam ser pessoas
ativas na Liga.

## Decisão

- **Prazo:** o Capitão que passa **3 jogos do Time** (Liga e Copa na mesma conta) sem nenhuma
  escolha de Capitão perde a faixa. A conta começa quando ele pega a faixa (ou quando a regra
  entrou no ar) e recomeça a cada escolha.
- **O que conta:** qualquer escolha de Capitão que valeu: Formação, Postura, titulares fixados,
  Sugestão ao Técnico, Batedores, cobradores de escanteio, Marcação individual, Grito da
  Temporada ou Chamada da Presença. Confirmar só a própria Presença não segura a faixa.
- **Quem perdeu:** sai da ordem da faixa até a Temporada seguinte. Vale também para o Capitão
  posto à mão pelo dono (ADR-0079): a faixa à mão sai, e o dono pode pôr de novo se quiser.
- **Quem recebe:** o próximo da ordem com Vínculo, não suspenso e ativo (confirmou Presença ou fez
  escolha de Capitão nos últimos 3 jogos do Time). Ele fica com a faixa à mão (origem
  `ATIVIDADE`), na frente da ordem. Sem ninguém ativo, segue a ordem normal.
- **Aviso:** Aviso pessoal no App para quem recebe ("A faixa é sua") e para quem perdeu.
- **Quando:** a coleta confere a faixa de cada Time; vale já nos jogos que faltam da T2. A
  Temporada que conta é a em andamento (ou a mais nova, na Pré-temporada).

## Consequências

- Tabelas `capitao_faixa` (quem está com a faixa e desde quando), `capitao_escolha` (última
  escolha de Capitão de cada pessoa) e `capitao_inativo`; `capitao_a_mao.origem` separa a faixa
  do dono da troca por atividade.
- Com Técnico, o Capitão também precisa mexer no que é dele (Batedores, escanteio, Marcação,
  Grito, Chamada ou Sugestão) para manter a faixa.
