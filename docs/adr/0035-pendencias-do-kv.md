# Pendências do KV: a coleta só lista o que mudou

No dia 10/11 a conta estourou o limite do plano grátis do Workers KV de 1.000 listagens por dia, às 19h12. As listagens ficaram bloqueadas até as 21h. A coleta roda a cada 10 minutos (144 vezes por dia) e listava 7 prefixos toda vez: `agenda/`, `voto-site/<rodada>/`, `voto-vinculado/<rodada>/`, `perfil-site/`, `escolha-site/`, `pedido-site/` e `vinculo/sessao/`. Só isso dava cerca de 1.000 por dia. Os jobs de Partida, o Resumo, os workflows à mão e as coletas disparadas pelo site somavam o resto. Enquanto durou o bloqueio, os votos e os pedidos do site e o vínculo não foram lidos.

**Decisão.** A borda marca numa chave só, `pendencias`, o tipo do que mudou: `votos`, `perfis`, `escolhas`, `pedidos`, `vinculos` ou `publicados`. A coleta lê essa chave (leitura é barata: 100 mil por dia), apaga a marca e lista só os prefixos marcados. A borda grava a marca apenas quando o tipo ainda não está marcado. Perfil, escolha e Transferência que a borda já aplicou na hora não geram marca.

- Quem tem Vínculo fica numa cópia, `vinculos-cache`. A coleta usa a cópia e só lista as sessões quando há marca de `vinculos`.
- Uma vez por hora a coleta varre tudo, com ou sem marca. A hora da última varredura fica no banco (`config.kv_varredura`). Isso cobre uma marca perdida e o período até a borda nova entrar no ar.
- Os jobs de Partida continuam listando tudo. Lá a Escalação precisa de todos os pedidos até o Corte, e são poucos por dia.

**Consequência.** As listagens da coleta caem de cerca de 1.000 para cerca de 170 por dia: 24 varreduras de 7 prefixos, mais o que for marcado. Uma mudança que perder a marca espera no máximo uma hora. Com isso, o plano pago (US$ 5/mês) não é necessário.
