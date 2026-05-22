import React, { useEffect, useState } from 'react';
import { CartItem, Product, StoreSettings } from '../types';
import { ShoppingBag, Star, CreditCard, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CustomerDisplay: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [featuredProduct, setFeaturedProduct] = useState<Product | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'customer_display_data') {
        const data = JSON.parse(e.newValue || '{}');
        setCart(data.cart || []);
        setSubtotal(data.subtotal || 0);
        setTaxes(data.taxes || []);
        setTotal(data.total || 0);
        setFeaturedProduct(data.featuredProduct || null);
        setStoreSettings(data.storeSettings || null);
      }
    };

    // Initial load
    const initialData = JSON.parse(localStorage.getItem('customer_display_data') || '{}');
    if (initialData.cart) {
      setCart(initialData.cart);
      setSubtotal(initialData.subtotal);
      setTaxes(initialData.taxes);
      setTotal(initialData.total);
      setFeaturedProduct(initialData.featuredProduct);
      setStoreSettings(initialData.storeSettings);
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Rotate attractive media
  useEffect(() => {
    if (featuredProduct || !storeSettings?.kioskMedia?.length) return;

    const currentMedia = storeSettings.kioskMedia[currentMediaIdx];
    const duration = (currentMedia?.duration || 10) * 1000;

    const timer = setTimeout(() => {
      setCurrentMediaIdx(prev => (prev + 1) % storeSettings.kioskMedia!.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [featuredProduct, storeSettings?.kioskMedia, currentMediaIdx]);

  return (
    <div className="fixed inset-0 bg-white flex overflow-hidden font-sans">
      {/* Left Side: Order Details */}
      <div className="w-1/3 flex flex-col border-r border-gray-100 h-full">
        <div className="p-8 border-b border-gray-50 flex items-center gap-4">
          {storeSettings?.logoUrl ? (
            <img src={storeSettings.logoUrl} alt="Logo" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <ShoppingBag className="text-gray-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
              {storeSettings?.nombre || 'MASTER OMNI POS'}
            </h1>
            <p className="text-sm font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              Terminal de Cliente
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="popLayout">
            {cart.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full flex flex-col items-center justify-center text-gray-300 space-y-6"
              >
                 <div className="w-32 h-32 border-4 border-gray-100 rounded-[2.5rem] flex items-center justify-center">
                   <ShoppingBag className="w-16 h-16" />
                 </div>
                 <div className="text-center">
                   <h2 className="text-4xl font-black text-gray-400 uppercase tracking-tight">¡Hola!</h2>
                   <p className="text-lg font-bold uppercase tracking-widest mt-2">Estamos listos para tu pedido</p>
                 </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <motion.div
                    key={item.cartId}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-6 p-4 rounded-3xl bg-gray-50/50 border border-gray-100"
                  >
                    <div className="w-20 h-20 bg-white rounded-2xl border border-gray-100 overflow-hidden shrink-0">
                      {item.imagenUrl && <img src={item.imagenUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-xl text-gray-800 tracking-tight">{item.nombre}</h3>
                      {item.descripcion && (
                        <p className="text-sm text-gray-500 font-medium">{item.descripcion}</p>
                      )}
                      {item.promo?.type === 'combo' && item.promo.items && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.promo.items.map((comboItem, cidx) => (
                            <span key={cidx} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-tight">
                              {comboItem.cantidad}x {comboItem.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm font-bold text-gray-400">
                        {item.cantidad} x ${item.precio.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-2xl text-gray-900tracking-tighter">
                        ${(item.cantidad * item.precio).toFixed(2)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-8 bg-white border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-gray-500 font-bold uppercase tracking-widest text-sm">
            <span>Subtotal</span>
            <span className="font-black text-gray-900">${subtotal.toFixed(2)}</span>
          </div>
          {taxes.map((tax, i) => (
            <div key={i} className="flex justify-between text-gray-500 font-bold uppercase tracking-widest text-sm">
              <span>{tax.name}</span>
              <span className="font-black text-gray-900">${tax.amount.toFixed(2)}</span>
            </div>
          ))}
          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-end">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Total a pagar</p>
              <h2 className="text-4xl font-black text-gray-900 uppercase">Total</h2>
            </div>
            <div className="text-right">
              <span className="text-6xl font-black text-green-600 tracking-tighter">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Visual / Featured / Welcome */}
      <div className="w-2/3 bg-black flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {featuredProduct ? (
            <motion.div 
              key="featured"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex flex-col pt-12 items-center p-12 text-center z-20"
            >
              <div className="w-full h-full max-h-[50vh] max-w-2xl mb-12 rounded-[3.5rem] overflow-hidden border-[12px] border-white/5 shadow-2xl relative">
                <img src={featuredProduct.imagenUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 right-8 text-left">
                  <span className="bg-yellow-400 text-black px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-widest mb-4 inline-flex items-center gap-2">
                    <Star className="w-4 h-4 fill-current" /> Destacado
                  </span>
                  <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight uppercase leading-none mt-2">
                    {featuredProduct.nombre}
                  </h2>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-gray-400 font-bold text-2xl md:text-3xl uppercase tracking-[0.3em]">Precio Especial</p>
                <div className="flex items-center justify-center gap-6">
                   {featuredProduct.descuento > 0 && (
                     <span className="text-3xl md:text-5xl text-gray-500 line-through font-black decoration-red-500">
                       ${featuredProduct.precio.toFixed(2)}
                     </span>
                   )}
                   <span className="text-7xl md:text-9xl font-black text-yellow-400 tracking-tighter">
                     ${(featuredProduct.precio * (1 - (featuredProduct.descuento || 0)/100)).toFixed(0)}
                   </span>
                </div>
                {featuredProduct.promo && (
                  <div className="inline-flex items-center gap-4 px-8 py-4 bg-white/5 border border-white/10 rounded-3xl">
                    <Tag className="w-8 h-8 text-indigo-400" />
                    <span className="text-2xl font-black text-white uppercase tracking-widest">
                       {featuredProduct.promo.type === 'quantity' ? `Lleva ${featuredProduct.promo.quantity}x por $${featuredProduct.promo.price}` : 'Combo Especial'}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ) : storeSettings?.kioskMedia?.length ? (
            <motion.div
              key={`media-${currentMediaIdx}`}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute inset-0 z-0"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 z-10" />
              {storeSettings.kioskMedia[currentMediaIdx].type === 'video' ? (
                <video
                  src={storeSettings.kioskMedia[currentMediaIdx].url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={storeSettings.kioskMedia[currentMediaIdx].url}
                  alt="Promotion"
                  className="w-full h-full object-cover"
                />
              )}
              {/* Removed Branding Overlay as per request */}
            </motion.div>
          ) : (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center"
            >
              <motion.div 
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 10, repeat: Infinity }}
                className="mb-12"
              >
                <Star className="w-32 h-32 text-blue-500 fill-blue-500/20" />
              </motion.div>
              <h1 className="text-8xl font-black text-white tracking-tighter uppercase leading-none">
                ¡Bienvenidos!
              </h1>
              <p className="text-2xl text-gray-400 font-bold uppercase tracking-[0.5em] mt-12">
                Disfruta de nuestra selección especial
              </p>

              <div className="mt-24 grid grid-cols-2 gap-6 w-full max-w-2xl">
                <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center gap-4">
                  <CreditCard className="w-8 h-8 text-blue-500" />
                  <span className="text-xs font-black text-white uppercase tracking-widest text-left">Aceptamos todas las tarjetas</span>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center gap-4">
                   <Tag className="w-8 h-8 text-yellow-500" />
                   <span className="text-xs font-black text-white uppercase tracking-widest text-left">Pregunta por nuestras promos</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[150px] -mr-48 -mt-48 rounded-full" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 blur-[150px] -ml-48 -mb-48 rounded-full" />
      </div>
    </div>
  );
};
