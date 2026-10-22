// En qué entorno corre el panel. Test muestra una franja fija; producción pide confirmaciones más estrictas.
export type PanelEnv = 'test' | 'production';

export function panelEnv(): PanelEnv {
  return process.env.BRUTAL_ENV === 'production' ? 'production' : 'test';
}

export const envLabel: Record<PanelEnv, string> = {
  test: 'Test',
  production: 'Producción',
};
