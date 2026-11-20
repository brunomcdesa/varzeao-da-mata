# 0087 — Moedas, Salário e Loja na T3

- Status: aceito
- Data: 2026-11-20

## Contexto

Para a T3, a Liga quer um motivo a mais para o Jogador acompanhar todas as Rodadas e personalizar o próprio boneco. Hoje o dono já escolhe de graça, pelo site, a Aparência (pele, cor do cabelo e penteado) e o Número da camisa (ADR-0075). Não existe nada que o Jogador junte ao longo da Carreira para gastar.

O cuidado principal é não criar "pagar para ganhar": o equilíbrio do OVR, do rodízio e da Escalação foi construído com cuidado (ADR-0047, ADR-0056), e cair para a Série B não pode virar punição (ADR-0062).

## Decisão

**Moedas só compram visual.** Não mexem em OVR, Habilidade, Escalação, rodízio nem Transferência.

**Salário e prêmios** (pagos em Moedas, iguais na Série A e na B, exceto o Título):

| Origem | Moedas |
|---|---|
| Salário por Rodada, para todo o Elenco (jogando ou não) | 10 |
| Gol | 3 |
| Assistência | 2 |
| Seleção da Rodada | 5 |
| Craque da Rodada | 10 |
| Título da Série A | 50 |
| Título da Série B | 30 |

- Cartão não desconta Moedas: a suspensão já é a punição, e o saldo nunca fica negativo.
- Quem não tem Vínculo recebe normalmente e gasta quando fizer o Vínculo.
- Tudo começa do zero na Pré-temporada da T3, sem cálculo retroativo; a Copa (ADR-0088) já paga Moedas. Bônus de largada: 20 Moedas por Temporada jogada (T1 e/ou T2).
- Outras fontes de Moedas, decididas depois: Palpite (ADR-0089), Conquistas (ADR-0090) e Título da Copa (ADR-0088).

**Loja**

- Fica no site e no App, na página do Jogador, e só quem tem Vínculo compra.
- O que hoje é grátis continua grátis: pele, cor do cabelo, os 4 penteados e o Número da camisa. A Loja vende só itens novos.
- Preços: Item básico 20 Moedas (cerca de 2 Rodadas de Salário), Item raro 100 Moedas (cerca de uma Temporada de quem joga sempre e faz alguns lances).
- Item comprado é permanente na Carreira; o Jogador pode trocar o item equipado sem pagar de novo.
- Lançamento em fases: na abertura da T3, Chuteira colorida e Acessórios (munhequeira, faixa na cabeça, luva colorida do goleiro); no meio da T3, Penteados e barba novos e a Comemoração de gol.
- A Comemoração de gol é curta (cerca de 1 s) e aparece no Reels, no Ao Vivo e no Replay. O Narrador só comenta se ela aparece na tela.
- A Escalação guarda o visual da época (itens equipados), como já faz com o Número da camisa: Partidas já jogadas nunca mudam.
- Itens são públicos (página de Carreira); saldo e extrato só aparecem para quem tem Vínculo com o Jogador.

**Divulgação:** Reels próprio "Salário e Loja" na série de novidades da T3 (ADR-0092), gerado e postado sozinho no horário marcado depois da aprovação da prévia; outro Reels anuncia a segunda fase.

## Consequências

- Antes de implementar, as prévias dos itens em pixel art passam pela aprovação do dono da Liga.
- Itens que aparecem no boneco entram na chave do cache de sprites e na Escalação; a Comemoração de gol muda o vídeo e sobe a VERSAO_SIM só se mexer na timeline da simulação (a ideia é que seja só do renderer).
- O extrato precisa de um registro por lançamento (Salário, prêmio, bônus, compra), para o saldo ser auditável e as regras novas ganharem teste.
- Os valores podem ser revistos entre Temporadas, nunca no meio de uma.
