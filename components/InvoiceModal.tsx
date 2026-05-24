import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { TicketPreview, InvoicePreview } from './PrintPreviews';
import { CartItem, Client, Salesman, Order, StoreSettings, Tax, BusinessCategory, Category } from '../types';
import { X, Printer as PrinterIcon, Mail, CheckCircle, DollarSign, CreditCard, RefreshCw, FileText, Ticket, Sparkles } from 'lucide-react';
import { QuantityControl } from './QuantityControl';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface InvoiceModalProps {
  storeSettings: StoreSettings;
  businessCategory?: BusinessCategory | null;
  cart: CartItem[];
  clients: Client[];
  salesmen: Salesman[];
  taxes: Tax[];
  categories: Category[];
  activeSalesmanId?: string;
  isSuperAdmin?: boolean;
  onClose: () => void;
  onComplete: (order: Partial<Order>) => void;
  onUpdateQuantity?: (cartId: string, cantidad: number) => void;
  initialSelectedClient?: Client | null;
  onSelectClient?: (client: Client | null) => void;
  initialPaymentMethod?: 'Cash' | 'Credit' | 'Check' | 'Split' | 'EBT' | '';
  initialTipAmount?: number;
  onBarcodeClick?: (invoiceId: string) => void;
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertNumberToWords(amount: number): string {
  if (amount === 0) return 'Zero Dollars';
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);

  function convertGroup(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertGroup(n % 100) : '');
  }

  function convertThousands(n: number): string {
    if (n >= 1000000) return convertGroup(Math.floor(n / 1000000)) + ' Million ' + convertThousands(n % 1000000);
    if (n >= 1000) return convertGroup(Math.floor(n / 1000)) + ' Thousand ' + convertGroup(n % 1000);
    return convertGroup(n);
  }

  let result = convertThousands(dollars);
  if (result === '') result = 'Zero';
  result += dollars === 1 ? ' Dollar' : ' Dollars';

  if (cents > 0) {
    result += ` and ${cents}/100`;
  } else {
    result += ' and 00/100';
  }

  return result.trim();
}

const formatMoneyInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const amount = parseInt(digits) / 100;
  return amount.toFixed(2);
};

const InvoiceModal: React.FC<InvoiceModalProps> = ({ storeSettings, businessCategory, cart, clients, salesmen, taxes, categories, activeSalesmanId, isSuperAdmin, onClose, onComplete, onUpdateQuantity, initialSelectedClient, onSelectClient, initialPaymentMethod, initialTipAmount, onBarcodeClick }) => {
  const [selectedClient, setSelectedClient] = React.useState<string>(initialSelectedClient?.id || '');
  const [selectedSalesman, setSelectedSalesman] = React.useState<string>(activeSalesmanId || salesmen[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = React.useState<'Cash' | 'Credit' | 'Check' | 'Split' | 'EBT' | 'EBT + Cash' | 'EBT + Credit' | ''>(initialPaymentMethod || '');
  const [checkoutStep, setCheckoutStep] = React.useState<'method' | 'cash' | 'split' | 'check' | 'complete' | 'ebt_split'>(
    initialPaymentMethod === 'Cash' ? 'cash' : 
    initialPaymentMethod === 'Check' ? 'check' :
    initialPaymentMethod === 'Split' ? 'split' :
    'method'
  );
  
  const showTips = storeSettings.enableTips && businessCategory?.id === 'restaurant';
  
  const [tipPercentage, setTipPercentage] = React.useState<number>(0);
  const [customTip, setCustomTip] = React.useState<string>(initialTipAmount ? initialTipAmount.toString() : '');
  const [splitCount, setSplitCount] = React.useState(2);
  const [splits, setSplits] = React.useState<{ amount: number; method: 'Cash' | 'Credit' | 'EBT' }[]>([]);
  const [amountTendered, setAmountTendered] = React.useState('');
  const [showReceiptOnMobile, setShowReceiptOnMobile] = React.useState(false);
  const [checkNumber, setCheckNumber] = React.useState('');
  const [amountInWords, setAmountInWords] = React.useState('');
  const [dueDate, setDueDate] = React.useState(new Date().toLocaleDateString());
  const [creditTerm, setCreditTerm] = React.useState('CASH/TODAY');
  const [creditCardType, setCreditCardType] = React.useState('');
  const [creditCardLast4, setCreditCardLast4] = React.useState('');
  const [bills, setBills] = React.useState({ b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0 });

  const handleBillChange = (bill: keyof typeof bills, value: string) => {
    const numValue = parseInt(value) || 0;
    const newBills = { ...bills, [bill]: numValue };
    setBills(newBills);
    
    const newTotal = (newBills.b100 * 100) + (newBills.b50 * 50) + (newBills.b20 * 20) + 
                     (newBills.b10 * 10) + (newBills.b5 * 5) + (newBills.b1 * 1);
    setAmountTendered(newTotal.toString());
  };

  const client = clients.find(c => c.id === selectedClient);
  const salesman = salesmen.find(s => s.id === selectedSalesman);
  
  // Logic to determine if we should use the Wholesale Invoice layout
  const isWholesale = businessCategory?.id === 'wholesale' ||
                      (!['restaurant', 'retail', 'grocery', 'combo'].includes(businessCategory?.id || '')) && (
                        (client && client.terminosCredito && client.terminosCredito !== 'CASH/TODAY') ||
                        (businessCategory?.name?.toLowerCase().includes('wholesale')) ||
                        (storeSettings.nombre?.toLowerCase().includes('wholesale'))
                      );

  // Logic to determine which print preview to display
  const displayFormat = ['restaurant', 'retail', 'grocery', 'combo'].includes(businessCategory?.id || '')
    ? (storeSettings.printFormat || 'ticket')
    : 'invoice';

  const [showWholesalePayment, setShowWholesalePayment] = React.useState(false);

  const taxRate = taxes.reduce((acc, tax) => acc + (tax.porcentaje !== undefined ? tax.porcentaje : ((tax as any).tasa ?? 0)), 0);
  const creditSurcharge = storeSettings.creditSurcharge || 4; // Default 4% if not set
  
  const subtotal = cart.reduce((acc, item) => {
    const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
    return acc + (((item.precio || 0) + modifierTotal) * (item.cantidad || 1));
  }, 0);
  const discount = cart.reduce((acc, item) => {
    const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
    const itemPrice = item.precio || 0;
    if (item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
       const q = item.cantidad || 1;
       const remainder = q % item.promo.quantity;
       return acc + (((itemPrice + modifierTotal) * ((item.descuento || 0) / 100)) * remainder);
    }
    return acc + (((item.precio || 0) + modifierTotal) * ((item.descuento || 0) / 100)) * (item.cantidad || 1);
  }, 0);

  // EBT split calculations
  let ebtSubtotal = 0;
  let ebtDiscount = 0;
  let nonEbtSubtotal = 0;
  let nonEbtDiscount = 0;
  let nonEbtTaxAmount = 0;
  const nonEbtTaxesAppliedMap = new Map<string, { name: string, amount: number, rate: number }>();

  cart.forEach(item => {
    const itemPrice = item.precio || 0;
    const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
    let itemTotal = 0;
    let itemDiscountAmount = 0;
    
    if (item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
      const q = item.cantidad || 1;
      const sets = Math.floor(q / item.promo.quantity);
      const remainder = q % item.promo.quantity;
      const remainderTotal = (remainder * (itemPrice + modifierTotal)) * (1 - (item.descuento || 0) / 100);
      itemTotal = (sets * item.promo.price) + remainderTotal;
      itemDiscountAmount = (((itemPrice + modifierTotal) * ((item.descuento || 0) / 100)) * remainder);
    } else {
      itemTotal = ((item.precio || 0) + modifierTotal) * (1 - (item.descuento || 0) / 100) * (item.cantidad || 1);
      itemDiscountAmount = (((item.precio || 0) + modifierTotal) * ((item.descuento || 0) / 100)) * (item.cantidad || 1);
    }
    
    const category = categories.find(c => c.nombre === item.categoria);
    const isEbtItem = category?.ebt === true;
    
    if (isEbtItem) {
      ebtSubtotal += ((item.precio || 0) + modifierTotal) * (item.cantidad || 1);
      ebtDiscount += itemDiscountAmount;
    } else {
      nonEbtSubtotal += ((item.precio || 0) + modifierTotal) * (item.cantidad || 1);
      nonEbtDiscount += itemDiscountAmount;
      
      if (category && category.taxIds && category.taxIds.length > 0) {
        category.taxIds.forEach(taxId => {
          const tax = taxes.find(t => t.id === taxId);
          if (tax) {
            const rawRate = tax.porcentaje !== undefined ? tax.porcentaje : ((tax as any).tasa ?? 0);
            const amount = itemTotal * (rawRate / 100);
            nonEbtTaxAmount += amount;
            
            if (nonEbtTaxesAppliedMap.has(tax.id)) {
              const existing = nonEbtTaxesAppliedMap.get(tax.id)!;
              existing.amount += amount;
            } else {
              nonEbtTaxesAppliedMap.set(tax.id, { name: tax.nombre, amount, rate: rawRate });
            }
          }
        });
      } else {
        taxes.forEach(tax => {
          const rawRate = tax.porcentaje !== undefined ? tax.porcentaje : ((tax as any).tasa ?? 0);
          const amount = itemTotal * (rawRate / 100);
          nonEbtTaxAmount += amount;
          
          if (nonEbtTaxesAppliedMap.has(tax.id)) {
            const existing = nonEbtTaxesAppliedMap.get(tax.id)!;
            existing.amount += amount;
          } else {
            nonEbtTaxesAppliedMap.set(tax.id, { name: tax.nombre, amount, rate: rawRate });
          }
        });
      }
    }
  });

  const ebtTotal = ebtSubtotal - ebtDiscount;
  const nonEbtBaseTotal = nonEbtSubtotal - nonEbtDiscount + nonEbtTaxAmount;

  const isEbtSelected = paymentMethod === 'EBT' || paymentMethod?.startsWith('EBT') || checkoutStep === 'ebt_split';
  
  let taxAmount = 0;
  let taxesApplied = Array.from(nonEbtTaxesAppliedMap.values()).filter(t => t.rate > 0 || t.amount > 0);
  
  if (!isEbtSelected) {
    let normalTaxAmount = 0;
    const normalTaxesAppliedMap = new Map<string, { name: string, amount: number, rate: number }>();
    
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
        itemTotal = ((item.precio || 0) + modifierTotal) * (1 - (item.descuento || 0) / 100) * (item.cantidad || 1);
      }
      
      const category = categories.find(c => c.nombre === item.categoria);
      if (category && category.taxIds && category.taxIds.length > 0) {
        category.taxIds.forEach(taxId => {
          const tax = taxes.find(t => t.id === taxId);
          if (tax) {
            const rawRate = tax.porcentaje !== undefined ? tax.porcentaje : ((tax as any).tasa ?? 0);
            const amount = itemTotal * (rawRate / 100);
            normalTaxAmount += amount;
            if (normalTaxesAppliedMap.has(tax.id)) {
              normalTaxesAppliedMap.get(tax.id)!.amount += amount;
            } else {
              normalTaxesAppliedMap.set(tax.id, { name: tax.nombre, amount, rate: rawRate });
            }
          }
        });
      } else {
        taxes.forEach(tax => {
          const rawRate = tax.porcentaje !== undefined ? tax.porcentaje : ((tax as any).tasa ?? 0);
          const amount = itemTotal * (rawRate / 100);
          normalTaxAmount += amount;
          if (normalTaxesAppliedMap.has(tax.id)) {
            normalTaxesAppliedMap.get(tax.id)!.amount += amount;
          } else {
            normalTaxesAppliedMap.set(tax.id, { name: tax.nombre, amount, rate: rawRate });
          }
        });
      }
    });
    
    taxAmount = normalTaxAmount;
    taxesApplied = Array.from(normalTaxesAppliedMap.values()).filter(t => t.rate > 0 || t.amount > 0);
  } else {
    taxAmount = nonEbtTaxAmount;
  }
  
  const baseTotal = subtotal - discount + taxAmount;
  const tipAmount = tipPercentage > 0 ? (baseTotal * (tipPercentage / 100)) : (parseFloat(customTip) || 0);

  const nonEbtTotalCash = nonEbtBaseTotal + tipAmount;
  const nonEbtTotalCredit = (nonEbtBaseTotal * (1 + creditSurcharge / 100)) + tipAmount;

  const totalCash = isEbtSelected ? (ebtTotal + nonEbtTotalCash) : (baseTotal + tipAmount);
  const totalCredit = isEbtSelected ? (ebtTotal + nonEbtTotalCredit) : ((baseTotal * (1 + creditSurcharge / 100)) + tipAmount);

  const currentTotal = paymentMethod === 'Credit' ? totalCredit : totalCash;
  const changeDue = Math.max(0, (parseFloat(amountTendered) || 0) - (isEbtSelected && paymentMethod === 'EBT + Cash' ? nonEbtTotalCash : currentTotal));

  useEffect(() => {
    if (checkoutStep === 'split') {
      const equalAmount = totalCash / splitCount;
      setSplits(Array(splitCount).fill(null).map(() => ({ amount: equalAmount, method: 'Cash' })));
    }
  }, [checkoutStep, splitCount, totalCash]);

  useEffect(() => {
    if (paymentMethod === 'Check') {
      setAmountInWords(convertNumberToWords(currentTotal));
    }
  }, [paymentMethod, currentTotal]);

  useEffect(() => {
    if (client) {
      setCreditTerm(client.terminosCredito || 'CASH/TODAY');
      onSelectClient?.(client);
    }
  }, [client, onSelectClient]);

  useEffect(() => {
    // Match "Net 7", "nett 7", "7", "7 dias", etc. by extracting any sequence of digits
    const match = creditTerm.match(/(\d+)/);
    if (match) {
      const days = parseInt(match[1], 10);
      const d = new Date();
      d.setDate(d.getDate() + days);
      setDueDate(d.toLocaleDateString());
    } else {
      setDueDate(new Date().toLocaleDateString());
    }
  }, [creditTerm]);

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    if (!client?.email) {
      toast.error('El cliente no tiene un email configurado.');
      return;
    }
    const subject = `Factura de ${storeSettings.nombre || 'Tienda'}`;
    const body = `Hola ${client.nombre || 'Cliente'},\n\nGracias por su compra. A continuacion los detalles de la orden:\n\n${cart.map(item => `${item.cantidad || item.quantity || 1}x ${item.nombre || item.name || 'Articulo'} - $${(((item.precio || item.price) || 0) * (item.cantidad || item.quantity || 1)).toFixed(2)}`).join('\n')}\n\nTotal: $${currentTotal.toFixed(2)}\n\n¡Gracias por su preferencia!\n${storeSettings.nombre || ''}`;
    
    let mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (storeSettings.emailContacts && storeSettings.emailContacts.length > 0) {
      const bccEmails = storeSettings.emailContacts.map((c: any) => c.email).join(',');
      mailtoUrl += `&bcc=${encodeURIComponent(bccEmails)}`;
    }
    
    window.location.href = mailtoUrl;
    toast.success(`Abriendo cliente de correo para ${client.email}`);
  };

  const handleQuantityChange = (cartId: string, newQuantity: number) => {
    if (onUpdateQuantity) {
      onUpdateQuantity(cartId, newQuantity);
    }
  };

  const handleComplete = (overrideMethod?: typeof paymentMethod) => {
    const activeMethod = overrideMethod || paymentMethod;
    const selectedClientObj = clients.find(c => c.id === selectedClient);
    
    let finalTotal = totalCash;
    let finalTaxAmount = taxAmount;
    let finalTaxesApplied = taxesApplied;
    let finalSplits = splits;
    
    if (activeMethod === 'Credit') {
      finalTotal = totalCredit;
    } else if (activeMethod === 'EBT') {
      finalTotal = ebtTotal;
      finalTaxAmount = 0;
      finalTaxesApplied = [];
      finalSplits = [{ amount: ebtTotal, method: 'EBT' }];
    } else if (activeMethod === 'EBT + Cash') {
      finalTotal = ebtTotal + nonEbtTotalCash;
      finalTaxAmount = nonEbtTaxAmount;
      finalTaxesApplied = Array.from(nonEbtTaxesAppliedMap.values()).filter(t => t.rate > 0 || t.amount > 0);
      finalSplits = [
        { amount: ebtTotal, method: 'EBT' },
        { amount: nonEbtTotalCash, method: 'Cash' }
      ];
    } else if (activeMethod === 'EBT + Credit') {
      finalTotal = ebtTotal + nonEbtTotalCredit;
      finalTaxAmount = nonEbtTaxAmount;
      finalTaxesApplied = Array.from(nonEbtTaxesAppliedMap.values()).filter(t => t.rate > 0 || t.amount > 0);
      finalSplits = [
        { amount: ebtTotal, method: 'EBT' },
        { amount: nonEbtTotalCredit, method: 'Credit' }
      ];
    }

    onComplete({
      clienteId: selectedClient,
      cliente: selectedClientObj,
      vendedorId: selectedSalesman,
      metodoPago: activeMethod as any,
      checkNumber: activeMethod === 'Check' ? checkNumber : undefined,
      montoLetras: activeMethod === 'Check' ? amountInWords : undefined,
      checkDate: activeMethod === 'Check' ? dueDate : undefined,
      terminosCredito: creditTerm,
      creditCardType: (activeMethod === 'Credit' || activeMethod === 'EBT + Credit') ? creditCardType : undefined,
      creditCardLast4: (activeMethod === 'Credit' || activeMethod === 'EBT + Credit') ? creditCardLast4 : undefined,
      amountTendered: (activeMethod === 'Cash' || activeMethod === 'EBT + Cash') ? parseFloat(amountTendered) || 0 : undefined,
      changeDue: (activeMethod === 'Cash' || activeMethod === 'EBT + Cash') ? changeDue : undefined,
      bills: (activeMethod === 'Cash' || activeMethod === 'EBT + Cash') ? bills : undefined,
      tax: finalTaxAmount,
      taxesApplied: finalTaxesApplied,
      taxRate: taxRate,
      tip: tipAmount,
      total: finalTotal,
      splits: (activeMethod === 'Split' || activeMethod?.startsWith('EBT')) ? finalSplits : undefined,
      articulos: cart,
      estado: 'Pagado',
      fecha: Date.now(),
      factura: `INV-${Math.floor(Math.random() * 1000000)}`,
      proveedor: storeSettings.nombre
    });
  };

  const renderCheckout = () => {
    switch (checkoutStep) {
      case 'method':
        return (
          <div className="flex-1 flex flex-col p-4 lg:p-6 bg-gray-50/30 overflow-y-auto">
            {showTips && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AÑADIR PROPINA</h3>
                  <span className="text-green-600 font-black text-base">+${tipAmount.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[10, 15, 18, 20].map(pct => (
                    <button
                      key={pct}
                      onClick={() => { setTipPercentage(pct); setCustomTip(''); }}
                      className={`py-2 rounded-xl font-black text-sm transition-all ${
                        tipPercentage === pct 
                          ? 'bg-green-600 text-white shadow-lg shadow-green-100' 
                          : 'bg-white border-2 border-gray-100 text-gray-600 hover:border-green-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">$</span>
                    <input 
                      type="text"
                      placeholder="Otro"
                      value={customTip}
                      onChange={e => {
                        setCustomTip(formatMoneyInput(e.target.value));
                        setTipPercentage(0);
                      }}
                      className="w-full pl-5 pr-2 py-2 bg-white border-2 border-gray-100 rounded-xl font-black text-xs outline-none focus:border-green-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center py-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">SELECCIONE MÉTODO</span>
              <span className="text-3xl lg:text-4xl font-black text-gray-900 mb-4 lg:mb-6">${totalCash.toFixed(2)}</span>

              <div className="w-full max-w-lg grid grid-cols-5 gap-2">
                <button 
                  onClick={() => { setPaymentMethod('Cash'); setCheckoutStep('cash'); }}
                  className="bg-white p-3 rounded-2xl border-2 border-gray-100 hover:border-green-500 hover:shadow-lg transition-all group flex flex-col items-center gap-1"
                >
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-black text-gray-900 uppercase tracking-widest">EFECTIVO</span>
                </button>

                <button 
                  onClick={() => { setPaymentMethod('Credit'); handleComplete(); }}
                  className="bg-white p-3 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:shadow-lg transition-all group flex flex-col items-center gap-1"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-black text-gray-900 uppercase tracking-widest">TARJETA</span>
                </button>

                <button 
                  onClick={() => { setPaymentMethod('Check'); setCheckoutStep('check'); }}
                  className="bg-white p-3 rounded-2xl border-2 border-gray-100 hover:border-purple-500 hover:shadow-lg transition-all group flex flex-col items-center gap-1"
                >
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-black text-gray-900 uppercase tracking-widest">CHEQUE</span>
                </button>

                <button 
                  onClick={() => { setPaymentMethod('Split'); setCheckoutStep('split'); }}
                  className="bg-white p-3 rounded-2xl border-2 border-gray-100 hover:border-orange-500 hover:shadow-lg transition-all group flex flex-col items-center gap-1"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-black text-gray-900 uppercase tracking-widest">DIVIDIR</span>
                </button>

                <button 
                  onClick={() => {
                    if (ebtTotal <= 0) {
                      toast.error('No hay artículos elegibles para EBT SNAP en la orden.');
                      return;
                    }
                    if (nonEbtSubtotal > 0) {
                      setPaymentMethod('EBT');
                      setCheckoutStep('ebt_split');
                    } else {
                      setPaymentMethod('EBT');
                      handleComplete('EBT');
                    }
                  }}
                  className="bg-white p-3 rounded-2xl border-2 border-gray-100 hover:border-emerald-500 hover:shadow-lg transition-all group flex flex-col items-center gap-1"
                >
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-black text-amber-900 uppercase tracking-widest">EBT</span>
                </button>
              </div>
            </div>
          </div>
        );

      case 'cash':
        return (
          <div className="flex-1 flex flex-col p-4 lg:p-8 bg-gray-50/30">
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="bg-white p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] border-2 border-gray-100 w-full max-w-md text-center mb-6 lg:mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest">
                  Propina: ${tipAmount.toFixed(2)}
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">TOTAL A PAGAR</span>
                <span className="text-4xl lg:text-6xl font-black text-gray-900">${totalCash.toFixed(2)}</span>
              </div>

              <div className="w-full max-w-md space-y-6 lg:space-y-8">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block text-center">EFECTIVO RECIBIDO</span>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl lg:text-4xl font-black text-gray-300">$</span>
                    <input 
                      type="text"
                      value={amountTendered}
                      onChange={e => setAmountTendered(formatMoneyInput(e.target.value))}
                      className="w-full bg-white border-4 border-green-500 rounded-[2rem] p-6 lg:p-8 text-4xl lg:text-6xl font-black text-center text-gray-900 outline-none shadow-2xl shadow-green-100"
                      placeholder="0.00"
                    />
                  </div>
                  {parseFloat(amountTendered) > totalCash && (
                    <div className="mt-4 bg-blue-50 p-4 rounded-2xl border-2 border-blue-100 animate-in slide-in-from-top-2 duration-300">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">CAMBIO A ENTREGAR</span>
                      <span className="text-4xl font-black text-blue-600">${changeDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {[5, 10, 20, 50, 100].map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        const current = parseFloat(amountTendered) || 0;
                        setAmountTendered((current + val).toString());
                      }}
                      className="py-6 bg-white border-2 border-gray-100 rounded-2xl font-black text-xl text-gray-600 hover:border-green-500 hover:text-green-600 transition-all active:scale-95"
                    >
                      +{val}
                    </button>
                  ))}
                </div>

                <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block text-center">CONTADOR DE BILLETES</span>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: 'b100', label: '$100' },
                      { key: 'b50', label: '$50' },
                      { key: 'b20', label: '$20' },
                      { key: 'b10', label: '$10' },
                      { key: 'b5', label: '$5' },
                      { key: 'b1', label: '$1' },
                    ].map((bill) => (
                      <div key={bill.key} className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-gray-500 mb-1">{bill.label}</span>
                        <input
                          type="number"
                          min="0"
                          value={bills[bill.key as keyof typeof bills] || ''}
                          onChange={(e) => handleBillChange(bill.key as keyof typeof bills, e.target.value)}
                          className="w-full text-center py-2 bg-gray-50 border-2 border-gray-100 rounded-xl font-black text-lg outline-none focus:border-green-500 transition-all"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-8">
                  <button onClick={() => setCheckoutStep('method')} className="p-6 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all">
                    <X className="w-8 h-8" />
                  </button>
                  <button onClick={handlePrint} className="p-6 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all">
                    <PrinterIcon className="w-8 h-8" />
                  </button>
                  <button 
                    onClick={handleComplete}
                    disabled={!amountTendered || parseFloat(amountTendered) < totalCash}
                    className="flex-1 bg-green-500 text-white rounded-[2rem] font-black text-2xl shadow-xl shadow-green-100 hover:bg-green-600 transition-all disabled:opacity-50 disabled:grayscale"
                  >
                    <CheckCircle className="w-8 h-8 mx-auto" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'check':
        return (
          <div className="flex-1 flex flex-col p-4 lg:p-8 bg-gray-50/30">
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="bg-white p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] border-2 border-gray-100 w-full max-w-md text-center mb-6 lg:mb-8">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">TOTAL A PAGAR</span>
                <span className="text-4xl lg:text-6xl font-black text-gray-900">${totalCash.toFixed(2)}</span>
              </div>

              <div className="w-full max-w-md space-y-6 lg:space-y-8">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block text-center">NÚMERO DE CHEQUE</span>
                  <div className="relative">
                    <Ticket className="absolute left-6 top-1/2 -translate-y-1/2 text-purple-300 w-8 h-8" />
                    <input 
                      type="text"
                      value={checkNumber}
                      onChange={e => setCheckNumber(e.target.value)}
                      className="w-full bg-white border-4 border-purple-500 rounded-[2rem] p-6 lg:p-8 pl-20 text-4xl font-black text-center text-gray-900 outline-none shadow-2xl shadow-purple-100"
                      placeholder="0000"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-8">
                  <button onClick={() => setCheckoutStep('method')} className="p-6 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all">
                    <X className="w-8 h-8" />
                  </button>
                  <button 
                    onClick={handleComplete}
                    disabled={!checkNumber}
                    className="flex-1 bg-purple-600 text-white rounded-[2rem] font-black text-2xl shadow-xl shadow-purple-100 hover:bg-purple-700 transition-all disabled:opacity-50 disabled:grayscale"
                  >
                    <CheckCircle className="w-8 h-8 mx-auto" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'split':
        return (
          <div className="flex-1 flex flex-col p-4 lg:p-8 bg-gray-50/30 overflow-y-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 bg-white p-4 rounded-2xl border-2 border-gray-100">
              <div className="text-center sm:text-left">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">TOTAL A DIVIDIR</span>
                <span className="text-2xl lg:text-3xl font-black text-gray-900">${totalCash.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setSplitCount(Math.max(2, splitCount - 1))} className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-all">
                  <span className="text-2xl font-black">-</span>
                </button>
                <span className="text-4xl font-black text-gray-900 w-12 text-center">{splitCount}</span>
                <button onClick={() => setSplitCount(splitCount + 1)} className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-all">
                  <span className="text-2xl font-black">+</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {splits.map((split, idx) => (
                <div key={idx} className="bg-white p-4 rounded-[1.5rem] border-2 border-gray-100 flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 font-black">
                    {idx + 1}
                  </div>
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black">$</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={split.amount === 0 ? '' : split.amount}
                      onChange={e => {
                        const newAmount = parseFloat(e.target.value) || 0;
                        const newSplits = [...splits];
                        newSplits[idx].amount = newAmount;
                        
                        // Recalculate other splits
                        if (splitCount > 1) {
                          const remainingAmount = totalCash - newAmount;
                          const otherSplitsCount = splitCount - 1;
                          const equalShare = remainingAmount / otherSplitsCount;
                          
                          splits.forEach((_, sIdx) => {
                            if (sIdx !== idx) {
                              newSplits[sIdx].amount = Math.max(0, equalShare);
                            }
                          });
                        }
                        
                        setSplits(newSplits);
                      }}
                      className="w-full pl-10 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-xl font-black text-2xl outline-none transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const newSplits = [...splits];
                        newSplits[idx].method = 'Credit';
                        setSplits(newSplits);
                      }}
                      className={`p-4 rounded-xl transition-all ${split.method === 'Credit' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}
                    >
                      <CreditCard className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => {
                        const newSplits = [...splits];
                        newSplits[idx].method = 'Cash';
                        setSplits(newSplits);
                      }}
                      className={`p-4 rounded-xl transition-all ${split.method === 'Cash' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}
                    >
                      <DollarSign className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-8">
              <div className="bg-green-50 p-4 rounded-2xl text-center mb-8 border border-green-100">
                <p className="text-green-600 font-black uppercase tracking-widest text-xs">Montos coinciden perfectamente</p>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setCheckoutStep('method')} className="px-8 py-6 bg-blue-50 text-blue-600 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-100 transition-all">
                  ATRÁS
                </button>
                <button onClick={handlePrint} className="p-6 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all">
                  <PrinterIcon className="w-8 h-8" />
                </button>
                <button 
                  onClick={handleComplete}
                  className="flex-1 bg-orange-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all"
                >
                  COMPLETAR DIVISIÓN
                </button>
              </div>
            </div>
          </div>
        );

      case 'ebt_split':
        return (
          <div className="flex-1 flex flex-col p-4 lg:p-8 bg-gray-50/30 overflow-y-auto">
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="bg-white p-6 lg:p-8 rounded-[2rem] border-2 border-gray-100 w-full max-w-md text-center mb-6 lg:mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest">
                  EBT CUBIERTO: ${ebtTotal.toFixed(2)}
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">CANTIDAD RESTANTE</span>
                <div className="flex flex-col gap-1 my-3">
                  <span className="text-3xl font-black text-green-600">${nonEbtTotalCash.toFixed(2)} <span className="text-[10px] text-gray-400 font-bold block">SI PAGA EN EFECTIVO</span></span>
                  <span className="text-3xl font-black text-blue-600">${nonEbtTotalCredit.toFixed(2)} <span className="text-[10px] text-gray-400 font-bold block">SI PAGA CON TARJETA</span></span>
                </div>
                <p className="text-xs text-amber-600 font-bold mt-2">¿Cómo desea pagar el cliente el saldo pendiente?</p>
              </div>

              <div className="w-full max-w-md grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setPaymentMethod('EBT + Cash');
                    setCheckoutStep('cash');
                  }}
                  className="bg-white p-6 rounded-2xl border-2 border-gray-100 hover:border-green-500 hover:shadow-lg transition-all group flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black text-gray-900 uppercase tracking-widest">PAGAR EFECTIVO</span>
                  <span className="text-[10px] font-bold text-gray-500">${nonEbtTotalCash.toFixed(2)}</span>
                </button>

                <button 
                  onClick={() => {
                    setPaymentMethod('EBT + Credit');
                    handleComplete('EBT + Credit');
                  }}
                  className="bg-white p-6 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:shadow-lg transition-all group flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black text-gray-900 uppercase tracking-widest">PAGAR TARJETA</span>
                  <span className="text-[10px] font-bold text-gray-500">${nonEbtTotalCredit.toFixed(2)}</span>
                </button>
              </div>

              <div className="mt-8">
                <button 
                  onClick={() => {
                    setCheckoutStep('method');
                    setPaymentMethod('');
                  }} 
                  className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all"
                >
                  ATRÁS / CANCELAR
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  const getDisplaySplits = () => {
    if (checkoutStep === 'ebt_split') {
      return [
        { amount: ebtTotal, method: 'EBT' },
        { amount: nonEbtTotalCash, method: 'Debe (Cash/Card)' }
      ];
    }
    if (paymentMethod === 'EBT + Cash') {
      return [
        { amount: ebtTotal, method: 'EBT' },
        { amount: nonEbtTotalCash, method: 'Cash' }
      ];
    }
    if (paymentMethod === 'EBT + Credit') {
      return [
        { amount: ebtTotal, method: 'EBT' },
        { amount: nonEbtTotalCredit, method: 'Credit' }
      ];
    }
    return splits;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 print:static print:bg-white print:block print:p-0">
      <div className={`bg-white rounded-[2.5rem] shadow-2xl w-full ${storeSettings.printFormat === 'ticket' ? 'max-w-4xl' : 'max-w-[95vw]'} max-h-[95vh] flex flex-col overflow-hidden border border-white/20 print:shadow-none print:max-w-none print:h-auto print:max-h-none print:overflow-visible`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 lg:p-8 border-b border-gray-100 bg-white shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {displayFormat === 'invoice' ? 'Wholesale Order Invoice' : 'Sale Ticket'}
              </h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {displayFormat === 'invoice' ? 'B2B Order Management' : 'Checkout & Print Preview'}
              </p>
            </div>
            <button 
              onClick={() => setShowReceiptOnMobile(!showReceiptOnMobile)}
              className="lg:hidden px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              {showReceiptOnMobile ? 'VER PAGO' : 'VER TICKET'}
            </button>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-all">
            <X className="w-8 h-8 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Side: Receipt Preview */}
          <div className={`${showReceiptOnMobile ? 'flex' : 'hidden lg:flex'} w-full ${displayFormat === 'invoice' ? 'lg:flex-1' : 'lg:w-[400px]'} bg-gray-100/50 p-6 lg:p-8 flex flex-col items-center justify-center lg:border-r border-gray-100 overflow-y-auto print:block print:p-0 print:w-full print:bg-white print:border-none`}>
            {displayFormat === 'invoice' ? (
              <InvoicePreview 
                cart={cart}
                storeSettings={storeSettings}
                salesman={salesman}
                client={client}
                subtotal={subtotal}
                taxAmount={taxAmount}
                taxesApplied={taxesApplied}
                tipAmount={tipAmount}
                totalCash={totalCash}
                totalCredit={totalCredit}
                creditSurcharge={creditSurcharge}
                paymentMethod={paymentMethod}
                creditTerm={creditTerm}
                dueDate={dueDate}
                splits={getDisplaySplits()}
                bills={bills}
                onBarcodeClick={onBarcodeClick}
              />
            ) : (
              <TicketPreview 
                cart={cart}
                storeSettings={storeSettings}
                salesman={salesman}
                subtotal={subtotal}
                taxAmount={taxAmount}
                taxesApplied={taxesApplied}
                tipAmount={tipAmount}
                totalCash={totalCash}
                totalCredit={totalCredit}
                creditSurcharge={creditSurcharge}
                paymentMethod={paymentMethod}
                splits={getDisplaySplits()}
                bills={bills}
                onBarcodeClick={onBarcodeClick}
              />
            )}
            <div className="mt-8 flex gap-4 print:hidden w-full max-w-2xl">
              <button 
                onClick={handlePrint} 
                className="flex-1 py-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-gray-700 flex items-center justify-center gap-2 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
              >
                <PrinterIcon className="w-5 h-5" /> PRINT
              </button>
              <button 
                onClick={handleEmail} 
                className="flex-1 py-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-gray-700 flex items-center justify-center gap-2 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
              >
                <Mail className="w-5 h-5" /> EMAIL
              </button>
              {isWholesale ? (
                <button 
                  onClick={() => setShowWholesalePayment(true)} 
                  className="flex-[1.5] py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-5 h-5" /> PAYMENT
                </button>
              ) : (
                checkoutStep === 'method' && (
                  <button 
                    onClick={handleComplete} 
                    className="flex-[1.5] py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all shadow-xl shadow-green-100 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" /> COMPLETAR
                  </button>
                )
              )}
            </div>
          </div>

          {/* Right Side: Checkout Flow */}
          {!isWholesale && (
            <div className={`${!showReceiptOnMobile ? 'flex' : 'hidden lg:flex'} flex-1 flex flex-col print:hidden overflow-y-auto`}>
              {renderCheckout()}
            </div>
          )}

          {/* Wholesale Payment Modal Overlay */}
          {isWholesale && showWholesalePayment && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-white/20">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Select Payment Method</h3>
                  </div>
                  <button onClick={() => setShowWholesalePayment(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {renderCheckout()}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default InvoiceModal;
