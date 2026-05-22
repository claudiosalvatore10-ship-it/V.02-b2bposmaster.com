import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, addDoc, serverTimestamp, doc, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Product, Category, CartItem, SelectedModifier, StoreSettings } from '../types';
import { ShoppingBag, ChevronLeft, ChevronRight, Check, X, CreditCard, Tag, ArrowRight, UtensilsCrossed, Monitor, Plus, Info, ArrowLeft, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QuantityControl } from './QuantityControl';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ComboImage: React.FC<{ items: { productId: string }[]; products: Product[] }> = ({ items, products }) => {
  const images = useMemo(() => {
    return items
      .map(item => products.find(p => p.id === item.productId)?.imagenUrl)
      .filter(Boolean) as string[];
  }, [items, products]);

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 text-gray-200">
        <ShoppingBag className="w-16 h-16" />
      </div>
    );
  }

  // Handle different numbers of images for a nice layout
  if (images.length === 1) {
    return <img src={images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
  }

  return (
    <div className={`w-full h-full grid ${images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'} gap-0.5 bg-gray-100`}>
      {images.slice(0, 4).map((url, idx) => (
        <div key={idx} className="w-full h-full overflow-hidden bg-white">
          <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
      ))}
      {images.length === 3 && (
        <div className="w-full h-full bg-blue-50 flex items-center justify-center">
          <Plus className="w-6 h-6 text-blue-200" />
        </div>
      )}
    </div>
  );
};

export const KioskView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [view, setView] = useState<'welcome' | 'menu' | 'checkout' | 'success'>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const [deliveryMethod, setDeliveryMethod] = useState<'Comer Aquí' | 'Para Llevar' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | null>(null);

  // Rotate attractive media
  useEffect(() => {
    if (view !== 'welcome' || !storeSettings?.kioskMedia?.length) return;

    const currentMedia = storeSettings.kioskMedia[currentMediaIdx];
    const duration = (currentMedia?.duration || 10) * 1000;

    const timer = setTimeout(() => {
      setCurrentMediaIdx(prev => (prev + 1) % storeSettings.kioskMedia!.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [view, storeSettings?.kioskMedia, currentMediaIdx]);

  // Inactivity timeout
  useEffect(() => {
    if (view === 'welcome' || view === 'success') return;

    const timeout = setTimeout(() => {
      setView('welcome');
      setCart([]);
      setDeliveryMethod(null);
      setPaymentMethod(null);
    }, 120000); // 2 minutes of inactivity

    const resetTimeout = () => {
      clearTimeout(timeout);
    };

    window.addEventListener('click', resetTimeout);
    window.addEventListener('touchstart', resetTimeout);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('click', resetTimeout);
      window.removeEventListener('touchstart', resetTimeout);
    };
  }, [view, cart]);

  // Box management (matching POS seat concept)
  const [activeBoxId, setActiveBoxId] = useState(1);
  const [boxColors, setBoxColors] = useState<Record<number, string>>({ 1: 'bg-blue-600' });
  const [availableBoxes, setAvailableBoxes] = useState<number[]>([1]);

  const cartByActiveBox = useMemo(() => cart.filter(item => (item as any).seatId === activeBoxId), [cart, activeBoxId]);
  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0), [cart]);

  const [storeId, setStoreId] = useState<string | null>(localStorage.getItem('last_store_id'));

  useEffect(() => {
    if (!storeId) return;

    const qProducts = query(collection(db, 'products'), where('storeId', '==', storeId));
    const productsUnsub = onSnapshot(qProducts, (snap) => {
      setProducts(snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .filter(p => !p.oculto && p.categoria?.toUpperCase() !== 'GENERAL' && p.precio > 0)
      );
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const qCats = query(collection(db, 'categories'), where('storeId', '==', storeId));
    const catsUnsub = onSnapshot(qCats, (snap) => {
      const cats = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Category))
        .filter(c => c.nombre.toUpperCase() !== 'GENERAL');
      setCategories(cats);
      // Default to ALL if none selected
      if (!selectedCategory) setSelectedCategory('ALL');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    const settingsUnsub = onSnapshot(doc(db, 'settings', storeId), (snap) => {
      if (snap.exists()) setStoreSettings(snap.data() as StoreSettings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `settings/${storeId}`);
    });

    return () => {
      productsUnsub();
      catsUnsub();
      settingsUnsub();
    };
  }, [storeId, selectedCategory]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'ALL') return products;
    return products.filter(p => p.categoria === selectedCategory);
  }, [products, selectedCategory]);

  const handleAddBox = () => {
    const colors = ['bg-blue-600', 'bg-purple-600', 'bg-pink-600', 'bg-orange-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-red-600', 'bg-cyan-600'];
    const nextId = Math.max(...availableBoxes) + 1;
    const color = colors[(nextId - 1) % colors.length];
    setAvailableBoxes([...availableBoxes, nextId]);
    setBoxColors({ ...boxColors, [nextId]: color });
    setActiveBoxId(nextId);
  };

  const handleAddToCart = (product: Product) => {
    const existing = cart.find(item => 
      item.id === product.id && (item as any).seatId === activeBoxId
    );
    if (existing) {
      setCart(cart.map(item => 
        (item.cartId === existing.cartId) ? { ...item, cantidad: item.cantidad + 1 } : item
      ));
    } else {
      setCart([...cart, { 
        ...product, 
        cantidad: 1, 
        cartId: Math.random().toString(36).substring(7),
        selectedModifiers: [],
        seatId: activeBoxId // Using property expected by some KDS or groupings
      } as any]);
    }
  };

  const handleUpdateQuantity = (cartId: string, quantity: number) => {
    if (quantity === 0) {
      setCart(cart.filter(item => item.cartId !== cartId));
    } else {
      setCart(cart.map(item => item.cartId === cartId ? { ...item, cantidad: quantity } : item));
    }
  };

  const handleCheckout = async () => {
    if (!storeId || !paymentMethod) return;
    setIsSubmitting(true);
    try {
      const orderData = {
        storeId,
        items: cart, // Send ALL items from ALL boxes
        articulos: JSON.stringify(cart), 
        subtotal,
        total: subtotal,
        deliveryMethod,
        metodoPago: paymentMethod === 'Efectivo' ? 'Cash' : 'Credit',
        estado: 'Pendiente',
        fecha: Date.now(),
        vendedorId: 'kiosk',
        mesa: `KIOSCO`,
        clienteId: 'CASH',
      };
      await addDoc(collection(db, 'orders'), orderData);
      
      setCart([]);
      setActiveBoxId(1);
      setAvailableBoxes([1]);
      setBoxColors({ 1: 'bg-blue-600' });
      setDeliveryMethod(null);
      setPaymentMethod(null);
      
      setView('success');
      setTimeout(() => setView('welcome'), 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!storeId) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8 bg-gray-900 text-white font-sans">
        <Monitor className="w-20 h-20 text-blue-500 mb-8" />
        <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-center">Configuración Requerida</h2>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-center max-w-md">
          Abre el POS en esta misma computadora primero para sincronizar el ID de la tienda.
        </p>
      </div>
    );
  }

  if (view === 'welcome') {
    const media = storeSettings?.kioskMedia || [];
    const currentMedia = media[currentMediaIdx];

    return (
      <div 
        className="fixed inset-0 bg-black flex flex-col items-center justify-center cursor-pointer overflow-hidden font-sans"
        onClick={() => setView('menu')}
      >
        {/* Attractive Background Media */}
        <AnimatePresence mode="wait">
          {currentMedia ? (
            <motion.div
              key={currentMediaIdx}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute inset-0 z-0"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 z-10" />
              {currentMedia.type === 'video' ? (
                <video
                  src={currentMedia.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={currentMedia.url}
                  alt="Promotion"
                  className="w-full h-full object-cover"
                />
              )}
            </motion.div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 flex items-center justify-center">
               <div className="text-center space-y-8 relative z-20">
                <div className="w-48 h-48 bg-white/10 backdrop-blur-3xl rounded-full flex items-center justify-center mx-auto border border-white/20 shadow-2xl animate-pulse">
                  <UtensilsCrossed className="w-24 h-24 text-white" />
                </div>
                <h1 className="text-8xl font-black text-white uppercase tracking-tighter">
                  BIENVENIDOS
                </h1>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Content on top */}
        {!currentMedia && (
          <div className="relative z-20 text-center pointer-events-none px-4">
            <p className="text-2xl text-blue-100 font-bold uppercase tracking-[0.4em] animate-bounce">
              Toca la pantalla para comenzar
            </p>
          </div>
        )}

        {/* Footer Call to Action */}
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center justify-end pointer-events-none"
        >
          <div className="w-full bg-[#f97316] text-white py-6 sm:py-8 flex items-center justify-center gap-6 shadow-[0_-10px_40px_rgba(249,115,22,0.4)] pointer-events-auto border-t-[8px] border-[#fdba74]">
            <span className="text-4xl sm:text-6xl font-black uppercase tracking-wider relative text-center whitespace-nowrap drop-shadow-md">
              <span className="inline-block mr-4 text-3xl sm:text-5xl">👆</span>
              Toca aquí para ordenar
              <span className="inline-block ml-4 text-3xl sm:text-5xl">👆</span>
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === 'success') {
    return (
      <div className="fixed inset-0 bg-green-500 flex flex-col items-center justify-center text-white p-8">
        <motion.div 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }} 
          className="w-48 h-48 bg-white/20 rounded-full flex items-center justify-center mb-8"
        >
          <Check className="w-24 h-24 stroke-[4]" />
        </motion.div>
        <h1 className="text-6xl font-black uppercase tracking-tighter mb-4">¡Orden Recibida!</h1>
        <p className="text-2xl font-bold uppercase tracking-widest opacity-80">Por favor, dirígete a la caja para pagar.</p>
        <p className="mt-12 text-sm uppercase font-black tracking-widest bg-black/10 px-6 py-2 rounded-full">Volviendo al inicio en unos segundos...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex overflow-hidden font-sans">
      {/* Category Sidebar */}
      <div className="w-40 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-6 border-b border-gray-50 flex justify-center">
          <UtensilsCrossed className="text-blue-600 w-8 h-8" />
        </div>
        <div className="flex-1 overflow-y-auto pt-6 px-4 space-y-4">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`w-full aspect-square flex flex-col items-center justify-center p-4 rounded-3xl transition-all ${
              selectedCategory === 'ALL' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                : 'bg-white text-gray-400 hover:bg-gray-100'
            }`}
          >
            <div className="w-12 h-12 mb-2 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tight text-center leading-tight">
              TODOS
            </span>
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.nombre)}
              className={`w-full aspect-square flex flex-col items-center justify-center p-4 rounded-3xl transition-all ${
                selectedCategory === cat.nombre 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'bg-white text-gray-400 hover:bg-gray-100'
              }`}
            >
              <div className="w-12 h-12 mb-2 flex items-center justify-center">
                {/* Fallback icon or category image if available */}
                <ShoppingBag className="w-8 h-8" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight text-center leading-tight">
                {cat.nombre}
              </span>
            </button>
          ))}
        </div>
        <button 
          onClick={() => setView('welcome')}
          className="p-6 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex justify-center"
        >
          <X className="w-8 h-8" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-8 bg-white border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight uppercase">
              {selectedCategory === 'ALL' ? 'TODOS' : selectedCategory || 'Menú'}
            </h2>
            
            {/* Box Selector - Ribbon style */}
            <div className="flex items-center gap-0.5 bg-gray-100 p-1.5 rounded-[2rem]">
              {availableBoxes.map(id => {
                const boxItems = cart.filter(item => (item as any).seatId === id);
                return (
                  <button
                    key={id}
                    onClick={() => setActiveBoxId(id)}
                    className={`relative px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                      activeBoxId === id 
                        ? `${boxColors[id]} text-white shadow-lg` 
                        : 'bg-white text-gray-400 hover:text-gray-600 border border-transparent'
                    }`}
                  >
                    Box {id}
                    {boxItems.length > 0 && (
                      <span className={`ml-2 px-1.5 rounded-md ${activeBoxId === id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                        {boxItems.length}
                      </span>
                    )}
                    {/* Ribbon indicator under active */}
                    {activeBoxId === id && (
                      <motion.div 
                        layoutId="activeRibbon"
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-inherit" 
                      />
                    )}
                  </button>
                );
              })}
              <button 
                onClick={handleAddBox}
                className="w-12 h-10 flex items-center justify-center bg-white rounded-2xl text-gray-400 hover:text-blue-600 hover:shadow-sm transition-all ml-1"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Tu Carrito</p>
              <p className="text-2xl font-black text-blue-600">${subtotal.toFixed(2)}</p>
            </div>
            <button 
              onClick={() => setShowCart(true)}
              className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 relative"
            >
              <ShoppingBag className="w-8 h-8" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white text-xs font-black rounded-full border-4 border-white flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filteredProducts.map(product => (
              <motion.div
                key={product.id}
                layoutId={product.id}
                onClick={() => handleAddToCart(product)}
                className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all group active:scale-95 border border-gray-100"
              >
                <div className="aspect-square relative overflow-hidden bg-gray-50 flex items-center justify-center">
                  {product.imagenUrl ? (
                    <img 
                      src={product.imagenUrl} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      referrerPolicy="no-referrer"
                    />
                  ) : product.promo?.type === 'combo' && product.promo.items ? (
                    <ComboImage items={product.promo.items} products={products} />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-200">
                      <ShoppingBag className="w-16 h-16" />
                    </div>
                  )}
                  {product.descuento > 0 && (
                    <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full font-black text-sm shadow-lg">
                      -{product.descuento}%
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2 line-clamp-1">{product.nombre}</h3>
                  
                  {/* Combo items list */}
                  {product.promo?.type === 'combo' && product.promo.items && (
                    <div className="mb-4 space-y-1">
                      {product.promo.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <div className="w-1 h-1 bg-blue-600 rounded-full" />
                          {item.cantidad}x {item.nombre}
                        </div>
                      ))}
                      {product.promo.items.length > 3 && (
                        <p className="text-[9px] font-black text-blue-600 uppercase">+{product.promo.items.length - 3} más...</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-blue-600">${product.precio.toFixed(2)}</span>
                    <div className="w-10 h-10 bg-gray-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl flex items-center justify-center transition-colors">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[450px] bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Mi Pedido</h3>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-8 h-8 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-12">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300">
                    <ShoppingBag className="w-24 h-24 mb-6 opacity-20" />
                    <p className="text-xl font-black uppercase tracking-widest text-gray-400">Tu carrito está vacío</p>
                  </div>
                ) : (
                  availableBoxes.filter(boxId => cart.some(item => (item as any).seatId === boxId)).map(boxId => (
                    <div key={boxId} className="space-y-4">
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${boxColors[boxId]} text-white w-fit`}>
                        <Tag className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-widest">BOX {boxId}</span>
                      </div>
                      <div className="space-y-4">
                        {cart.filter(item => (item as any).seatId === boxId).map(item => (
                          <div key={item.cartId} className="flex gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                        {/* Item image with combo merge fallback */}
                        <div className="w-20 h-20 bg-white rounded-2xl overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                          {item.imagenUrl ? (
                            <img src={item.imagenUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : item.promo?.type === 'combo' && item.promo.items ? (
                            <div className="w-full h-full scale-150"> {/* Zoom in for the small thumbnail */}
                              <ComboImage items={item.promo.items} products={products} />
                            </div>
                          ) : (
                            <ShoppingBag className="w-8 h-8 text-gray-100" />
                          )}
                        </div>
                            <div className="flex-1">
                              <h4 className="font-black text-gray-800 uppercase tracking-tight leading-tight">{item.nombre}</h4>
                              
                              {/* Combo items in cart */}
                              {item.promo?.type === 'combo' && item.promo.items && (
                                <div className="mt-1 space-y-0.5">
                                  {item.promo.items.map((comboItem, idx) => (
                                    <p key={idx} className="text-[10px] font-bold text-gray-400 uppercase">
                                      • {comboItem.cantidad}x {comboItem.nombre}
                                    </p>
                                  ))}
                                </div>
                              )}
                              
                              <p className="text-blue-600 font-black text-lg mt-1">${(item.precio * item.cantidad).toFixed(2)}</p>
                              <div className="mt-2 scale-75 origin-left">
                                <QuantityControl 
                                  quantity={item.cantidad} 
                                  onChange={(q) => handleUpdateQuantity(item.cartId, q)} 
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 border-t border-gray-100 bg-gray-50/50">
                  <div className="flex justify-between items-end mb-8">
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total a pagar</p>
                      <h4 className="text-5xl font-black text-gray-900 uppercase tracking-tighter">TOTAL</h4>
                    </div>
                    <span className="text-6xl font-black text-blue-600 tracking-tighter">
                      ${subtotal.toFixed(2)}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setShowCart(false);
                      setView('checkout');
                    }}
                    className="w-full bg-blue-600 text-white py-8 rounded-[2rem] text-3xl font-black uppercase tracking-widest shadow-2xl shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    Confirmar <ArrowRight className="w-10 h-10" />
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Checkout Selection */}
      <AnimatePresence>
        {view === 'checkout' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-white z-[60] flex flex-col"
          >
            <div className="p-8 border-b border-gray-100 flex items-center gap-8">
              <button onClick={() => setView('menu')} className="p-4 hover:bg-gray-100 rounded-3xl transition-colors">
                <ChevronLeft className="w-10 h-10 text-gray-400" />
              </button>
              <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter">Finalizar Pedido</h2>
            </div>
            
            <div className="flex-1 flex flex-row overflow-hidden">
              {/* Left Side: Options */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
                {!deliveryMethod ? (
                  <div className="w-full max-w-2xl space-y-12">
                    <div className="text-center">
                      <h3 className="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-4">¿Cómo quieres recibir tu pedido?</h3>
                      <p className="text-gray-400 font-bold uppercase tracking-widest">Elige una opción para continuar</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <button 
                        onClick={() => setDeliveryMethod('Comer Aquí')}
                        className="p-12 bg-white rounded-[3rem] border border-gray-100 shadow-xl flex flex-col items-center text-center space-y-8 hover:scale-105 transition-all group"
                      >
                        <div className="w-32 h-32 bg-green-50 rounded-[2.5rem] flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors">
                          <UtensilsCrossed className="w-16 h-16" />
                        </div>
                        <div>
                          <h3 className="text-4xl font-black text-gray-900 uppercase tracking-tight">Comer Aquí</h3>
                          <p className="text-gray-400 font-bold uppercase tracking-widest mt-2">Disfruta en nuestro local</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => setDeliveryMethod('Para Llevar')}
                        className="p-12 bg-white rounded-[3rem] border border-gray-100 shadow-xl flex flex-col items-center text-center space-y-8 hover:scale-105 transition-all group"
                      >
                        <div className="w-32 h-32 bg-orange-50 rounded-[2.5rem] flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                          <ShoppingBag className="w-16 h-16" />
                        </div>
                        <div>
                          <h3 className="text-4xl font-black text-gray-900 uppercase tracking-tight">Para Llevar</h3>
                          <p className="text-gray-400 font-bold uppercase tracking-widest mt-2">Empacamos tu comida</p>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : !paymentMethod ? (
                  <div className="w-full max-w-2xl space-y-12">
                    <div className="text-center">
                      <h3 className="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-4">Selecciona Método de Pago</h3>
                      <p className="text-gray-400 font-bold uppercase tracking-widest">El pago se procesará en el mostrador</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {(!storeSettings || storeSettings.kioskCashEnabled !== false) && (
                        <button 
                          disabled={isSubmitting}
                          onClick={() => {
                            setPaymentMethod('Efectivo');
                            handleCheckout();
                          }}
                          className="p-12 bg-white rounded-[3rem] border border-gray-100 shadow-xl flex flex-col items-center text-center space-y-8 hover:scale-105 transition-all group"
                        >
                          <div className="w-32 h-32 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Monitor className="w-16 h-16" />
                          </div>
                          <h3 className="text-4xl font-black text-gray-900 uppercase tracking-tight">Efectivo</h3>
                        </button>
                      )}

                      {(!storeSettings || storeSettings.kioskCardEnabled !== false) && (
                        <button 
                          disabled={isSubmitting}
                          onClick={() => {
                            setPaymentMethod('Tarjeta');
                            handleCheckout();
                          }}
                          className="p-12 bg-white rounded-[3rem] border border-gray-100 shadow-xl flex flex-col items-center text-center space-y-8 hover:scale-105 transition-all group"
                        >
                          <div className="w-32 h-32 bg-purple-50 rounded-[2.5rem] flex items-center justify-center text-purple-500 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <CreditCard className="w-16 h-16" />
                          </div>
                          <h3 className="text-4xl font-black text-gray-900 uppercase tracking-tight">Tarjeta</h3>
                        </button>
                      )}
                    </div>
                    
                      <button 
                        onClick={() => setPaymentMethod(null)}
                        className="mx-auto block text-gray-400 font-black uppercase tracking-[0.3em] hover:text-gray-600 transition-colors"
                      >
                        Cambiar modo de entrega
                      </button>
                      <button 
                        onClick={() => {
                          setPaymentMethod(null);
                          setDeliveryMethod(null);
                        }}
                        className="mx-auto block text-gray-300 font-black uppercase tracking-[0.2em] hover:text-gray-500 transition-colors text-xs"
                      >
                        Reiniciar Selección
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="font-black text-blue-600 uppercase tracking-widest">Procesando...</p>
                    </div>
                  )}
              </div>

              {/* Right Side: Ticket View */}
              <div className="w-[450px] bg-gray-50 border-l border-gray-100 flex flex-col p-8">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex-1 flex flex-col">
                  <div className="text-center border-b border-dashed border-gray-200 pb-6 mb-6">
                    <h4 className="text-2xl font-black uppercase tracking-tighter">Tu Ticket</h4>
                    <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Resumen del pedido</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-8 mb-6 pr-2">
                    {availableBoxes.filter(boxId => cart.some(item => (item as any).seatId === boxId)).map(boxId => (
                      <div key={boxId} className="space-y-3">
                        <div className={`p-2 rounded-lg ${boxColors[boxId]} text-white text-[10px] font-black uppercase tracking-[0.2em] text-center`}>
                          BOX {boxId}
                        </div>
                        <div className="space-y-3">
                          {cart.filter(item => (item as any).seatId === boxId).map(item => (
                            <div key={item.cartId} className="flex justify-between items-start gap-4">
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <span className="font-black text-gray-800 uppercase text-xs leading-none">{item.cantidad}x {item.nombre}</span>
                                  <span className="font-black text-gray-900 text-xs">${(item.precio * item.cantidad).toFixed(2)}</span>
                                </div>
                                {item.promo?.type === 'combo' && item.promo.items && (
                                  <div className="mt-1 space-y-0.5">
                                    {item.promo.items.map((comboItem, idx) => (
                                      <p key={idx} className="text-[9px] font-bold text-gray-400 uppercase leading-none pl-2">
                                        + {comboItem.cantidad}x {comboItem.nombre}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-dashed border-gray-200 space-y-2">
                    <div className="flex justify-between text-gray-400 font-bold uppercase tracking-widest text-xs">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-2xl font-black uppercase tracking-tighter pt-2">
                      <span>Total</span>
                      <span className="text-blue-600">${subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
