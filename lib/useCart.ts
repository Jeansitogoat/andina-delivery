/**
 * Carrito: re-exporta desde cartContext para que todo el código que importa useCart siga funcionando.
 * El estado del carrito vive en CartProvider (layout) y persiste al navegar.
 */
export {
  useCart,
  CartProvider,
  type CartItem,
  type CartStop,
  type CartState,
} from '@/lib/cartContext';
