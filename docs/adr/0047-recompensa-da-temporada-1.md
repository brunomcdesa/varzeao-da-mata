# Recompensa da Temporada 1

Quem acreditou na Liga desde a primeira Temporada ganha um reconhecimento e uma vantagem pequena na Temporada 2, sem criar um abismo para quem chega depois.

## Regras

1. **Quem recebe.** Todo Jogador (não banido) que se inscreveu até o Apito Inicial do último jogo da Temporada 1.
2. **Selo da Temporada 1.** Aparece na página de Carreira, no cabeçalho ("na Liga desde o começo") e no cartão da Temporada 1. É igual para todos os Times: madeira com borda dourada e uma estrela. O título de **Fundador** continua só de quem começa a T2 num Time da Série B (ADR-0036), porque é a compensação de quem desceu.
3. **Piso da Temporada 1 (OVR 63).** Quem tem OVR abaixo de 63 sobe só a Habilidade principal da Posição (FIN, PAS, DEF ou GOL) até o OVR chegar a 63. Quem já tem 63 ou mais não muda.
4. **Bônus da Temporada 1.** Nas 3 primeiras Rodadas da Fase de Liga da T2, os ganhos de Habilidade de quem tem o Selo são multiplicados por 1,5, como na Resenha (ADR-0034). Os dois somam (1,5 e 1,5 viram 2), e o teto por Partida continua o mesmo (+2, ou +4 no Clássico). As perdas não mudam.
5. **Uma vez só.** O Selo e o Piso são aplicados uma vez, na Pré-temporada da T2. Ninguém ganha o Selo depois.

## Por que um piso baixo e não nivelar em 70

Os OVRs iniciais são sorteados entre 60 e 70 (`OVR_INICIAL`). No fim da T1, os 100 Jogadores publicados no site iam de 59 a 72, com mediana 65: quase toda a diferença ainda vinha do sorteio. Nivelar em 70 subiria 93 dos 100, apagaria o que cada um conquistou em campo e deixaria os novatos da T2 (sorteados entre 60 e 70) bem atrás. O piso de 63 só corrige quem deu azar no sorteio (27 Jogadores, no máximo +4) e mantém a T1 na mesma faixa dos novatos.

## Considered Options

- **Nivelar todos em 70:** rejeitada. Recompensa mais quem jogou menos, apaga o mérito e cria um abismo para os novatos.
- **+2 em todas as Habilidades, para todos:** rejeitada. Mantém a ordem, mas aumenta a distância para os novatos e para o Jogador da Base (55).
- **Só simbólico (Selo):** rejeitada. É o mais seguro, mas não é um "presente" de verdade.
- **Fundador para todos os inscritos da T1:** rejeitada. Esvazia a compensação de quem foi para a Série B.
- **Piso de 62 ou 65:** o 62 mexe em poucos (17); o 65 sobe metade da Liga e começa a parecer nivelamento.

## Como rodar

O workflow manual `recompensa-t1` (ou `pnpm liga recompensa-t1`). Sem marcar "gravar", é a simulação: o log mostra quantos ganham o Selo e quem sobe pelo Piso, com o OVR antes e depois. Com "gravar", aplica numa transação e republica o site. O comando recusa rodar fora da Pré-temporada da T2 ou se já foi aplicado.

## Consequences

- Tabela `selo_temporada1` (migração 017), com o OVR antes e depois do Piso de cada Jogador.
- A Escalação marca `bonus_t1` (coluna nova em `escalacao`), e a simulação aplica o Bônus só com as regras da T2. Isso sobe a VERSAO_SIM para 14. A T1 continua na VERSAO_SIM_T1 (12), e nenhuma Partida já jogada muda.
- `jogadores.json` só leva o campo `seloT1` quando a Temporada atual tem as regras da T2, como o `fundador`.
- O Reels de agradecimento sai separado, logo depois da Final da T1, antes do Reels de novidades da T2. O texto e o vídeo passam pela aprovação do dono antes de sair.
