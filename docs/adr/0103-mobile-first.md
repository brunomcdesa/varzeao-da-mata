# 0103 — Site com jeito de app no celular (mobile-first)

- Status: aceito (sugestão do Paulo, aprovado pelas prévias em 23/11/2026)
- Data: 2026-11-23

## Contexto

A maioria dos seguidores chega pelo Instagram, no celular, e o App (ADR-0040) é o próprio site instalado. No celular, o site ainda parecia um site encolhido: menu de 7 itens rolando de lado no topo, título grande repetido em cada página e telas compridas (Time, Jogador, Partida, Jogos) que só se percorrem rolando muito.

## Decisão

1. **Mobile-first**: o CSS novo parte do celular; a partir de 720 px volta o site de sempre (menu no topo e tudo numa página só). Nada muda nos dados nem nas rotas.
2. **Abas do App** embaixo, fixas: Rodada, Jogos, Tabela, Times e Mais. O Mais abre uma folha de baixo para cima com Jogadores, Temporada, História e Avisos de jogo, e "Meu Jogador" para quem tem Vínculo.
3. **Barra de cima de app**: escudo (telas principais) ou Voltar (telas de detalhe), o título da tela, o sino dos Avisos e, a partir da T3, a sacola da Loja com o saldo. O Voltar volta no histórico; aberto direto de um link, leva à lista de onde a tela saiu (Time → Times, Jogador → Jogadores, Partida → Jogos).
4. **Subabas** nas telas compridas, com a barra presa logo abaixo do topo:
   - Time: Escalação (com o Plano do Capitão), Elenco, Jogos, Troféus;
   - Jogador: Números (com o Comparar), OVR, Jogos;
   - Partida: Replay/Ao Vivo (Palpite antes do jogo), Escalações, Lance a lance (tocar num lance volta ao campo);
   - Jogos (Liga): Mata-mata e uma por Rodada, abrindo na Rodada da vez (a escolha Liga | Copa continua por cima);
   - Tabela: um Grupo (ou Série) por vez.
   A Subaba escolhida é lembrada enquanto o navegador estiver aberto. Com uma parte só, não há barra.
5. No computador, a barra de Subabas some e as partes voltam ao lugar de antes (CSS `display: contents`).

## Consequências

- Página nova que ficar comprida no celular pode usar `abas()` de `site/src/abas.ts`.
- O título grande da página só aparece no computador; no celular ele fica para leitores de tela e o título vai para a barra de cima.
