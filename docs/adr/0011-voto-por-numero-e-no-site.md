# Voto do Craque por número, também no site

O voto para Craque da Rodada e da Temporada deixa de ser "CRAQUE @fulano". Cada Candidato ganha um número (1 a 5, da maior Nota para a menor), e vota-se comentando o número ("3", ou "CRAQUE 3"). O número sozinho só conta no post do Resumo da votação aberta, para um "3" solto em outro post não virar voto. O site também recebe votos: um clique por aparelho. Votos do Instagram e do site somam igual.

Motivo: centenas de comentários com @ marcavam (e notificavam) desconhecidos nos nossos Reels. Pelo número, ninguém é marcado. A legenda do Resumo lista os Candidatos sem @; o anúncio do Craque da Temporada continua marcando o eleito, para ele saber.

## Voto no site

- A Meta desligou em dez/2024 o login do Instagram para contas pessoais (Basic Display API). O login que restou só aceita contas comerciais e de criador, então o site não tem como saber qual @ está votando.
- Um voto por aparelho: um id aleatório guardado no navegador. A borda (Cloudflare) grava `voto-site/<rodada>/<aparelho>` no KV com o número nos metadados e aceita no máximo 4 aparelhos por rede (IP) em cada votação. Com `TURNSTILE_SECRET` na borda e `LIGA_TURNSTILE_SITEKEY` no site, cada voto passa pelo anti-robô da Cloudflare.
- O job `coletar` traz os votos do KV para `voto_site` e mantém `votacao-aberta` no KV, que diz à borda qual Rodada aceita votos. O job `partida` traz os últimos antes de fechar a votação; o do Craque da Temporada, antes de decidir.
- Dá para burlar com esforço (aba anônima, outra rede). Aceito: é um prêmio de brincadeira, e o limite por rede e o Turnstile tiram o grosso.

## Considered Options

- Login com Google: um voto por conta, mais firme, mas exige login e não impede votar também pelo Instagram.
- Só no Instagram (por número): sem fricção nova, mas deixa de fora quem acompanha pelo site.
- Pesos separados para site e Instagram: mais difícil de explicar; rejeitado.
