# ADR-0119: Audiência do site guardada dia a dia (Cloudflare Web Analytics)

**Status:** proposto (26/11/2026), aguardando a aprovação do dono

## Contexto

O Web Analytics do Cloudflare já mede o site (cookieless, sem custo), mas o histórico é limitado a
cerca de 6 meses. Para o media kit queremos a série inteira, então os números precisam ser guardados
por nós.

## Decisão

- Um job diário (`audiencia-site`, 05h30 UTC) lê a API GraphQL do Cloudflare (`rumPageloadEventsAdaptiveGroups`)
  e grava na tabela `audiencia_site_dia` (migração 036), um dia (UTC) por linha e por recorte: `total`,
  `pagina`, `pais` e `origem` (50 maiores por dia). Cada recorte é uma consulta própria: se um campo
  falhar, os outros seguem e o job termina com erro para aparecer no Actions.
- A coleta refaz os últimos 3 dias (hoje fica de fora). Um dia só fica `fechado` (imutável) depois de
  passar um dia inteiro; antes disso a nova coleta atualiza.
- Token **separado** do `CF_API_TOKEN` (KV/R2): `CF_ANALYTICS_TOKEN`, só de leitura (Account Analytics: Read).
  Reusa `CF_ACCOUNT_ID`. `CF_WEB_ANALYTICS_SITE_TAG` (variável) é opcional.
- Só agregados: nada pessoal (LGPD).

## Consequências

- Os números são **amostrados** pelo Cloudflare: são estimativas. "Páginas vistas" e "visitas" não são
  pessoas únicas.
- O dia é UTC; Brasília fica 3 h atrás, então o "dia" do painel pode não bater com o calendário local.
- Os nomes dos campos da consulta foram conferidos só em exemplos da documentação; a primeira
  execução com o token real confirma (por isso o PR nasce como rascunho).
