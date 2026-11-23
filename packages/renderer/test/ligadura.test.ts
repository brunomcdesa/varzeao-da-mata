import { describe, expect, it } from 'vitest';
import { semLigadura } from '../src/pixel.js';

describe('Texto sem a ligadura fi/fl da fonte', () => {
  it('põe um separador invisível entre f e i ou l, sem mudar o resto', () => {
    expect(semLigadura('Semifinal e final')).toBe('Semif‌inal e f‌inal');
    expect(semLigadura('flor')).toBe('f‌lor');
    expect(semLigadura('Fora do jogo')).toBe('Fora do jogo');
  });
});
