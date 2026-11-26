/** Do not turn a failed read into a misleading empty list. */
export function readData<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new Error("Não foi possível carregar os dados. Tente novamente.");
  return result.data;
}