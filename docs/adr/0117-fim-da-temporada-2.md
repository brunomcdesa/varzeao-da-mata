# ADR-0117: Reels de Fim da Temporada 2 — obrigado e o presente em Moedas

**Status:** proposto (25/11/2026), aguardando a aprovação da prévia pelo dono

## Contexto

A T1 teve o Reels de agradecimento (ADR-0047) entre o Resumo da Temporada e a Abertura da T2. A T2
acaba na sexta 27/11 (Final), o Resumo da Temporada sai no sábado 28/11 às 19h e a Abertura da T3
às 21h. Na T3 chegam as Moedas (ADR-0087), e quem jogou a T1 e/ou a T2 começa com o Bônus de
largada, pago quando a T3 nasce: no sábado 28/11, por volta das 18h10, quando o job do Resumo fecha a votação
do Craque da Temporada (o código cria a T3 nessa hora, não na sexta à noite).

## Decisão

- **Reels Programado `agradecimento-t2`:** sábado 28/11 às 20h de Brasília, entre o Resumo (19h) e a
  Abertura da T3 (21h). Narrado pelo Seu Dito, no estilo de cartelas do agradecimento da T1.
- **Cartelas:** Abertura ("Fim da Temporada 2", OBRIGADO!), A Temporada 2 em números, Muito
  obrigado (com os escudos dos 16 Times), Presente: Moedas e a chamada para a T3. Sem o campeão: ele
  está no Resumo da Temporada.
- **Números do banco, na hora de gravar:** Jogadores em campo (quem entrou em campo na T2, o mesmo
  critério do Bônus de largada), Partidas jogadas e gols (sem os pênaltis da disputa). Com jogo da T2
  ainda sem resultado, não grava e o job tenta de novo.
- **Formato e escudos tirados da divisão de verdade** (`GRUPOS_DA_A_DE_16`): "16 Times em 2 Grupos".
- **Presente:** `MOEDAS.BONUS_POR_TEMPORADA` por Temporada jogada (20 para quem jogou uma, 40 para
  quem jogou a T1 e a T2), já na sacola, no site e no App, para a Loja do boneco.
- **Chamada:** "Hoje, Abertura da Temporada 3 às 21h, e a Copa começa segunda, 30/11", para ninguém
  achar que a Copa começa no sábado.
- **Texto com número na fonte de título (Jersey 10):** na Pixelify Sans o "2" parece um "8" e o "C"
  parece um "O" ("16 Times em 8 Grupos", "T8", "Oopa").

## Consequências

- `packages/renderer/src/agradecimentoT2.ts`, `gravarAgradecimentoT2` e o script
  `pnpm agradecimento-t2 --previa` para a prévia com números de exemplo.
- Disparos do cron de reserva às 21h30 e 22h (UTC) de 28/11.
- Outros Reels usam a Pixelify com números em texto pequeno; vale revisar à parte.
