import React, { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, Delete, Plus, Minus, Search, 
  Trash2, CreditCard, DollarSign, Wallet, 
  Tag, Package, ChevronRight, Calculator,
  Grid, List, Sparkles, Smartphone,
  MinusCircle, PlusCircle, X, Truck, UserPlus, Percent, Star,
  RefreshCw, ArrowLeft, GripVertical
} from 'lucide-react';
import { Product, CartItem, StoreSettings, Category, Tax, BusinessCategory, Salesman, Vendor } from '../types';
import { EditCartItemModal } from './EditCartItemModal';

interface GroceryViewProps {
  products: Product[];
  categories: Category[];
  onReorderCategories?: (reordered: Category[]) => void;
  cart: CartItem[];
  onAddToCart: (product: Product, quantity: number) => void;
  onUpdateQuantity: (cartId: string, quantity: number) => void;
  onUpdateItem?: (cartId: string, updates: Partial<CartItem>) => void;
  onRemoveItem: (cartId: string) => void;
  onClearCart?: () => void;
  onCheckout: (details?: { invoiceNumber?: string, checkRef?: string, vendorId?: string, paymentMethod?: 'Cash' | 'Credit' | 'Check' | 'Split' | 'EBT' | '' }) => void;
  storeSettings: StoreSettings;
  businessCategory: BusinessCategory | null;
  activeSalesman: Salesman | null;
  isReceiveMode?: boolean;
  onToggleReceiveMode?: (mode: boolean) => void;
  onAddClient?: () => void;
  vendors?: Vendor[];
  onRefundClick?: () => void;
}

export const GroceryView: React.FC<GroceryViewProps> = ({
  products,
  categories,
  onReorderCategories,
  cart,
  onAddToCart,
  onUpdateQuantity,
  onUpdateItem,
  onRemoveItem,
  onClearCart,
  onCheckout,
  storeSettings,
  businessCategory,
  activeSalesman,
  isReceiveMode = false,
  onToggleReceiveMode,
  onAddClient,
  vendors = [],
  onRefundClick
}) => {
  const { t } = useTranslation();
  const [numpadValue, setNumpadValue] = useState<string>('0.00');
  const [quickAccessViewMode, setQuickAccessViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [checkRef, setCheckRef] = useState('');
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [isPreOrderMode, setIsPreOrderMode] = useState<boolean>(false);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...categories];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);

    if (onReorderCategories) {
      onReorderCategories(reordered);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

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
    return quickAccessCategories.includes(p.categoria);
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
             <div className="flex justify-between items-start">
               <div className="flex flex-col">
                 <span className="text-[9px] xl:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{storeSettings.nombre || 'DOWNTOWN STORE'}</span>
                 <div className="flex items-center gap-2 mt-1">
                    <div className={`w-7 h-7 xl:w-8 xl:h-8 rounded-xl flex items-center justify-center ${isReceiveMode ? (isPreOrderMode ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600') : 'bg-blue-50 text-blue-600'}`}>
                       {isReceiveMode ? (isPreOrderMode ? <Package className="w-4 h-4 xl:w-5 xl:h-5" /> : <Truck className="w-4 h-4 xl:w-5 xl:h-5" />) : <ShoppingCart className="w-4 h-4 xl:w-5 xl:h-5" />}
                     </div>
                     <h2 className="text-lg xl:text-xl font-black text-slate-900 tracking-tight">
                       {isReceiveMode ? 'Vendor Invoice' : 'Current Order'}
                     </h2>
                 </div>
               </div>
               
               <div className="flex gap-2">
                 <button 
                  onClick={onAddClient}
                  className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm border border-slate-100"
                  title="Add Client"
                 >
                   <UserPlus className="w-4 h-4" />
                 </button>
                 <button 
                   onClick={() => {
                     if (cart.length > 0 && confirm('¿Desea borrar todo el ticket?')) {
                       onClearCart?.();
                     }
                   }}
                   disabled={cart.length === 0}
                   className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm border border-slate-100"
                   title="Borrar todo el ticket"
                 >
                   <Trash2 className="w-4 h-4" />
                 </button>
                 <button 
                  onClick={() => {
                    if (isReceiveMode && !isPreOrderMode) {
                      onToggleReceiveMode?.(false);
                    } else {
                      onToggleReceiveMode?.(true);
                      setIsPreOrderMode(false);
                    }
                  }}
                  className={`p-2 rounded-lg transition-all shadow-sm border ${isReceiveMode && !isPreOrderMode ? 'bg-blue-500 text-white border-blue-600' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-blue-50 hover:text-blue-600'}`}>
                   <Truck className="w-4 h-4" />
                 </button>
                 <button 
                  onClick={() => {
                    if (isReceiveMode && isPreOrderMode) {
                      onToggleReceiveMode?.(false);
                    } else {
                      onToggleReceiveMode?.(true);
                      setIsPreOrderMode(true);
                    }
                  }}
                  className={`relative group p-2 rounded-lg transition-all shadow-sm border ${isReceiveMode && isPreOrderMode ? 'bg-orange-500 text-white border-orange-600' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-orange-50 hover:text-orange-600'}`}>
                   <Package className="w-4 h-4" />
                 </button>
                 <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm border border-slate-100">
                   <Tag className="w-4 h-4" />
                 </button>
               </div>
             </div>

          {isReceiveMode && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => onToggleReceiveMode?.(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" /> Volver a Ventas
              </button>
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
            <>
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
              <div className="pt-4 pb-2 flex justify-end shrink-0">
                <button
                  onClick={() => {
                    if (confirm('¿Está seguro de que desea borrar todo el ticket actual?')) {
                      onClearCart?.();
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-black transition-all shadow-sm uppercase tracking-wider"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Borrar todo el ticket
                </button>
              </div>
            </>
          )}
        </div>

        {isReceiveMode ? (
          <div className={`p-6 border-t flex flex-col gap-4 ${isPreOrderMode ? 'bg-orange-50/50 border-orange-100' : 'bg-emerald-50/30 border-emerald-100'}`}>
             <div className="flex justify-between items-end mb-2">
                <span className={`text-sm xl:text-base font-black uppercase tracking-widest ${isPreOrderMode ? 'text-orange-900' : 'text-blue-900'}`}>
                  {isPreOrderMode ? 'PRE-ORDER TOTAL' : 'INVOICE TOTAL'}
                </span>
                <span className={`text-3xl xl:text-4xl font-black tracking-tighter ${isPreOrderMode ? 'text-orange-600' : 'text-blue-600'}`}>${total.toFixed(2)}</span>
             </div>
             
             {!isPreOrderMode && (
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
             )}
             
             <button 
               onClick={() => {
                 if (!selectedVendorId) {
                   toast.error('Please select a vendor first');
                   return;
                 }
                 if (!isPreOrderMode && !invoiceNumber) {
                   toast.error('Please enter an invoice number');
                   return;
                 }
                 onCheckout({ invoiceNumber, checkRef, vendorId: selectedVendorId });
                 setInvoiceNumber('');
                 setCheckRef('');
               }}
               className={`w-full text-white rounded-xl py-4 flex items-center justify-center gap-2 font-black tracking-widest uppercase transition-all shadow-lg active:scale-95 ${isPreOrderMode ? 'bg-[#ffca80] hover:bg-[#feb454] shadow-orange-200 mt-2' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200 mt-2'}`}
             >
               <Package className="w-6 h-6" /> {isPreOrderMode ? 'COMPLETE PRE-ORDER' : 'COMPLETE INVOICE'}
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
                  <Package className={`w-5 h-5 ${isPreOrderMode ? 'text-orange-500' : 'text-blue-500'}`} />
                  <h2 className="text-lg xl:text-xl font-black text-slate-900 tracking-tight">{isPreOrderMode ? 'Pre-Order Grid' : 'Vendor Product Grid'}</h2>
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
              <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-100">
                 <button 
                   onClick={() => setQuickAccessViewMode('list')}
                   className={`p-1.5 xl:p-2 rounded-lg transition-colors ${quickAccessViewMode === 'list' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-300 hover:text-slate-600'}`}
                 >
                   <List className="w-4 h-4" />
                 </button>
                 <button 
                   onClick={() => setQuickAccessViewMode('grid')}
                   className={`p-1.5 xl:p-2 rounded-lg transition-colors ${quickAccessViewMode === 'grid' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-300 hover:text-slate-600'}`}
                 >
                   <Grid className="w-4 h-4" />
                 </button>
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
                      className={`w-full py-3 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 ${isPreOrderMode ? 'bg-[#ffab73] hover:bg-[#ff9c5a]' : 'bg-blue-400/90 hover:bg-blue-500'}`}
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
                              {(() => {
                                const prices = p.vendorPrices || [];
                                if (prices.length === 0) return null;
                                const cheaperWholesaler = prices.reduce((cheapest, current) => {
                                  return current.costo < cheapest.costo ? current : cheapest;
                                }, prices[0]);

                                const activeCost = currentInput.cost !== '' ? parseFloat(currentInput.cost) : (p.costo || 0);

                                if (cheaperWholesaler && activeCost > cheaperWholesaler.costo) {
                                  const difference = activeCost - cheaperWholesaler.costo;
                                  return (
                                    <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-200/60 text-amber-800 text-[11px] leading-tight flex items-start gap-2 mt-1">
                                      <span className="text-amber-500 text-xs">⚠️</span>
                                      <div className="flex-1">
                                        <p className="font-extrabold uppercase tracking-widest text-[9px] text-amber-700">Mejor Costo Disponible</p>
                                        <p className="mt-0.5 font-bold">
                                          <span className="text-amber-900 font-black">{cheaperWholesaler.vendorName}</span> vende esto a <span className="text-emerald-500 font-extrabold">${cheaperWholesaler.costo.toFixed(2)}</span> (ahorras <span className="font-extrabold">${difference.toFixed(2)}</span>)
                                        </p>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                           </div>
                         );
                       })}
                    </div>
                  </div>
                )}
             </div>
          ) : (
            <div className="space-y-4">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{selectedCategory || 'QUICK ACCESS'}</span>
               {quickAccessViewMode === 'grid' ? (
                 <div className="grid grid-cols-2 gap-3 xl:gap-4">
                   {featuredItems.length === 0 ? (
                      <div className="col-span-2 py-10 flex flex-col items-center justify-center text-center opacity-40">
                         <Star className="w-10 h-10 mb-4 text-slate-400" />
                         <span className="text-sm font-bold text-slate-700">{selectedCategory ? "No products found." : "No active Quick Access items."}</span>
                         <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-2">
                           {selectedCategory ? "Adjust categories or catalog." : "Activate Quick Access for categories in Admin Settings."}
                         </span>
                      </div>
                   ) : featuredItems.map(p => (
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
                           <p className="font-black text-emerald-500 text-xs xl:text-sm mt-0.5">${Number(p.precio || 0).toFixed(2)}/unit</p>
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
               ) : (
                 <div className="flex flex-col gap-2">
                   {featuredItems.length === 0 ? (
                      <div className="col-span-2 py-10 flex flex-col items-center justify-center text-center opacity-40">
                         <Star className="w-10 h-10 mb-4 text-slate-400" />
                         <span className="text-sm font-bold text-slate-700">{selectedCategory ? "No products found." : "No active Quick Access items."}</span>
                         <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-2">
                           {selectedCategory ? "Adjust categories or catalog." : "Activate Quick Access for categories in Admin Settings."}
                         </span>
                      </div>
                   ) : featuredItems.map(p => (
                     <motion.button
                       key={p.id}
                       whileTap={{ scale: 0.96 }}
                       onClick={() => handleProductClick(p)}
                       className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-300 text-left group border border-slate-100 flex items-center justify-between"
                     >
                       <div className="flex flex-col">
                         <h4 className="font-bold text-slate-800 text-sm">{p.nombre}</h4>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">STOCK: {p.stock}</span>
                       </div>
                       <p className="font-black text-emerald-500 text-sm">${Number(p.precio || 0).toFixed(2)}</p>
                     </motion.button>
                   ))}
                 </div>
               )}
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

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 xl:gap-5 pb-12 font-sans">
            {categories.map((cat, index) => {
              const isDragged = draggedIndex === index;
              const isDragOver = dragOverIndex === index;
              return (
                <motion.button
                  key={cat.id}
                  whileTap={{ scale: 0.98 }}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    const amountVal = parseFloat(numpadValue);
                    if (amountVal > 0) {
                      const genericProduct: Product = {
                        id: `GEN-${cat.id || String(Math.random())}-${Date.now()}`,
                        upc: '',
                        sku: '',
                        nombre: `Venta ${cat.nombre}`,
                        precio: amountVal,
                        costo: 0,
                        categoria: cat.nombre,
                        stock: 9999,
                        imagenUrl: '',
                        descuento: 0
                      };
                      onAddToCart(genericProduct, 1);
                      setNumpadValue('0.00');
                      toast.success(`Agregado: ${cat.nombre} $${amountVal.toFixed(2)}`);
                    } else {
                      setSelectedCategory(selectedCategory === cat.nombre ? null : cat.nombre);
                    }
                  }}
                  style={{ 
                    backgroundColor: cat.color || '#ffffff', 
                    borderColor: selectedCategory === cat.nombre ? '#34d399' : (isDragOver ? '#3b82f6' : (cat.borderColor || '#f1f5f9')),
                    opacity: isDragged ? 0.4 : 1,
                    cursor: draggedIndex !== null ? 'grabbing' : 'grab'
                  }}
                  className={`px-4 py-8 xl:py-10 rounded-[2.5rem] transition-all flex flex-col items-center justify-center gap-4 relative group overflow-hidden ${selectedCategory === cat.nombre ? 'border-2 ring-4 ring-emerald-500/10' : 'border'} ${isDragOver ? 'ring-4 ring-blue-500/20' : ''}`}
                >
                  {/* Subtle drag grid icon */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity">
                    <GripVertical className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="font-black text-slate-800 uppercase tracking-widest z-10 text-center text-[11px] xl:text-xs px-2 select-none">{cat.nombre}</span>
                </motion.button>
              );
            })}
             <motion.button
                whileTap={{ scale: 0.98 }}
                className="bg-slate-200/50 p-6 rounded-[2.5rem] flex items-center justify-center border-2 border-dashed border-slate-300 hover:bg-slate-200 transition-colors"
              >
                <span className="font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Enter amount first</span>
              </motion.button>
          </div>
        </div>

        {/* Bottom 1/3: Original Numpad Layout */}
        <div className="flex-[1] bg-[#f8fafc] border-t border-slate-200 p-6 xl:p-8 flex gap-6 xl:gap-8 relative z-20 shrink-0 min-h-[320px]">
           
           {/* Left side: Amount & Quick Bills */}
           <div className="w-[30%] flex flex-col gap-3">
              <span className="text-[10px] xl:text-xs font-black text-slate-400 uppercase tracking-widest">Amount</span>
              <div className="h-16 xl:h-20 bg-white rounded-2xl border border-slate-200 flex items-center justify-end px-6 relative overflow-hidden shrink-0">
                 <span className="text-4xl xl:text-5xl font-black text-slate-300 tracking-tighter">${numpadValue}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                 {[1, 5, 10, 20, 50, 100].map(amt => (
                   <button 
                    key={amt}
                    onClick={() => handleQuickAmount(amt)}
                    className="bg-white rounded-xl py-2 text-xs font-black text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                   >
                     ${amt}
                   </button>
                 ))}
              </div>
              <button className="w-full mt-auto bg-[#8e9fb2] text-white rounded-xl py-3 text-[10px] xl:text-xs font-black uppercase tracking-[0.2em] shadow-sm hover:bg-[#7b8fa3] transition-all flex items-center justify-center gap-2">
                 <div className="w-3 flex flex-col gap-0.5 opacity-70"><div className="w-full border-t-[2px] border-current"></div><div className="w-full border-t-[2px] border-current"></div></div> HOLD ORDER
              </button>
           </div>

           {/* Middle side: Matrix */}
           <div className="w-[45%] flex flex-col justify-end gap-3 pb-1">
              <div className="grid grid-cols-3 gap-3">
                 {[7, 8, 9, 4, 5, 6, 1, 2, 3, '00', 0, '.'].map(val => (
                   <button
                    key={val}
                    onClick={() => handleNumpadPress(val.toString())}
                    className="h-16 bg-[#f5f7fa] rounded-xl shadow-sm border border-slate-200 text-2xl xl:text-3xl font-black text-blue-600 hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center"
                   >
                     {val}
                   </button>
                 ))}
              </div>
           </div>

           {/* Right side: Checkout Buttons */}
           <div className="flex-1 flex flex-col gap-2.5 min-w-[160px]">
              <span className="text-[10px] xl:text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Checkout</span>
              
              <div className="flex gap-2">
                 <button 
                  onClick={() => handleNumpadPress('delete')}
                  className="flex-1 h-12 bg-white text-red-500 rounded-xl border border-red-100 shadow-sm flex items-center justify-center hover:bg-red-50 transition-all active:scale-95"
                 >
                   <Delete className="w-5 h-5 xl:w-6 xl:h-6" />
                 </button>
                 <button 
                  onClick={() => handleNumpadPress('C')}
                  className="flex-1 h-12 bg-white text-red-500 rounded-xl border border-red-100 shadow-sm flex items-center justify-center text-xl font-black hover:bg-red-50 transition-all active:scale-95"
                 >
                   C
                 </button>
              </div>

              <button 
                onClick={() => onCheckout({ paymentMethod: 'Cash' })}
                className="flex-[1.5] bg-[#ffab73] text-white rounded-2xl shadow-sm hover:bg-[#ff9c5a] transition-all active:scale-95 flex flex-col items-center justify-center"
              >
                 <span className="text-[9px] xl:text-[10px] font-black uppercase tracking-[0.2em] opacity-90">Exact</span>
                 <span className="text-xl xl:text-2xl font-black uppercase tracking-wider">CASH</span>
              </button>
              
              <button 
                 onClick={() => onCheckout({ paymentMethod: 'Cash' })}
                 className="flex-1 bg-[#86dcb2] text-white rounded-2xl font-black text-lg xl:text-xl uppercase tracking-widest shadow-sm hover:bg-[#70cf9d] transition-all active:scale-95">
                 CASH
              </button>
              
              <div className="flex-1 flex gap-2">
                 <button onClick={() => onCheckout({ paymentMethod: 'Credit' })} className="flex-1 bg-[#ff8fa6] text-white rounded-xl shadow-sm font-black text-xs xl:text-sm uppercase tracking-widest hover:bg-[#ff7994] transition-all active:scale-95">Credit</button>
                 <button onClick={() => onCheckout({ paymentMethod: 'EBT' })} className="flex-1 bg-[#83b1ff] text-white rounded-xl shadow-sm font-black text-xs xl:text-sm uppercase tracking-widest hover:bg-[#6c9ef1] transition-all active:scale-95">EBT</button>
              </div>

              <button 
                 onClick={onRefundClick}
                 className="h-10 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-[13px] uppercase tracking-widest shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                 <RefreshCw className="w-3.5 h-3.5" /> REFUND
              </button>
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
          onDelete={(cartId) => {
            onRemoveItem(cartId);
            setEditingCartItem(null);
          }}
        />
      )}
    </div>
  );
};
