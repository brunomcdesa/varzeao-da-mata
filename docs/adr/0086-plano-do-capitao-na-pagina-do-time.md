# 0086 — Plano do Capitão na página do Time e campinho em qualquer Formação

- Status: aceito
- Data: 2026-11-19

## Contexto

Na estreia da T2, o campinho da página da Partida (antes do Apito Inicial e durante o Ao Vivo) desenhava todo Time como 2-2-2: em cada linha cabiam no máximo dois Jogadores, e quem passava disso ia para o meio. No 3-1-2 do Sagui, o único meia aparecia na esquerda; no 2-3-1, o único atacante também. O vídeo (renderer) já desenhava certo; só o campinho do site estava errado.

Também faltava, para quem é do Time, ver o que o Capitão planejou para o próximo jogo. O painel "Seu personagem" já mostrava isso numa linha, mas só na página do próprio Jogador.

## Decisão

- O campinho espalha cada linha pelo número de Jogadores dela: um no centro, dois como antes, três abertos (20%, 50%, 80%). Vale para a Partida e para a escalação provável.
- `escalacaoProvavel` aceita a Formação: as vagas vêm dela e a vaga sem inscrito da Posição vai para quem sobrou de outra, fora de posição, com o OVR pelos pesos da vaga (mesma regra e mesma tabela `QUEM_COBRE` da Escalação, que passa a morar no shared). Sem Formação, segue o 2-2-2 de sempre.
- Página do Time: quem tem Vínculo com um Jogador daquele Time vê o bloco **Plano do Capitão** (Formação com o mini campo e a Jogada da Formação, Postura, quem é o Capitão e o próximo jogo), e a escalação provável passa a sair na Formação escolhida. Os dados vêm do mesmo `escolha/estado` da borda, que só responde a Capitania do Time do próprio Jogador.
- Sem Vínculo, ou com Vínculo de outro Time, a página continua igual: o adversário não vê o plano antes do Corte.

## Consequências

- A Força em campo do cabeçalho do Time continua pela escalação provável no 2-2-2 (é pública).
- Nenhuma mudança na borda, no banco ou na simulação; não sobe VERSAO_SIM.
