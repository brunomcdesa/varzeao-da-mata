# 0103 — Domínio próprio varzeaodamata.com.br

- Status: aceito (escolhido pelo dono em 23/11/2026)
- Data: 2026-11-23

## Contexto

O site e o App (PWA, ADR-0040) ficavam em `varzeao-da-mata.pages.dev`. O dono registrou `varzeaodamata.com.br` para ter um endereço próprio e criar contas da Liga em outros lugares. Havia a sugestão de mudar a hospedagem para a Vercel.

Para o navegador, outro domínio é outro site. O App instalado, a sessão do Vínculo, os votos e a inscrição nos Avisos (localStorage e assinatura de push) ficam presos ao domínio antigo e não passam sozinhos para o novo.

## Decisão

1. A hospedagem continua no Cloudflare Pages. O domínio é ligado em **Custom domains**, com os servidores DNS do Registro.br apontando para a Cloudflare. A Vercel foi descartada: o plano grátis é só para uso não comercial e a mudança refaria o deploy sem ganho.
2. `https://varzeaodamata.com.br` vira o endereço oficial e o padrão do código (link de Vínculo, contato dos Avisos). A variável `LIGA_SITE_URL` continua mandando, se existir.
3. O endereço antigo segue no ar. Nele, no lugar do convite para instalar, o site mostra a placa "O Varzeão mudou de endereço", sem "Agora não", com o link para a mesma página no domínio novo. Só o endereço principal antigo mostra a placa; as prévias de branch não.
4. Redirecionar o `.pages.dev` fica para depois, quando a maioria já tiver migrado.

## Consequências

- Quem migra instala o App de novo, refaz o Vínculo e reativa os Avisos no domínio novo.
- O Turnstile precisa ter o hostname novo, senão o desafio falha no domínio novo.
- O e-mail do domínio fica desligado (MX nulo, SPF e DMARC de rejeição) até alguém pedir o Email Routing.
