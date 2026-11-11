# Avisos do App: notificações de jogo por Time

Quem instalou o App (ADR-0040) pode ativar os **Avisos**: notificações no celular sobre os Times que escolher. A partir da Temporada 2, como o App.

## O que chega

Para cada Partida de um Time seguido:

- **Escalação:** quando ela sai (a partir do Corte), uma vez por Partida.
- **Começa já:** 5 minutos antes do Apito Inicial, para a pessoa abrir o App e pegar o Ao Vivo desde o começo.
- **Gol:** no minuto seguinte ao que o gol aparece no Ao Vivo. Nunca antes, para não estragar quem está assistindo.
- **Fim de jogo:** quando o Ao Vivo acaba, com o placar (e os pênaltis no Mata-mata).

Todos os Avisos da mesma Partida usam a mesma marca (tag `partida-<id>`): o novo substitui o anterior na bandeja do celular, em vez de empilhar.

## Como funciona

1. A página `#/avisos` mostra os Times ativos; quem tem personagem vinculado já vem com o próprio Time marcado. "Ativar avisos" pede a permissão do celular, cria o endereço de notificação e manda para a borda (`POST /avisos`) com os Times. "Desativar" apaga (`POST /avisos/desativar`).
2. A borda guarda o endereço e os Times no banco (tabela `aviso_aparelho`). Não guarda @ nem nada do Jogador.
3. O job partida grava no arquivo privado da Partida os `momentos` do Ao Vivo: quando cada gol aparece, quando o Ao Vivo acaba e o placar. A conta usa a mesma Timeline do site (`timelineDaPartida`, no renderer), para o instante ser o mesmo da tela.
4. O cron da borda, só perto dos horários de jogo, lê o calendário, decide o que avisar no minuto que acabou de fechar (`avisosDoMinuto`, regra pura com testes) e manda. A cifra é aes128gcm (RFC 8291) com chaves VAPID, pela biblioteca `web-push-neo`, que roda na borda.
5. Endereço que o serviço de notificação diz que sumiu (404/410) é apagado.

## Limites

- No plano grátis do Workers, cada execução pode fazer 50 pedidos externos. A borda manda até 40 Avisos por minuto e deixa o resto numa fila no KV para o minuto seguinte. Com muita gente seguindo o mesmo Time, o último pode chegar alguns minutos depois. Se isso virar problema, o plano pago do Workers resolve (10 mil pedidos por execução).
- No iPhone, só chega com o App instalado (iOS 16.4 ou mais novo). No Android, também pelo Chrome sem instalar.
- As chaves VAPID ficam só nos segredos (borda) e na variável pública do site (`docs/implantacao.md`). Sem elas, os Avisos ficam desligados e a página explica.
