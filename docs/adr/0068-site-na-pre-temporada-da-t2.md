# Site na Pré-temporada da T2: os 16 Times, os Grupos e o App

Status: decidido em 17/11/2026.

O site listava os Times pelo campo `series` do `liga.json`, que só vem quando há Série B. Na T2
(só a Série A de 16, em Grupos) a página de Times, a lista de "Quer jogar?", os Avisos e o filtro
de Jogadores mostravam só os 8 fundadores. E o App, os Avisos e as telas da T2 (painel da T2 do
personagem, Carreira) só liberavam quando a T2 virava a Temporada atual do site, na estreia,
depois do Reels "Site e App" de quarta.

## Decisões

- O `liga.json` ganha `ativa`: a Temporada que aceita Inscrição agora (a mesma regra do leitor
  de comentários: na Pré-temporada, já a próxima), com os seus Times, na ordem de sempre, e os
  Grupos, na ordem da Abertura.
- O site lista os Times por ela, já na Pré-temporada (`timesDaLiga`, no shared).
- Na T2, a página de Times mostra um bloco por Grupo.
- O App, os Avisos e as telas da T2 no site valem pela Temporada ativa (`temporadaDoApp`): na
  Pré-temporada da T2 já estão liberados. A borda usa a mesma regra para aceitar a ativação.
- A Temporada "atual" do site (tabela, campeão, Craque) não muda: segue sendo a T1 até a estreia.

## Considered Options

- **Mostrar os 16 só na estreia:** rejeitada; o site ficaria diferente da Abertura na Pré-temporada.
- **Uma grade só com os 16:** rejeitada; por Grupo, como na Abertura.
- **App só na estreia, mudando o Reels de quarta:** rejeitada; o App já vale na Pré-temporada.
