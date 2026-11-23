/**
 * Domínio próprio (ADR-0104): o site saiu de varzeao-da-mata.pages.dev para
 * varzeaodamata.com.br. O navegador trata os dois como sites diferentes, então
 * App instalado, Vínculo e Avisos não passam sozinhos de um para o outro.
 * No endereço antigo o site mostra a placa "O Varzeão mudou de endereço".
 */
export const SITE_OFICIAL = 'https://varzeaodamata.com.br';

/** Só o endereço principal antigo. As prévias de branch (xxx.varzeao-da-mata.pages.dev) ficam sem a placa. */
const HOST_ANTIGO = 'varzeao-da-mata.pages.dev';

export function ehEnderecoAntigo(host: string): boolean {
  return host.toLowerCase() === HOST_ANTIGO;
}

/** A mesma página no endereço novo (o site navega por #/...). */
export function linkNoEnderecoNovo(hash: string): string {
  const rota = hash.startsWith('#/') ? hash : '';
  return `${SITE_OFICIAL}/${rota}`;
}
