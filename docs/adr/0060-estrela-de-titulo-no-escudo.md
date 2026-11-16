# Estrela de Título no escudo

Status: decidido em 16/11/2026. Implementado no branch `estrela-de-titulo`.

O Time que ganha a Temporada passa a ter uma estrela acima do escudo, como os clubes de verdade.

## Decisões

- **Desenho:** estrela em pixel art (7×7) acima do escudo, centralizada, sem cobrir o bicho nem
  a borda. Várias estrelas ficam lado a lado, encostadas pelo contorno; até 3 cabem na largura
  do escudo, e o máximo desenhado é 5.
- **Cor:** dourada para o Título da Série A (ou da Liga inteira, na T1) e prata para o da Série
  B. As douradas vêm antes das pratas.
- **Quando:** a estrela só aparece quando a Temporada seguinte já foi criada (a Pré-temporada
  abre no job do Craque da Temporada, às 18h do dia seguinte à Final). Entre a Final e esse
  momento, o escudo fica como estava. Regra: contam os Títulos das Temporadas anteriores à
  última criada (`estrelasDosTimes`).
- **Onde:** em todo lugar que usa o escudo: site, Ao Vivo, Replay, Reels e cartelas. O worker
  calcula as estrelas (`estrelasNoBanco`) e as manda no liga.json e nos dados de cada Reels.
- **Escudo pequeno não tem estrela:** abaixo de 1,5× no site e de 72 pixels de altura no vídeo
  (Tabela, listas), a estrela viraria um ponto e invadiria a linha de cima.
- **Cartela do Campeão** (Reels) fica sem estrela, porque o título "Campeão!" está logo acima do
  escudo. No site, o destaque do campeão abre espaço para a estrela em vez de invadir o título.
- **O escudo ocupa o mesmo lugar** com ou sem estrela: no vídeo a estrela é desenhada fora da
  caixa do escudo; no site a imagem sobe com margem negativa.

## Consequências

- Não é mudança de simulação: VERSAO_SIM não muda. Replay de Partida antiga mostra o escudo de
  hoje (com as estrelas atuais), porque o escudo é a identidade do Time, não da Partida.
- Os PNGs exportados dos escudos (`pnpm gravar --escudos`) e o Reels de agradecimento da T1
  seguem sem estrela.
