# Partidas escalonadas, pré-simuladas e liberadas por um Cloudflare Worker

As 4 Partidas da Rodada acontecem às 12h, 14h, 16h e 18h, com o Resumo da Rodada às 19h. Cada Partida pode ser vista Ao Vivo no site e ganha um Reels próprio logo depois. Para isso, cada Partida é simulada e renderizada pelo GitHub Actions no seu Corte, 30 minutos antes do Apito Inicial, e fica guardada em segredo. Um Cloudflare Worker libera os lances no Apito Inicial e publica os Reels no horário exato, usando um cron de 1 minuto que consulta uma agenda.

Rejeitamos simular no momento do Apito Inicial porque o agendamento do Actions pode atrasar minutos, sobretudo na virada da hora, e o "ao vivo" começaria fora do horário anunciado. O Worker dispara perto do horário marcado, com poucos segundos de variação.

## Consequences

- O site recebe a lista de lances e anima a Partida no navegador com o mesmo `renderer` do vídeo. Ao Vivo, Replay e Reels mostram exatamente a mesma Partida, e o Replay não exige vídeo.
- O resultado já existe antes do Apito Inicial. O sigilo depende de o bucket dos lances ser privado e de o Worker conferir o horário pelo relógio do servidor, nunca pelo do navegador.
- Um container de mídia do Instagram expira se não for publicado em 24 horas. O Actions cria o container no Corte e o Worker o publica cerca de 36 minutos depois, com folga.
- O plano gratuito do Cloudflare permite poucos cron triggers por conta. Por isso há um único trigger de 1 minuto lendo a agenda, em vez de um trigger por Partida.
- O Worker precisa do token do Instagram. Quem renova o token (o Actions) também o grava no Workers KV.
- O Corte deixa de ser único por dia e passa a existir por Partida. Quem se inscreve à tarde pode jogar na Partida do seu Time no mesmo dia.
