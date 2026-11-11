# O App é o site instalável (PWA)

Para a Temporada 2, quem acompanha a Liga pode ter o Varzeão como App no celular. Em vez de um aplicativo de loja, o App é o próprio site instalado como PWA: ícone na tela inicial, abre em tela cheia e sem a barra do navegador.

## Por quê

- **Uma base só.** O site já é uma SPA estática no Cloudflare Pages. Cada atualização do site chega no App na hora, sem revisão de loja.
- **Sem custo.** A App Store cobra US$ 99 por ano e a Play Store exige, para conta pessoal nova, um teste fechado com 12 testadores por 14 dias. Isso fica para depois, se o público pedir (a mesma PWA pode ir para a Play Store como TWA).
- **Notificações possíveis.** Instalada, a PWA pode receber Web Push no Android e no iPhone (iOS 16.4 ou mais novo). Ficam para uma etapa própria, porque pedem assinaturas guardadas na borda e chaves VAPID nos segredos.

## Como funciona

1. `manifest.webmanifest` com nome, ícones (feitos a partir do escudo, incluindo a versão com margem para ícone recortado) e `display: standalone`.
2. `sw.js` cuida só dos arquivos do próprio site: rede primeiro (o App nunca fica com versão velha) e, sem conexão, abre a última versão guardada. Os dados da Liga (R2) e a API da borda passam direto, sem cache.
3. No topo do site aparece a placa **"Tenha o Varzeão no celular"**, com o jeito certo para cada aparelho (`comoInstalar` em `site/src/instalacao.ts`):
   - navegador com pedido nativo (Chrome no Android): botão **Instalar o App**;
   - iPhone e iPad: Compartilhar → Adicionar à Tela de Início;
   - Android sem pedido nativo: pelo menu do navegador;
   - navegador de dentro do Instagram: abrir a página no navegador do celular, porque ali não dá para instalar;
   - já aberto como App, ou computador sem pedido nativo: a placa não aparece.
4. "Agora não" esconde a placa por 7 dias.

## Consequências

- No iPhone, o App instalado tem armazenamento separado do Safari. Quem vinculou o personagem pelo Safari (ADR-0013) precisa vincular de novo dentro do App.
- No iPhone, a instalação é sempre manual: não há pedido automático. A placa e os posts precisam ensinar o caminho.
