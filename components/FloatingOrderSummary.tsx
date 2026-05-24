import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  ChefHat, 
  CreditCard, 
  Printer, 
  Pause, 
  Plus, 
  Minus, 
  Trash2, 
  X,
  Ticket,
  FileText
} from 'lucide-react';
import { CartItem, StoreSettings, Tax, Salesman, Client, Category } from '../types';
import { TicketPreview, InvoicePreview } from './PrintPreviews';

interface FloatingOrderSummaryProps {
  cart: CartItem[];
  storeSettings: StoreSettings;
  taxes: Tax[];
  categories: Category[];
  salesman?: Salesman | null;
  client?: Client | null;
  businessCategory?: any | null;
  isSuperAdmin?: boolean;
  onUpdateQuantity: (cartId: string, delta: number) => void;
  onRemoveItem: (cartId: string) => void;
  onCheckout: (tipAmount?: number) => void;
  onSendToKitchen?: () => void;
  onPrint?: () => void;
  onPause?: () => void;
}

export const FloatingOrderSummary: React.FC<FloatingOrderSummaryProps> = ({
  cart,
  storeSettings,
  taxes,
  categories,
  salesman,
  client,
  businessCategory,
  isSuperAdmin,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onSendToKitchen,
  onPrint,
  onPause
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTipPercentage, setSelectedTipPercentage] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');

  const isWholesale = businessCategory?.id === 'wholesale' ||
                      (!['restaurant', 'retail', 'grocery', 'combo'].includes(businessCategory?.id || '')) && (
                        (client && client.terminosCredito && client.terminosCredito !== 'CASH/TODAY') ||
                        (storeSettings?.nombre?.toLowerCase().includes('wholesale')) ||
                        (businessCategory?.name?.toLowerCase().includes('wholesale'))
                      );

  const handleFloatingClick = () => {
    if (isWholesale) {
      onCheckout();
    } else {
      setIsOpen(true);
    }
  };

  const subtotal = cart.reduce((acc, item) => {
    const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
    const itemPrice = item.precio || 0;
    if (item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
      const q = item.cantidad || 1;
      const sets = Math.floor(q / item.promo.quantity);
      const remainder = q % item.promo.quantity;
      return acc + (sets * item.promo.price) + (remainder * (itemPrice + modifierTotal));
    }
    return acc + ((itemPrice + modifierTotal) * (item.cantidad || 1));
  }, 0);
  
  const discount = cart.reduce((acc, item) => {
    const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
    const itemPrice = item.precio || 0;
    if (item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
       const q = item.cantidad || 1;
       const remainder = q % item.promo.quantity;
       return acc + (((itemPrice + modifierTotal) * ((item.descuento || 0) / 100)) * remainder);
    }
    return acc + ((((itemPrice) + modifierTotal) * ((item.descuento || 0) / 100)) * (item.cantidad || 1));
  }, 0);

  // Calculate taxes per item based on category
  let taxAmount = 0;
  const taxesAppliedMap = new Map<string, { name: string, amount: number, rate: number }>();

  cart.forEach(item => {
    const itemPrice = item.precio || 0;
    const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
    let itemTotal = 0;
    if (item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
      const q = item.cantidad || 1;
      const sets = Math.floor(q / item.promo.quantity);
      const remainder = q % item.promo.quantity;
      const remainderTotal = (remainder * (itemPrice + modifierTotal)) * (1 - (item.descuento || 0) / 100);
      itemTotal = (sets * item.promo.price) + remainderTotal;
    } else {
      itemTotal = ((itemPrice) + modifierTotal) * (1 - (item.descuento || 0) / 100) * (item.cantidad || 1);
    }
    const category = categories.find(c => c.nombre === item.categoria);
    
    if (category && category.taxIds && category.taxIds.length > 0) {
      category.taxIds.forEach(taxId => {
        const tax = taxes.find(t => t.id === taxId);
        if (tax) {
          const rawRate = tax.porcentaje !== undefined ? tax.porcentaje : ((tax as any).tasa ?? 0);
          const amount = itemTotal * (rawRate / 100);
          taxAmount += amount;
          
          if (taxesAppliedMap.has(tax.id)) {
            const existing = taxesAppliedMap.get(tax.id)!;
            existing.amount += amount;
          } else {
            taxesAppliedMap.set(tax.id, { name: tax.nombre, amount, rate: rawRate });
          }
        }
      });
    } else {
      // Fallback to global taxes if no category taxes are defined
      taxes.forEach(tax => {
        const rawRate = tax.porcentaje !== undefined ? tax.porcentaje : ((tax as any).tasa ?? 0);
        const amount = itemTotal * (rawRate / 100);
        taxAmount += amount;
        
        if (taxesAppliedMap.has(tax.id)) {
          const existing = taxesAppliedMap.get(tax.id)!;
          existing.amount += amount;
        } else {
          taxesAppliedMap.set(tax.id, { name: tax.nombre, amount, rate: rawRate });
        }
      });
    }
  });

  const taxesApplied = Array.from(taxesAppliedMap.values()).filter(t => t.rate > 0 || t.amount > 0);

  const showTips = storeSettings.enableTips && (!businessCategory || businessCategory.id === 'restaurant');

  // Calculate Tip
  let tipAmount = 0;
  if (showTips) {
    if (customTip) {
      tipAmount = parseFloat(customTip) || 0;
    } else if (selectedTipPercentage > 0) {
      tipAmount = (subtotal - discount) * (selectedTipPercentage / 100);
    }
  }

  const totalCash = subtotal - discount + taxAmount + tipAmount;
  const creditSurcharge = storeSettings.creditSurcharge || 4;
  const totalCredit = totalCash * (1 + creditSurcharge / 100);

  if (cart.length === 0) return null;

  return (
    <>
      {/* Floating Button */}
      <motion.button
        layoutId="order-summary-btn"
        onClick={handleFloatingClick}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-2xl rounded-2xl border border-gray-200 px-8 py-4 flex items-center gap-8 z-50 hover:scale-105 active:scale-95 transition-all"
      >
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{cart.length} ITEMS</span>
          <span className="text-2xl font-black text-blue-600">${totalCash.toFixed(2)}</span>
        </div>
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
          {isWholesale ? <FileText className="w-6 h-6" /> : <ShoppingCart className="w-6 h-6" />}
        </div>
      </motion.button>

      {/* Expanded Summary */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                    <Ticket className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">
                    Order Summary
                  </h2>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <>
                {/* Column Headers */}
                  <div className="px-6 py-3 bg-gray-50/50 flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <span className="flex-1">ITEM</span>
                    <div className="flex gap-8">
                      <span className="w-16 text-right">CASH</span>
                      <span className="w-16 text-right">CREDIT</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-gray-100"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-3 text-[10px] font-black text-blue-400 uppercase tracking-widest">BOX 1</span>
                      </div>
                    </div>

                    {cart.map((item) => (
                      <div key={item.cartId} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-black text-gray-900 leading-tight uppercase">{item.nombre}</h3>
                            <p className="text-xs font-bold text-gray-400 mt-1">
                              ${(item.precio + (item.selectedModifiers || []).reduce((s, m) => s + m.precio, 0)).toFixed(2)}
                            </p>
                            {(item.selectedModifiers || []).map((mod, midx) => (
                              <p key={midx} className="text-[10px] text-blue-600 font-bold italic mt-0.5">
                                + {mod.modifierName} {mod.precio > 0 ? `($${mod.precio.toFixed(2)})` : ''}
                              </p>
                            ))}
                          </div>
                          <div className="flex gap-8 items-start">
                            <div className="text-right">
                              <p className="font-black text-gray-900">${(item.precio * item.cantidad).toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-300 text-sm">${(item.precio * item.cantidad * (1 + creditSurcharge/100)).toFixed(2)}</p>
                            </div>
                            <div className="ml-2">
                              <span className="px-2 py-1 bg-green-50 text-green-600 text-[8px] font-black uppercase tracking-widest rounded-md border border-green-100">
                                SENT TO KITCHEN
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-xl border border-gray-100">
                            <button 
                              onClick={() => onUpdateQuantity(item.cartId, -1)}
                              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-600 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-black text-gray-900 w-6 text-center">{item.cantidad}</span>
                            <button 
                              onClick={() => onUpdateQuantity(item.cartId, 1)}
                              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-600 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <button 
                            onClick={() => onRemoveItem(item.cartId)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>

              {/* Footer */}
              <div className="p-8 bg-green-50/30 border-t border-green-100 shrink-0">
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm font-bold text-gray-500">
                    <span>Subtotal</span>
                    <span className="font-black text-gray-900">${subtotal.toFixed(2)}</span>
                  </div>
                  
                  {taxesApplied.map((tax, idx) => (
                    <div key={idx} className="flex justify-between text-sm font-bold text-gray-500">
                      <div className="flex flex-col">
                        <span>{tax.name}</span>
                        <span className="text-[10px] text-gray-400 italic">({tax.rate}%)</span>
                      </div>
                      <span className="font-black text-gray-900">${tax.amount.toFixed(2)}</span>
                    </div>
                  ))}

                  {showTips && (
                    <div className="pt-4 border-t border-green-200/50">
                      <div className="flex justify-between text-sm font-bold text-gray-500 mb-2">
                        <span>Propina (Tip)</span>
                        <span className="font-black text-gray-900">${tipAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {(storeSettings.tipPercentages || [10, 15, 20]).map(pct => (
                          <button
                            key={pct}
                            onClick={() => {
                              setSelectedTipPercentage(pct);
                              setCustomTip('');
                            }}
                            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                              selectedTipPercentage === pct && !customTip
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setSelectedTipPercentage(0);
                            setCustomTip('');
                          }}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                            selectedTipPercentage === 0 && !customTip
                              ? 'bg-gray-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          No Tip
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">Custom:</span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                          <input
                            type="number"
                            value={customTip}
                            onChange={(e) => {
                              setCustomTip(e.target.value);
                              setSelectedTipPercentage(0);
                            }}
                            placeholder="0.00"
                            className="w-full pl-7 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-end mb-8">
                  <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">TOTAL</h3>
                  <div className="flex gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">CASH</p>
                      <p className="text-4xl font-black text-green-600 tracking-tighter">${totalCash.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">CREDIT</p>
                      <p className="text-2xl font-black text-gray-300 tracking-tighter">${totalCredit.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <button 
                    onClick={onPause}
                    className="aspect-square bg-slate-700 text-white rounded-2xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
                  >
                    <Pause className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={onSendToKitchen}
                    className="aspect-square bg-orange-500 text-white rounded-2xl flex items-center justify-center hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
                  >
                    <ChefHat className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => onCheckout(tipAmount)}
                    className="aspect-square bg-green-600 text-white rounded-2xl flex items-center justify-center hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                  >
                    <CreditCard className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={onPrint}
                    className="aspect-square bg-white border-2 border-gray-100 text-gray-400 rounded-2xl flex items-center justify-center hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
                  >
                    <Printer className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
