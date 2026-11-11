# Vídeo no Actions sem o apt

No dia 11/11 a Partida das 12h não teve Escalação no Corte. O job `partida` das 11:25 ficou mais de 30 minutos parado no `sudo apt-get update` do passo `preparar`, que não tinha limite de tempo. A run seguinte travou no mesmo lugar, numa outra máquina. O espelho de pacotes do runner não respondia, e o job só escala depois de instalar o que a gravação precisa (ffmpeg e Chromium). Só às 12:13 a Partida rodou, com um ffmpeg baixado à parte.

**Decisão.** O passo `preparar` não usa mais o apt.

- **ffmpeg:** vem do pacote `imageio-ffmpeg` 0.7.0 do PyPI, que traz um ffmpeg estático. A versão é fixa e o arquivo é conferido pelo sha256 publicado no PyPI. Fica no `actions/cache`, então só é baixado quando o cache some.
- **Chromium:** o do Playwright é instalado sem `--with-deps`, porque o runner Ubuntu 24.04 já traz o Google Chrome e as bibliotecas de sistema dele. A pasta `~/.cache/ms-playwright` fica em cache pela versão do Playwright.
- **Verificação:** o workflow `preparar` instala tudo e confere o que a gravação usa: libx264, aac, mjpeg, atempo e libmp3lame, além de abrir o Chromium. Ele não toca no banco, no Instagram nem na nuvem. Roda a cada mudança no `preparar` e pode ser disparado à mão.

**Consequência.** A Partida não depende mais do espelho do apt. Com o cache, a instalação do vídeo leva segundos; sem ele, baixa do PyPI e do CDN do Playwright. Se o runner deixar de trazer alguma biblioteca do Chromium, o workflow `preparar` acusa. Para trocar a versão do ffmpeg, é preciso atualizar a URL, o sha256 e a chave do cache juntos.
