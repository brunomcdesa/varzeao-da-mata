# Liga (nome provisório)

Jogo de futebol interativo no Instagram: seguidores se inscrevem pelos comentários, viram Jogadores de 8 Times de bichos brasileiros e acompanham as Partidas simuladas em Reels diários.

- Vocabulário: [`GLOSSARY.md`](./GLOSSARY.md)
- Arquitetura: [`docs/arquitetura.md`](./docs/arquitetura.md)
- Times e Clássicos: [`docs/times.md`](./docs/times.md)
- Decisões: [`docs/adr/`](./docs/adr/)

## Pacotes

| Pacote | Estado |
|---|---|
| `packages/shared` | Tipos de domínio, Times, Clássicos, limites de OVR |
| `packages/sim` | Motor determinístico com testes e calibração |
| `renderer`, `worker`, `site` | A fazer |

## Comandos

```bash
pnpm install
pnpm test        # testes de todos os pacotes
pnpm typecheck
pnpm calibrar    # roda 20 mil Partidas e imprime as métricas de calibração
```

## Calibração atual da sim (VERSAO_SIM 1)

| Confronto (OVR) | Forte vence | Empate | Gols/jogo |
|---|---|---|---|
| 70 × 70 | 39% | 22% | 3,5 |
| 75 × 65 | 57% | 20% | 3,6 |
| 80 × 65 | 64% | 18% | 3,6 |
| 85 × 60 | 73% | 14% | 3,8 |

A variação média de OVR por Partida fica entre 0,00 e 0,03 em todas as faixas, então não há bola de neve. Qualquer mudança em `src/parametros.ts` exige subir `VERSAO_SIM` (ADR-0002).
