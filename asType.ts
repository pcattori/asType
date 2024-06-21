// prettier-ignore
type AsType<T> =
  // tuple & array
  T extends [] ? [] :
  T extends readonly [infer F, ...infer R] ? [AsType<F>, ...AsType<R>] :
  T extends readonly (infer M)[] ? AsType<M>[]:

  // Map & Set
  T extends Map<infer K, infer V> ? Map<AsType<K>, AsType<V>> :
  T extends Set<infer M> ? Set<AsType<M>> :

  // Function
  T extends (...args: (infer Args)) => infer Return ? (...args: AsType<Args>) => AsType<Return> :

  // Use a mapped type to (recursively) convert interfaces to types
  T extends object ? { [K in keyof T]: AsType<T[K]> } :

  T

export function asType<T>(t: T): AsType<T> {
  return t as any
}
