# 0101 — Loja: Itens, Encaixes e o atalho no topo

- Status: aceito (aprovado pelo dono em 23/11/2026)
- Data: 2026-11-23

## Contexto

A ADR-0087 criou as Moedas e a Loja, com a primeira fase na abertura da T3: Chuteira colorida e Acessórios (munhequeira, faixa na cabeça e luva colorida do goleiro). Faltava decidir o catálogo, como os Itens aparecem num boneco de 12×16 pixels, onde a Loja fica no site e o que acontece com o jogo quando o dono troca de Item.

## Decisão

**Catálogo da primeira fase**
- Quatro Encaixes: Chuteira, Munhequeira, Faixa na cabeça e Luva do goleiro. Só um Item equipado por Encaixe.
- Cada Encaixe tem 7 cores básicas (preta, branca, vermelha, azul, verde-limão, laranja e rosa) por 20 Moedas e uma dourada rara por 100 Moedas. São 32 Itens.
- A Luva só aparece na Loja e no boneco do goleiro. Quem deixa de ser goleiro continua dono dela, mas ela não aparece.
- A compra já equipa o Item. Equipar outro do mesmo Encaixe ou tirar não custa nada. A compra é um lançamento negativo no extrato, com o código do Item, e o mesmo Item nunca é cobrado duas vezes.

**No boneco**
- Os Itens valem em todas as poses, sem desenho novo: a chuteira pinta o pé (o contorno logo abaixo do meião), a munhequeira pinta o pulso, a luva pinta a mão do goleiro (e a luva do mergulho) e a faixa pinta a terceira linha da cabeça, por cima do cabelo.
- A chuteira e a munhequeira ocupam um pixel em cada pé e em cada pulso: é o que cabe no boneco.

**Onde fica a Loja**
- A Loja é uma página própria (`#/loja`). Ela não fica no painel Meu personagem.
- O atalho fica no canto superior direito do topo, a partir da T3: uma sacola e, para quem tem Vínculo, o saldo de Moedas ao lado. Sem Vínculo aparece só a sacola, e a Loja mostra os Itens num boneco de exemplo e chama para vincular.
- Tocar num Item mostra no boneco de prévia. O botão diz o que vai acontecer: comprar (com o preço), equipar ou tirar. Sem saldo, o botão mostra o preço e a Loja diz quanto falta.

**No jogo**
- A Escalação guarda os Itens equipados no Corte (`escalacao.itens`). O Ao Vivo, o Replay e o Reels usam essa cópia: trocar de Item depois do Corte só vale para o próximo jogo, e as Partidas já jogadas nunca mudam.
- Cards, painel e Resumo mostram os Itens equipados agora. Os Itens são públicos; o saldo continua só do dono.

Não muda a simulação: a VERSAO_SIM continua a mesma.

## Consequências

- Migração 028: `item_do_jogador`, `jogador.itens` e `escalacao.itens`.
- As escolhas COMPRA, EQUIPAR e TIRAR passam pelo mesmo caminho das outras escolhas do site, e a Carteira passa a trazer a Loja do dono.
- A segunda fase entra no mesmo catálogo, com `fase: 2` (abaixo).

## Segunda fase (aprovada em 23/11/2026)

- Abre no dia da Rodada 4 da Fase de Liga da T3 (horário de Brasília) e fica aberta dali em diante. O Reels "Loja nova" sai nesse dia, às 10h.
- Três Encaixes de desenho, além dos de cor: Penteado (cabelo longo, raspado, tranças e topete), Barba (bigode, cavanhaque e barba cheia) e Comemoração de gol (aviãozinho, mortal, joelhada e dancinha).
- Penteado e Barba são básicos (20 Moedas) e usam a cor de cabelo que o dono já escolheu na Aparência. O Penteado da Loja equipado vale no lugar do penteado grátis. A Barba aparece de frente e de lado.
- A Comemoração é rara (100 Moedas). Dura cerca de 1 s no começo do destaque do gol, só em quem marcou e só em gol de jogo (não na disputa de pênaltis). Aparece no Ao Vivo, no Replay e no Reels, porque todos usam o mesmo desenho.
