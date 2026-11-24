# 0108 — Monetização: Apoiador na T3, Patrocinador na T4

- Status: aceito (decidido com o dono em 24/11/2026; prévias do Selo, dos créditos e da Faixa da Mata aprovadas)
- Data: 2026-11-24

## Contexto

O Paulo sugeriu monetizar a Liga. O objetivo é primeiro pagar os custos (Gemini, domínio, tempo) e depois crescer até virar uma renda de verdade. A conta tem menos de mil seguidores, então os recursos pagos do próprio Instagram ainda não estão disponíveis: os Presentes nos Reels pedem 5 mil seguidores, e as Assinaturas, 10 mil.

O equilíbrio da Liga foi construído para não ter "pagar para ganhar" (ADR-0087), e o Palpite paga Moedas (ADR-0089). Se as Moedas pudessem ser compradas, o Palpite passaria a pôr valor em risco em troca de prêmio. Pela Lei 14.790/2023, isso é aposta, que exige autorização do Ministério da Fazenda. Sorteios com prêmio também dependem de autorização prévia (Lei 5.768/1971).

## Decisão

**Regra de ouro.** Dinheiro real nunca compra OVR, Habilidade, vaga na Escalação, Transferência nem Moedas. As Moedas continuam ganhas só jogando. A Liga não faz bolão, Palpite valendo dinheiro nem sorteio com prêmio.

**Quem paga, e em que ordem.** Primeiro os fãs (Apoiador, já na T3), depois as marcas (Patrocinador, a partir da T4). Recursos pagos do Instagram, YouTube e Twitch ficam para quando a conta tiver os requisitos. A venda da "Liga pronta" para outros fica para quando houver números para mostrar. O crescimento anda junto com a venda: o preço do patrocínio é revisto a cada mil seguidores.

### T3: Apoiador (Apoia-se)

- A página do Apoia-se abre já, com dois níveis por mês:
  - **R$ 5:** Selo de Apoiador e nome nos créditos do Resumo da Temporada.
  - **R$ 15:** o mesmo, mais o Item de Apoiador.
- **Ligação com o Jogador:** quem apoia informa o @ no Apoia-se, e o dono roda o workflow `apoiador` com o @ e o nível. O mesmo workflow encerra o apoio quando a pessoa cancela. Quem apoia sem jogar entra só nos créditos.
- **Selo de Apoiador:** aparece na página de Carreira a partir da Pré-temporada da T3. Enquanto o apoio está ativo, o selo diz "Apoiador". Quando o apoio acaba, vira "Apoiou na T3", com as Temporadas em que a pessoa apoiou.
- **Item de Apoiador:** sai na Rodada 4 da T3, junto com a segunda fase da Loja (ADR-0101).
  - Não está à venda e não custa Moedas.
  - É de quem teve apoio de R$ 15 em algum momento.
  - É a **Faixa da Mata**: faixa dourada com a folha verde-mata nos pixels do centro. A folha separa a Faixa da Mata da Faixa dourada da Loja, que continua à venda. Por isso o Item ganhou uma segunda cor (`detalhe`).
  - Ocupa o Encaixe da Faixa como os outros Itens, e a Escalação guarda a cópia (ADR-0087).
- **Quem cancela fica com o que ganhou:** o Item continua dele, e o Selo vira o histórico. Só deixa de ganhar o Item novo de uma Temporada futura, se houver.
- **Créditos:** a lista de Apoiadores da Temporada (por @, sem valor) aparece no fim do Resumo da Temporada.
- **Divulgação:** um Reels próprio, com rascunho aprovado pelo dono, e o link na bio e no site.
- **Só vale a partir da T3:** quem apoiar durante a T2 conta como Apoiador da T3. Os créditos da T2 não existem, e o Selo só aparece no site a partir da T3.
- **Contagem:** quem apoiar antes de o Selo ou o Item estar pronto ganha os dois quando saírem, contando desde o primeiro mês.

### T4: Patrocinador

- **Espaços:**
  - Placas na lateral do campo, que aparecem no Reels, no Ao Vivo e no Replay.
  - O quadro "oferecido por" no Craque da Rodada, na Seleção da Rodada e no Resumo. Ele tem cartela na tela e uma fala curta do Narrador, só no Resumo da Rodada, para poupar a cota do Gemini e porque o Narrador só comenta o que aparece na tela.
  - A camisa de um Time, com no máximo uma marca por Time e por Temporada, na frente da camisa.
- **Placa sem patrocinador:** mostra anúncios da própria Liga (Apoia-se, App, "Anuncie aqui").
- **Partidas já jogadas nunca mudam:** a Escalação guarda os patrocinadores da época, como faz com os Itens.
- **Marcas proibidas:** bets e casas de aposta, álcool e cigarro, política (candidatos, partidos e campanhas) e clubes de futebol reais.
- **Preço:** pacote de entrada de R$ 100 por Temporada (placa e "oferecido por"), revisto a cada mil seguidores.
- **Fechamento no meio de uma Temporada:** quem fecha com uma Temporada em andamento só aparece a partir da seguinte. O que for vendido agora é vendido como "patrocinador da T4".
- **Onde procurar:** comércio de Londrina e lojas pequenas de futebol e várzea.

### Pessoas e empresa

- **Paulo:** cuida da parte comercial e ganha 30% de cada patrocínio que fechar, enquanto o contrato durar. No código, ele abre PR, que só entra no master com a aprovação do dono, e não tem acesso aos segredos do ambiente PROD.
- **Empresa:** o CNPJ é aberto quando fechar o primeiro patrocínio. O tipo de empresa será visto com um contador.

## Consequências

- O Apoiador não mexe em nada da competição. O Item de Apoiador é só visual e fica fora da Loja: `comprarItem` recusa Itens exclusivos.
- O Selo e o Item dependem do @ informado no Apoia-se. Erro de digitação se corrige rodando o workflow de novo com o @ certo.
- Os nomes nos créditos são públicos, mas o valor de cada apoio não aparece em lugar nenhum.
- O Patrocinador precisa de código novo no campo (placas), no Resumo (quadro e fala) e nos uniformes. Isso fica para a T4, com ADR próprio quando for desenhado.
