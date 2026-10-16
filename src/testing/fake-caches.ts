/** In-memory Cache API (CacheStorage) for tests. */
export function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    let store = stores.get(name);
    if (!store) stores.set(name, (store = new Map()));
    return {
      match: async (url: string) => store.get(url)?.clone(),
      put: async (url: string, response: Response) => {
        store.set(url, response);
      },
    };
  };
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
}
