# Física das corridas e contra-ataque

**Física (renderer):** a coreografia de cada lance passa a ser o destino do boneco, e não a posição dele. Uma integração com velocidade e aceleração máximas, feita uma vez quando a Timeline é criada e contínua entre os lances, decide como ele chega lá:

- quem está na jogada vai em **disparada** (`FISICA.sprint`);
- quem volta para a formação vai **trotando** (`FISICA.trote`).

Assim acaba o "teleporte" de quem faz a jogada e volta voando para a defesa. A bola sai dos pés e chega aos pés da posição real (depois da física). Isso vale para o Ao Vivo, o Replay e os Reels.

**Contra-ataque (VERSAO_SIM 4):** quando um time perde a bola (desarme ou defesa do goleiro) e o lance seguinte é do rival, há chance de ser contra-ataque. A chance é de 35% com 3 jogadores adiantados e soma 10% para cada adiantado a mais. Um zagueiro que subiu conta 4 adiantados; um escanteio, 6.

A defesa recompõe num duelo do 1º zagueiro (Defesa) contra o criador (Drible), que fica mais difícil para a defesa quanto mais gente estava adiantada.

- **Defesa recomposta:** o lance segue normal.
- **Defesa não recomposta:** o 1º zagueiro ficou para trás, então a criação é garantida.
- **Defesa não recomposta depois de escanteio** (5 ou mais adiantados): o marcador também ficou para trás, e o finalizador chuta livre.

Os resultados ficam em cerca de 2,4 contra-ataques por jogo, com 4 em cada 10 sem recomposição, e a média de gols vai de 3,75 para 3,9. Contra-ataques têm sorteio próprio, e os duelos normais são sorteados igual mesmo quando não valem. Assim, o resto da partida fica igual ao da versão 3.

**No desenho:** o time que perdeu a bola começa o lance seguinte adiantado e volta trotando, e é aí que aparece o buraco. O narrador anuncia o contra-ataque ("A defesa ficou lá na frente!").
