// Event bus para comunicação entre páginas/abas do app
// Usado para notificar a aba Estoque quando a sincronização ML é concluída

const STOCK_SYNCED_KEY = 'llcontrol:stock-synced-at';
const STOCK_SYNCED_EVENT = 'llcontrol:stock-synced';

/**
 * Emite evento de sincronização de estoque concluída.
 * Funciona dentro da mesma aba (CustomEvent) e entre abas (localStorage).
 */
export function emitStockSynced() {
  // Comunicação intra-aba
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STOCK_SYNCED_EVENT));
  }

  // Comunicação entre abas (se o app estiver aberto em múltiplas abas)
  try {
    localStorage.setItem(STOCK_SYNCED_KEY, Date.now().toString());
  } catch {
    // localStorage indisponível (ex: modo privado em alguns browsers)
  }
}

/**
 * Escuta eventos de sincronização de estoque.
 * Retorna uma função de cleanup para remover os listeners.
 */
export function onStockSynced(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  // Listener intra-aba
  const customHandler = () => callback();
  window.addEventListener(STOCK_SYNCED_EVENT, customHandler);

  // Listener cross-tab (StorageEvent só dispara em OUTRAS abas)
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STOCK_SYNCED_KEY) callback();
  };
  window.addEventListener('storage', storageHandler);

  return () => {
    window.removeEventListener(STOCK_SYNCED_EVENT, customHandler);
    window.removeEventListener('storage', storageHandler);
  };
}
