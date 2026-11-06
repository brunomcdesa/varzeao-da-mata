/** Fontes embutidas no bundle pelo esbuild (loader dataurl): o vídeo não depende de rede. */
declare module '*.woff2' {
  const url: string;
  export default url;
}

/** Imagens embutidas no bundle (loader dataurl). */
declare module '*.png' {
  const url: string;
  export default url;
}
