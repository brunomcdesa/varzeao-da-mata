/** Uma página desenha em `main` e pode devolver uma função de limpeza (timers, animação). */
export type Pagina = (main: HTMLElement, params: string[]) => Promise<(() => void) | void>;
