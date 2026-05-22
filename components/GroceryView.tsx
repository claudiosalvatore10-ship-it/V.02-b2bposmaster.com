import React, { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, Delete, Plus, Minus, Search, 
  Trash2, CreditCard, DollarSign, Wallet, 
  Tag, Package, ChevronRight, Calculator,
  Grid, List, Sparkles, Smartphone,
  MinusCircle, PlusCircle, X
} from 'lucide-react';
import { Product, CartItem, StoreSettings, Category, Tax, BusinessCategory, Salesman, Vendor } from '../types';
import { EditCartItemModal } from './EditCartItemModal';

interface GroceryViewProps {
  products: Product[];
  categories: Category[];
  cart: CartItem[];
  onAddToCart: (product: Product, quantity: number) => void;
  onUpdateQuantity: (cartId: string, quantity: number) => void;
  onUpdateItem?: (cartId: string, updates: Partial<CartItem>) => void;
  onRemoveItem: (cartId: string) => void;
  onCheckout: (details?: { invoiceNumber: string, checkRef: string, vendorId: string }) => void;
  storeSettings: StoreSettings;
  businessCategory: BusinessCategory | null;
  activeSalesman: Salesman | null;
  isReceiveMode?: boolean;
  vendors?: Vendor[];
}

export const GroceryView: React.FC<GroceryViewProps> = ({
  products,
  categories,
  cart,
  onAddToCart,
  onUpdateQuantity,
  onUpdateItem,
  onRemoveItem,
  onCheckout,
  storeSettings,
  businessCategory,
  activeSalesman,
  isReceiveMode = false,
  vendors = []
}) => {
  const { t } = useTranslation();
  const [numpadValue, setNumpadValue] = useState<string>('0.00');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [checkRef, setCheckRef] = useState('');
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  const handleNumpadPress = (value: string) => {
    if (value === 'C') {
      setNumpadValue('0.00');
      return;
    }
    if (value === 'delete') {
      const current = numpadValue.replace('.', '');
      const next = current.slice(0, -1);
      if (next === '') {
        setNumpadValue('0.00');
      } else {
        const padded = next.padStart(3, '0');
        const formatted = (parseInt(padded) / 100).toFixed(2);
        setNumpadValue(formatted);
      }
      return;
    }

    const current = numpadValue.replace('.', '');
    const next = current + value;
    if (next.length > 8) return;

    const formatted = (parseInt(next) / 100).toFixed(2);
    setNumpadValue(formatted);
  };

  const [showAllVendorProducts, setShowAllVendorProducts] = useState(false);
  const [vendorGridInputs, setVendorGridInputs] = useState<Record<string, { qty: string, cost: string }>>({});

  const handleAddSelectedToTicket = () => {
    Object.entries(vendorGridInputs).forEach(([productId, inputs]) => {
      const { qty: qtyStr, cost: costStr } = inputs as { qty: string, cost: string };
      const qty = parseFloat(qtyStr);
      const cost = parseFloat(costStr);
      if (qty > 0) {
        const product = products.find(p => p.id === productId);
        if (product) {
          // Temporarily override the product's cost to the new cost if provided, but since onAddToCart
          // doesn't support passing custom cost easily unless we modify the product object, we will rely on 
          // default cost or the input cost. Actually, onAddToCart in App.tsx takes (product, quantity).
          // App.tsx uses `product.costo` for Receive Mode cart item price. We should ideally update the product 
          // or cart cost, but for now just adding it via onAddToCart with the original product is fine,
          // because App.tsx uses item.costo. If they need to update cost, that's a catalog update issue.
          // To make it simple and robust, we pass the product as is.
          onAddToCart({ ...product, costo: cost > 0 ? cost : product.costo }, qty);
        }
      }
    });
    setVendorGridInputs({}); // Clear after adding
  };

  const currentVendorGridItems = products.filter(p => {
    if (!isReceiveMode || !selectedVendorId) return false;
    if (showAllVendorProducts) return true;
    return p.proveedor === selectedVendorId;
  });

  const handleQuickAmount = (amount: number) => {
    const current = parseFloat(numpadValue);
    setNumpadValue((current + amount).toFixed(2));
  };

  const quickAccessCategories = categories.filter(c => c.quickAccess).map(c => c.nombre);

  const featuredItems = products.filter(p => {
    if (selectedCategory) return p.categoria === selectedCategory;
    return quickAccessCategories.length > 0 ? quickAccessCategories.includes(p.categoria) : true;
  });

  const subtotal = cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;

  const handleProductClick = (product: Product) => {
    const amountVal = parseFloat(numpadValue);
    if (amountVal > 0) {
      const quantity = amountVal / product.precio;
      onAddToCart(product, quantity);
      setNumpadValue('0.00');
    } else {
      onAddToCart(product, 1);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f0f4f8] font-sans">
      {/* 1/4 COLUMN: CURRENT ORDER */}
      <div className="w-1/4 min-w-[300px] bg-white flex flex-col border-r border-slate-200 z-20">
        <div className="p-5 xl:p-6 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] xl:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{storeSettings.nombre || 'DOWNTOWN STORE'}</span>
              <div className="flex items-center gap-2 mt-1">
                 <div className="w-7 h-7 xl:w-8 xl:h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    {isReceiveMode ? <Package className="w-4 h-4 xl:w-5 xl:h-5" /> : <ShoppingCart className="w-4 h-4 xl:w-5 xl:h-5" />}
                  </div>
                  <h2 className="text-lg xl:text-xl font-black text-slate-900 tracking-tight">
                    {isReceiveMode ? 'Vendor Invoice' : 'Current Order'}
                  </h2>
              </div>
            </div>
            {!isReceiveMode && (
              <div className="flex gap-2">
                <button className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                  <Plus className="w-4 h-4" />
                </button>
                <button className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all">
                  <Tag className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {isReceiveMode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Select Vendor</label>
              <select 
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full bg-white border border-blue-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
              >
                <option value="">-- Choose Vendor --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 xl:p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8 opacity-40">
               <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <ShoppingCart className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-600 mb-2">{t('Cart is empty.', 'Carrito vacío.')}</h3>
              <p className="text-slate-400 text-xs">{t('Type amount and select department or item.', 'Ingrese el monto y seleccione el producto.')}</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {cart.map((item) => (
                <motion.div
                  key={item.cartId}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onDoubleClick={() => setEditingCartItem(item)}
                  className="flex justify-between items-start group py-2 border-b border-dashed border-slate-100 last:border-none cursor-pointer hover:bg-slate-50 transition-colors rounded-lg px-2 -mx-2"
                >
                  <div className="flex-1 pr-2">
                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.nombre}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                      {item.cantidad.toFixed(2)} x ${item.precio.toFixed(2)}
                    </p>
                    {(!businessCategory || businessCategory.enabledFields.serialNumber) && onUpdateItem && (
                      <input 
                        type="text"
                        placeholder="Serial Number"
                        value={item.serialNumber || ''}
                        onChange={(e) => onUpdateItem(item.cartId, { serialNumber: e.target.value })}
                        className="mt-1 w-full text-xs p-1 border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="font-black text-slate-900">${(item.precio * item.cantidad).toFixed(2)}</p>
                    <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onUpdateQuantity(item.cartId, item.cantidad - 1)} className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><MinusCircle className="w-4 h-4" /></button>
                      <button onClick={() => onUpdateQuantity(item.cartId, item.cantidad + 1)} className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"><PlusCircle className="w-4 h-4" /></button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {isReceiveMode ? (
          <div className="p-6 bg-emerald-50/30 border-t border-emerald-100 flex flex-col gap-4">
             <div className="flex justify-between items-end mb-2">
                <span className="text-sm xl:text-base font-black text-blue-900 uppercase tracking-widest">Invoice Total</span>
                <span className="text-3xl xl:text-4xl font-black text-blue-600 tracking-tighter">${total.toFixed(2)}</span>
             </div>
             
             <div className="flex gap-3">
               <div className="flex-1 flex flex-col gap-1.5">
                 <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Invoice #</label>
                 <input 
                   type="text" 
                   value={invoiceNumber}
                   onChange={e => setInvoiceNumber(e.target.value)}
                   placeholder="Nro Factura" 
                   className="w-full bg-white border border-blue-200 text-slate-800 text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                 />
               </div>
               <div className="flex-1 flex flex-col gap-1.5">
                 <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Check / Pay Ref</label>
                 <input 
                   type="text" 
                   value={checkRef}
                   onChange={e => setCheckRef(e.target.value)}
                   placeholder="Nro Cheque" 
                   className="w-full bg-white border border-blue-200 text-slate-800 text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                 />
               </div>
             </div>
             
             <button 
               onClick={() => {
                 if (!selectedVendorId) {
                   toast.error('Please select a vendor first');
                   return;
                 }
                 if (!invoiceNumber) {
                   toast.error('Please enter an invoice number');
                   return;
                 }
                 onCheckout({ invoiceNumber, checkRef, vendorId: selectedVendorId });
                 setInvoiceNumber('');
                 setCheckRef('');
               }}
               className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-4 flex items-center justify-center gap-2 font-black tracking-widest uppercase transition-all shadow-lg shadow-blue-200 mt-2 active:scale-95"
             >
               <Package className="w-6 h-6" /> COMPLETE INVOICE
             </button>
          </div>
        ) : (
          <div className="p-6 xl:p-8 bg-[#fdfdfd] border-t border-slate-100 space-y-5 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
             <div className="space-y-2">
               <div className="flex justify-between items-center text-xs xl:text-sm font-bold text-slate-400">
                  <span className="uppercase tracking-[0.1em]">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
               </div>
               <div className="flex justify-between items-center text-xs xl:text-sm font-bold text-slate-400">
                  <span className="uppercase tracking-[0.1em]">Tax</span>
                  <span>${tax.toFixed(2)}</span>
               </div>
             </div>
             <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                <div>
                  <span className="text-[9px] xl:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] block mb-1">Total Amount</span>
                  <span className="text-2xl xl:text-3xl font-black text-slate-900 leading-none uppercase">Total</span>
                </div>
                <span className="text-4xl xl:text-5xl font-black text-emerald-500 tracking-tighter">${total.toFixed(2)}</span>
             </div>
          </div>
        )}
      </div>

      {/* 1/4 COLUMN: QUICK ACCESS / VENDOR GRID */}
      <div className="w-1/4 min-w-[300px] flex flex-col border-r border-slate-200 bg-[#f8fafc] z-10">
        <div className="p-5 xl:p-6 flex items-center justify-between">
           <div className="flex items-center gap-2 xl:gap-3">
              {isReceiveMode ? (
                <>
                  <Package className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg xl:text-xl font-black text-slate-900 tracking-tight">Vendor Product Grid</h2>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-orange-400 fill-orange-400" />
                  <h2 className="text-lg xl:text-xl font-black text-slate-900 tracking-tight">Quick Access</h2>
                </>
              )}
           </div>
           
           {isReceiveMode ? (
              <div className="flex items-center gap-2">
                <span className="text-[8px] xl:text-[9px] font-black text-slate-400 uppercase tracking-widest text-right leading-none">Show all<br/>products</span>
                <button 
                  onClick={() => setShowAllVendorProducts(!showAllVendorProducts)}
                  className={`w-8 h-4 xl:w-9 xl:h-5 rounded-full flex items-center p-0.5 transition-colors ${showAllVendorProducts ? 'bg-blue-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-3 h-3 xl:w-4 xl:h-4 bg-white rounded-full shadow-sm transition-transform ${showAllVendorProducts ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
           ) : (
              <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-100 hidden xl:flex">
                 <button className="p-1.5 xl:p-2 rounded-lg text-slate-300 hover:text-slate-600"><List className="w-4 h-4" /></button>
                 <button className="p-1.5 xl:p-2 rounded-lg bg-emerald-50 text-emerald-600 shadow-sm"><Grid className="w-4 h-4" /></button>
              </div>
           )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 xl:px-6 pb-6 space-y-6 scrollbar-hide">
          {isReceiveMode ? (
             <div className="h-full flex flex-col">
                {(!selectedVendorId && !showAllVendorProducts) ? (
                  <div className="flex-1 flex flex-col items-center pt-10 text-center gap-6">
                    <div className="w-20 h-20 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center">
                      <Package className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Select A Vendor</h3>
                      <p className="text-xs text-slate-400 mt-1">Choose a vendor to start entering inventory.</p>
                    </div>
                    {/* Optional: vendor cards could be here, but we have a dropdown in the left column. We'll show standard vendor cards if needed */}
                    <div className="w-full space-y-3 mt-4">
                      {vendors.map(v => (
                        <button 
                          key={v.id} 
                          onClick={() => setSelectedVendorId(v.id)}
                          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md hover:border-blue-200 transition-all text-left"
                        >
                          <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{v.nombre}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{v.contacto || 'Vendor'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button 
                      onClick={handleAddSelectedToTicket}
                      className="w-full py-3 bg-blue-400/90 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add selected to ticket
                    </button>
                    
                    <div className="space-y-3 pb-8">
                       {currentVendorGridItems.length === 0 ? (
                         <div className="py-8 text-center text-slate-400 text-xs font-bold w-full uppercase tracking-widest">No products found for this vendor.</div>
                       ) : currentVendorGridItems.map(p => {
                         const currentInput = vendorGridInputs[p.id] || { qty: '', cost: p.costo || p.precio || '' };
                         return (
                           <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{p.nombre}</h4>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Stock: {p.stock || 0}</p>
                                 </div>
                                 <span className="text-[9px] bg-slate-100 text-slate-500 font-black px-2 py-1 rounded-lg uppercase tracking-widest">UNIT</span>
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1 flex gap-2 items-center bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-100">
                                   <label className="text-[10px] font-black text-slate-400 uppercase">QTY</label>
                                   <input 
                                     type="number" 
                                     min="0"
                                     value={currentInput.qty}
                                     onChange={e => setVendorGridInputs({
                                       ...vendorGridInputs, 
                                       [p.id]: { ...currentInput, qty: e.target.value } 
                                     })}
                                     className="w-full bg-transparent text-right font-bold text-sm focus:outline-none text-slate-800"
                                     placeholder="0"
                                   />
                                </div>
                                <div className="flex-1 flex gap-2 items-center bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-100">
                                   <label className="text-[10px] font-black text-slate-400 uppercase">COST</label>
                                   <span className="text-slate-400 font-bold">$</span>
                                   <input 
                                     type="number" 
                                     min="0" step="0.01"
                                     value={currentInput.cost}
                                     onChange={e => setVendorGridInputs({
                                       ...vendorGridInputs, 
                                       [p.id]: { ...currentInput, cost: e.target.value } 
                                     })}
                                     className="w-full bg-transparent text-right font-bold text-sm focus:outline-none text-slate-800"
                                     placeholder="0.00"
                                   />
                                </div>
                              </div>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                )}
             </div>
          ) : (
            <div className="space-y-4">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{selectedCategory || 'ALL ITEMS'}</span>
               <div className="grid grid-cols-2 gap-3 xl:gap-4">
                 {featuredItems.map(p => (
                   <motion.button
                     key={p.id}
                     whileTap={{ scale: 0.96 }}
                     onClick={() => handleProductClick(p)}
                     className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 text-left group border border-slate-100 flex flex-col h-full"
                   >
                     {(!storeSettings?.hideProductImages) && (
                       <div className="aspect-square relative overflow-hidden bg-slate-50 shrink-0">
                         <img 
                           src={p.imagenUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'} 
                           className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                           referrerPolicy="no-referrer"
                         />
                       </div>
                     )}
                     <div className="p-3 xl:p-4 flex-1 flex flex-col justify-between">
                       <div>
                         <h4 className="font-bold text-slate-800 text-xs truncate uppercase tracking-tight">{p.nombre}</h4>
                         <p className="font-black text-emerald-500 text-xs xl:text-sm mt-0.5">${p.precio.toFixed(2)}/unit</p>
                       </div>
                       <div className="mt-2 flex justify-start">
                         <div className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg inline-block">
                            STOCK: {p.stock}
                         </div>
                       </div>
                     </div>
                   </motion.button>
                 ))}
               </div>
            </div>
          )}
        </div>
      </div>

      {/* 2/4 COLUMN (1/2): DEPARTMENTS & PAD (RESTRUCTURED) */}
      <div className="w-1/2 flex flex-col bg-[#f1f5f9] relative">
        {/* Top 2/3: Departments */}
        <div className="flex-[2] p-6 lg:p-8 overflow-y-auto scrollbar-hide">
          <div className="flex items-center justify-between mb-8 sticky top-0 z-10 py-2">
            <h2 className="text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">Departments</h2>
            <div className="bg-emerald-100/60 text-emerald-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm border border-emerald-200/50 backdrop-blur-md">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Scanner Active
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 xl:gap-5 pb-12">
            {categories.map(cat => (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCategory(cat.nombre)}
                style={{ 
                  backgroundColor: cat.color || '#ffffff', 
                  borderColor: selectedCategory === cat.nombre ? '#34d399' : (cat.borderColor || '#f1f5f9') 
                }}
                className={`px-4 py-8 xl:py-10 rounded-[2.5rem] transition-all flex flex-col items-center justify-center gap-4 relative group overflow-hidden ${selectedCategory === cat.nombre ? 'border-2 ring-4 ring-emerald-500/10' : 'border'}`}
              >
                <span className="font-black text-slate-800 uppercase tracking-widest z-10 text-center text-[11px] xl:text-xs px-2">{cat.nombre}</span>
              </motion.button>
            ))}
             <motion.button
                whileTap={{ scale: 0.98 }}
                className="bg-slate-200/50 p-6 rounded-[2.5rem] flex items-center justify-center border-2 border-dashed border-slate-300 hover:bg-slate-200 transition-colors"
              >
                <span className="font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Enter amount first</span>
              </motion.button>
          </div>
        </div>

        {/* Bottom 1/3: Refined Numpad area (Side-by-side) */}
        <div className="flex-[1] min-h-[340px] max-h-[400px] bg-[#f8fafc] border-t border-slate-200 p-6 xl:p-8 flex gap-6 xl:gap-8 relative z-20 shrink-0">
           
           {/* Left side: Amount & Numpad */}
           <div className="flex-[2] flex flex-col gap-4 xl:gap-5">
              
              {/* Amount Display and Quick Bills */}
              <div className="flex gap-4 h-16 xl:h-20 shrink-0">
                 <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex items-center justify-end px-6 xl:px-8 relative overflow-hidden">
                    <span className="text-4xl xl:text-5xl font-black text-slate-900 tracking-tighter">${numpadValue}</span>
                 </div>
                 <div className="w-[45%] grid grid-cols-3 gap-2">
                    {[1, 5, 10, 20, 50, 100].map(amt => (
                      <button 
                       key={amt}
                       onClick={() => handleQuickAmount(amt)}
                       className="bg-white rounded-xl xl:rounded-2xl text-[10px] xl:text-xs font-black text-blue-600 shadow-sm border border-slate-200 hover:bg-blue-50 transition-all active:scale-95"
                      >
                        ${amt}
                      </button>
                    ))}
                 </div>
              </div>

              {/* Matrix */}
              <div className="flex-1 flex gap-4">
                 <div className="flex-1 grid grid-cols-3 gap-3">
                    {[7, 8, 9, 4, 5, 6, 1, 2, 3, '00', 0, '.'].map(val => (
                      <button
                       key={val}
                       onClick={() => handleNumpadPress(val.toString())}
                       className="bg-white rounded-2xl shadow-sm border border-slate-200 text-2xl xl:text-3xl font-black text-slate-800 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center"
                      >
                        {val}
                      </button>
                    ))}
                 </div>
                 <div className="w-[20%] min-w-[80px] grid grid-cols-1 gap-3">
                    <button 
                     onClick={() => handleNumpadPress('delete')}
                     className="bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-center hover:bg-rose-100 transition-all active:scale-95"
                    >
                      <Delete className="w-8 h-8 xl:w-10 xl:h-10" />
                    </button>
                    <button 
                     onClick={() => handleNumpadPress('C')}
                     className="bg-slate-200 text-slate-600 rounded-2xl border border-slate-300 shadow-sm text-2xl xl:text-3xl font-black hover:bg-slate-300 transition-all active:scale-95"
                    >
                      C
                    </button>
                 </div>
              </div>
           </div>

           {/* Right side: Checkout Buttons */}
           <div className="flex-[1] flex flex-col gap-3 min-w-[200px] max-w-[260px]">
              <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] xl:text-xs font-black text-slate-400 uppercase tracking-widest">Checkout</span>
              </div>
              
              <button 
                onClick={() => onCheckout()}
                className="flex-[2] bg-[#fca168] text-white rounded-[2rem] shadow-lg shadow-orange-500/20 hover:bg-[#fc9251] transition-all active:scale-95 flex flex-col items-center justify-center gap-1 border-b-4 border-orange-500/50"
              >
                 <span className="text-xs xl:text-sm uppercase tracking-[0.2em] opacity-90 font-bold">Exact</span>
                 <span className="text-2xl xl:text-3xl uppercase tracking-wider font-black">CASH</span>
              </button>
              
              <button 
                 onClick={() => onCheckout()}
                 className="flex-[1] min-h-[60px] bg-[#53d08e] text-white rounded-2xl font-black text-lg xl:text-xl uppercase tracking-widest shadow-md hover:bg-[#45c380] transition-all active:scale-95 border-b-4 border-emerald-500/50">
                 CASH
              </button>
              
              <div className="flex-[1] flex gap-3 min-h-[50px]">
                 <button onClick={() => onCheckout()} className="flex-1 bg-[#fb7893] text-white rounded-xl shadow-sm font-black text-xs xl:text-sm uppercase tracking-widest hover:bg-[#f66781] transition-all active:scale-95 border-b-4 border-rose-500/50">Credit</button>
                 <button onClick={() => onCheckout()} className="flex-1 bg-[#6ea1fa] text-white rounded-xl shadow-sm font-black text-xs xl:text-sm uppercase tracking-widest hover:bg-[#5b95f8] transition-all active:scale-95 border-b-4 border-blue-500/50">EBT</button>
              </div>
           </div>
        </div>
      </div>
      
      {editingCartItem && (
        <EditCartItemModal
          item={editingCartItem}
          categories={categories}
          onClose={() => setEditingCartItem(null)}
          onSave={(updatedItem) => {
            if (onUpdateItem) {
              onUpdateItem(updatedItem.cartId, {
                nombre: updatedItem.nombre,
                precio: updatedItem.precio,
                categoria: updatedItem.categoria,
                cantidad: updatedItem.cantidad
              });
            }
            setEditingCartItem(null);
          }}
        />
      )}
    </div>
  );
};
