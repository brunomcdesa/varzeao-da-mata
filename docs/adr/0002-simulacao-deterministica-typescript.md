# Simulação determinística em TypeScript, compartilhada entre backend e renderer

A Partida é decidida por um único módulo de simulação em TypeScript, puro e determinístico por seed. O backend (Node) usa esse módulo para gravar os resultados, e o renderer web (Canvas/Phaser) usa o mesmo módulo para gerar o vídeo. Assim, o que aparece no Reels é exatamente o que fica salvo no banco. Rejeitamos o backend em Kotlin/Spring Boot, apesar de ser o stack mais familiar do autor, porque manter duas implementações (Kotlin decidindo e TypeScript reproduzindo) abriria espaço para divergência entre o vídeo e a tabela.

## Consequences

- O módulo de simulação não pode usar `Math.random`, relógio ou qualquer outra fonte não determinística, apenas o gerador com seed.
- Qualquer mudança nas regras altera o resultado de seeds antigas, então cada Partida salva também guarda a versão da simulação usada.
