# Escolha manual do dono: Inscrição forçada e mover Jogador

A regra de equilíbrio (nenhum Elenco passa o menor por mais que `FOLGA_DE_ELENCO`) vale para quem se inscreve ou transfere sozinho, pelo comentário ou pelo site. O dono da Liga às vezes precisa colocar alguém num Time específico mesmo com o Time no limite (ex.: completar uma posição vazia, como os zagueiros da Onça).

- **Inscrição forçada:** o workflow `inscrever-jogador` ganhou o campo `forcar`. Marcado, o Jogador entra no Time e na posição pedidos sem passar pela regra de equilíbrio. Desmarcado, segue igual ao ENTRO (Time cheio realoca).
- **Mover Jogador:** o workflow `mover-jogador` (`pnpm liga mover`) muda o Time e, se vier, a posição de um Jogador já inscrito. Não passa pela regra de equilíbrio e não gasta a Transferência da Temporada (não grava em `transferencia`). Ele leva as Habilidades; o OVR é o delas na posição nova. A camisa vai junto, a não ser que o número já tenha dono no Time novo. Vale a partir do próximo Corte; Escalações já feitas não mudam.

Os dois são só manuais (Actions, ambiente PROD) e não respondem no Instagram. A mensagem para a pessoa, se houver, sai com a aprovação do dono.
