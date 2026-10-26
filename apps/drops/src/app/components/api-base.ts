// A dónde habla el reproductor. En Vercel apunta al API nuevo (test-api / api .brutal.lat + /drops).
// Lo fija la variable VITE_API_URL al compilar.
export const API_BASE: string = ((import.meta as any).env?.VITE_API_URL ?? '').replace(/\/+$/, '');
