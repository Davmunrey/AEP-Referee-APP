/**
 * `Promise.all` con tope de concurrencia y el orden de entrada conservado.
 *
 * Para trabajo independiente contra la base —guardar N liquidaciones— que en
 * serie suma un viaje de ida y vuelta detrás de otro, y en paralelo sin tope
 * abre de golpe tantas conexiones como elementos.
 *
 * Como `Promise.all`, rechaza con el primer error; las tareas ya lanzadas
 * terminan igualmente, pero no se lanzan más.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]!, i);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}
