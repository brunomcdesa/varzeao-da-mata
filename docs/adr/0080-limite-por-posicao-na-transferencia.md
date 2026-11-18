# 0080 — Limite por Posição também na Transferência

- Status: aceito
- Data: 2026-11-17

## Contexto

O Limite por Posição (2 goleiros e 4 em cada Posição de linha, ADR-0044, ADR-0058 e ADR-0062) foi decidido para novas Inscrições e Transferências, mas só a Inscrição o aplicava. A Transferência (comentário TRANSFERIR, pedido do site e Janela da Pré-temporada) olhava apenas o equilíbrio de Elencos. Com isso, o Lobo-guará chegou a 5 atacantes.

## Decisão

- A Transferência para outro Time e a troca de Posição no mesmo Time seguem o Limite por Posição. O destino é contado sem o próprio Jogador.
- Posição cheia no destino: a troca não acontece (DESTINO_CHEIO), a Transferência não é gasta e a resposta cita até 4 Times da mesma Série com vaga nessa Posição.
- A mudança feita à mão pelo dono (ADR-0029) e a Inscrição forçada pelo workflow continuam ignorando o limite, de propósito.
- Quem já passou do limite antes desta regra: o inscrito mais recente da Posição vai para o Time do mesmo Grupo com menos gente nela (sem vaga no Grupo, o da mesma Série), na mesma Posição, sem gastar a Transferência. Isso é feito pelo workflow `limite-por-posicao`: primeiro em simulação, depois com "gravar". O aviso a quem foi movido só sai com a aprovação do dono.
