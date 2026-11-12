import { describe, expect, it } from 'vitest';
import { desfechoDoMataMata } from '../src/mataMata.js';

describe('placa do Mata-mata no apito final (ADR-0048)', () => {
  const r = { vencedor: 'mandante' as const, times: { mandante: 'ONC' as const, visitante: 'CAP' as const } };
  it('Semifinal: quem foi pra Final', () => {
    expect(desfechoDoMataMata({ mataMata: { etapa: 'SEMIFINAL', temporada: 1, serie: null } }, r)).toBe('Onça está na Final!');
  });
  it('Final: o campeão da Temporada, com a Série quando há duas', () => {
    expect(desfechoDoMataMata({ mataMata: { etapa: 'FINAL', temporada: 1, serie: null } }, r)).toBe('🏆 Onça campeão da Temporada 1');
    expect(desfechoDoMataMata({ mataMata: { etapa: 'FINAL', temporada: 2, serie: 'B' } }, r)).toBe('🏆 Onça campeão da Série B da Temporada 2');
  });
  it('Fase de Liga: nada', () => {
    expect(desfechoDoMataMata({}, r)).toBeNull();
  });
});
