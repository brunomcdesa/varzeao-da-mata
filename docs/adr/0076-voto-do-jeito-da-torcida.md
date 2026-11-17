# Voto do Craque do jeito que a torcida escreve

Na votação do Craque da Temporada 1, vários comentários com número no post do Resumo da Final não entravam na contagem. O leitor só aceitava o número sozinho ("3", "#3", "3 🔥") ou CRAQUE/VOTO logo seguido do número. Frases comuns ficavam de fora: "Craque da Temporada 1" (o próprio título da votação), "Craque número 2", "craque é o 2", "Meu voto é 3", "vou de 3", "o 3", "número 5", "3 sem dúvidas", "4 @fulano" (marcando o Jogador). Além disso, um voto ignorado nunca mais era relido, e a votação da Temporada fechava às 18h sem ler os comentários feitos depois da última coleta da hora.

## Regras

- **Voto é um único número de 1 a 9** (com a letra da Série, se houver: "B3", "série B 3"). Antes do número só podem vir palavras de voto (CRAQUE, VOTO, MEU, VOU, DE, O, NÚMERO, DA TEMPORADA etc.). Depois do número vale qualquer comentário ("3 meu craque", "4 fechou a zaga"), desde que não tenha outro número ("3 e 4", "3x1" e "05" não são voto). A exceção é quem diz que é voto antes do primeiro número ("Meu voto de craque é pro 1, decidiu com 4 gols"): vale o primeiro. Os @ marcados não contam.
- **Com CRAQUE ou VOTO antes do número**, o voto vale em qualquer post, como antes. **Sem**, é voto solto e só vale no post da votação (o Resumo).
- **Releitura de voto.** Comentário que tinha sido ignorado (ou lido como CRAQUE sem candidato) e que hoje é voto volta a ser lido, mas só se estiver no post da votação aberta. Assim um voto antigo de outra Rodada não entra na votação atual. Vale o último voto de cada @, como sempre.
- **Comentário sem o id da conta.** Quando a API não traz o `from` do comentário, o @ identifica a pessoa (id provisório `sem-id:<@>`). Isso vale só para voto; Inscrição e o resto continuam exigindo a conta.
- **Última leitura antes do Craque da Temporada.** Na hora de fechar (18h do dia seguinte à Final), o job lê de novo os comentários e conta os votos feitos até as 18h. Os feitos depois ficam de fora.

## Considered Options

- **Contar qualquer comentário com número no post da votação:** rejeitada. "3 e 4", placares e comentários com dois números não dizem em quem a pessoa votou.
- **Aceitar número por extenso ("três"):** rejeitada por enquanto. "Um" e "dois" aparecem em frases que não são voto ("os dois são bons").
- **Reler votos ignorados em qualquer post:** rejeitada. Puxaria para a votação atual um "CRAQUE 1" comentado dias antes em outra Rodada.

## Consequences

- No post da votação, um comentário como "3 gols e nada" conta como voto no 3. É raro e o post é da votação.
- A primeira coleta depois desta mudança relê os votos ignorados do post da votação aberta e eles passam a contar.
