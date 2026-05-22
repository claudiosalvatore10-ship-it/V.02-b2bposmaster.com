import React from 'react';
import { CartItem, StoreSettings, Salesman, Client } from '../types';

const numberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  };

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let words = '';
  if (integerPart === 0) words = 'Zero';
  else {
    if (integerPart >= 1000) {
      words += convertLessThanThousand(Math.floor(integerPart / 1000)) + ' Thousand ';
    }
    words += convertLessThanThousand(integerPart % 1000);
  }

  return `${words} Dollars and ${decimalPart}/100`;
};

interface PreviewProps {
  cart: CartItem[];
  storeSettings: StoreSettings;
  salesman?: Salesman | null;
  client?: Client | null;
  subtotal: number;
  taxAmount: number;
  taxesApplied?: { name: string; amount: number; rate: number }[];
  tipAmount?: number;
  totalCash: number;
  totalCredit: number;
  creditSurcharge: number;
  paymentMethod?: string;
  creditTerm?: string;
  dueDate?: string;
  splits?: { amount: number; method: string }[];
}

export const KitchenTicketPreview: React.FC<{
  cart: CartItem[];
  storeSettings: StoreSettings;
  tableName?: string;
  customerName?: string;
}> = ({ cart, storeSettings, tableName, customerName }) => {
  // Group items by seatId
  const itemsBySeat = cart.reduce((acc, item) => {
    const seat = item.seatId || 'General';
    if (!acc[seat]) acc[seat] = [];
    acc[seat].push(item);
    return acc;
  }, {} as Record<string, CartItem[]>);

  return (
    <div className="w-full max-w-[320px] bg-white p-6 font-mono text-[12px] shadow-inner border border-gray-100 rounded-sm relative overflow-hidden">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black uppercase tracking-widest mb-2">KITCHEN TICKET</h1>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest space-y-1">
          <p>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
          {(tableName || customerName) && (
            <p className="text-sm text-black mt-2">
              {tableName ? `TABLE: ${tableName}` : ''}
              {tableName && customerName ? ' - ' : ''}
              {customerName ? `CUSTOMER: ${customerName}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 mb-8">
        {(Object.entries(itemsBySeat) as [string, CartItem[]][]).map(([seat, items]) => (
          <div key={seat} className="border-t-2 border-black border-dashed pt-4 mt-4">
            <h3 className="font-black text-sm uppercase mb-2">Seat / Box: {seat}</h3>
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b-2 border-gray-900 pb-2 mb-2">
              <span>QTY</span>
              <span>ITEM</span>
            </div>
            {items.map((item, index) => (
              <div key={index} className="space-y-1 my-2">
                <div className="flex gap-3 text-base font-black">
                  <span className="w-6">{item.cantidad}</span>
                  <span className="flex-1">{item.nombre}</span>
                </div>
                {item.promo && item.promo.type === 'combo' && item.promo.items && (
                  <div className="pl-9 space-y-1">
                    {item.promo.items.map((promoItem, pIdx) => (
                      <div key={`p-${pIdx}`} className="text-sm font-bold text-gray-700">
                        • {promoItem.cantidad}x {promoItem.nombre}
                      </div>
                    ))}
                  </div>
                )}
                {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                  <div className="pl-9 space-y-1">
                    {item.selectedModifiers.map((mod, mIdx) => (
                      <div key={mIdx} className="text-sm font-bold text-gray-600">
                        + {mod.modifierName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      
      <div className="text-center mt-8 border-t-2 border-gray-900 border-dashed pt-4">
        <p className="text-sm font-black uppercase tracking-widest">END OF TICKET</p>
      </div>
    </div>
  );
};

export const TicketPreview: React.FC<PreviewProps> = ({
  cart,
  storeSettings,
  salesman,
  subtotal,
  taxAmount,
  taxesApplied,
  tipAmount = 0,
  totalCash,
  totalCredit,
  creditSurcharge,
  paymentMethod,
  splits
}) => (
  <div className="w-full max-w-[320px] bg-white p-6 font-mono text-[11px] shadow-inner border border-gray-100 rounded-sm relative overflow-hidden">
    {/* Receipt Decoration */}
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"></div>
    
    <div className="text-center mb-6">
      <h1 className="text-base font-black uppercase tracking-tight mb-1">{storeSettings.nombre || 'GOURMET GROCERS'}</h1>
      <p className="text-[9px] text-gray-500 leading-tight">{storeSettings.direccion || '123 Market St, Freshville'}</p>
      {storeSettings.telefono && <p className="text-[9px] text-gray-500 leading-tight">TEL: {storeSettings.telefono}</p>}
    </div>

    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1 uppercase tracking-tighter">
      <span>DATE: {new Date().toLocaleDateString()}</span>
      <span>TIME: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>
    <div className="flex justify-between text-[10px] font-black mb-4 uppercase">
      <span>ORDER: PHONE / TAKEOUT</span>
      <span>SERVER: {salesman?.nombre || 'SYSTEM'}</span>
    </div>

    <div className="border-t border-gray-200 pt-3 space-y-2 mb-4">
      {cart.map((item, idx) => {
        const itemQuantity = item.cantidad || 0;
        const itemPrice = item.precio || 0;
        const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
        const itemTotal = (itemPrice + modifierTotal) * itemQuantity;
        return (
          <div key={idx} className="space-y-0.5">
            <div className="flex justify-between items-start">
              <div className="flex-1 pr-2">
                <span className="font-bold">{item.cantidad}X</span> {item.nombre.toUpperCase()}
              </div>
              <div className="flex gap-3 text-right">
                <span className="font-bold text-gray-900">${itemTotal.toFixed(2)}</span>
                <span className="text-gray-300">${(itemTotal * (1 + creditSurcharge/100)).toFixed(2)}</span>
              </div>
            </div>
            {item.promo && item.promo.type === 'combo' && item.promo.items && item.promo.items.map((promoItem, pIdx) => (
              <div key={`p-${pIdx}`} className="pl-6 text-[9px] text-gray-600 font-bold uppercase italic">
                • {promoItem.cantidad}X {promoItem.nombre.toUpperCase()}
              </div>
            ))}
            {(item.selectedModifiers || []).map((mod, midx) => (
              <div key={midx} className="pl-6 text-[9px] text-gray-400 italic">
                + {mod.modifierName.toUpperCase()} {mod.precio > 0 ? `($${mod.precio.toFixed(2)})` : ''}
              </div>
            ))}
          </div>
        );
      })}
    </div>

    <div className="border-t border-gray-100 pt-3 space-y-1">
      <div className="flex justify-between text-gray-500 font-bold">
        <span className="uppercase tracking-widest text-[9px]">SUBTOTAL</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      {taxesApplied && taxesApplied.length > 0 ? (
        taxesApplied.map((tax, idx) => (
          <div key={idx} className="flex justify-between text-gray-500 font-bold">
            <span className="uppercase tracking-widest text-[9px]">{tax.name} ({tax.rate}%)</span>
            <span>${tax.amount.toFixed(2)}</span>
          </div>
        ))
      ) : taxAmount > 0 ? (
        <div className="flex justify-between text-gray-500 font-bold">
          <span className="uppercase tracking-widest text-[9px]">TAX</span>
          <span>${taxAmount.toFixed(2)}</span>
        </div>
      ) : null}
      {tipAmount > 0 && (
        <div className="flex justify-between text-gray-500 font-bold">
          <span className="uppercase tracking-widest text-[9px]">PROPINA</span>
          <span>${tipAmount.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between text-base font-black pt-2 border-t border-gray-200 mt-2">
        <span className="uppercase">TOTAL CASH</span>
        <span>${totalCash.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-2">
        <span className="uppercase tracking-widest text-[9px]">TOTAL CREDIT</span>
        <span>${totalCredit.toFixed(2)}</span>
      </div>

      <div className="border-t border-gray-200 border-dashed pt-2 mt-2 space-y-1">
        <div className="flex justify-between text-[10px] font-bold text-gray-700">
          <span className="uppercase tracking-widest text-[9px]">PAYMENT METHOD</span>
          <span className="uppercase">{paymentMethod || 'PENDING'}</span>
        </div>
      </div>

      {paymentMethod === 'Split' && splits && splits.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 border-dashed space-y-1">
          <p className="text-[9px] font-black uppercase text-gray-600 tracking-widest mb-1">Split Payment Breakdown</p>
          {splits.map((split, idx) => (
            <div key={idx} className="flex justify-between text-[10px] font-bold text-gray-700 pb-0.5">
              <span className="uppercase">{split.method}</span>
              <span>${split.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="text-center mt-8 space-y-1">
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">THANK YOU FOR YOUR VISIT!</p>
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">PLEASE COME AGAIN</p>
      
      {paymentMethod === 'Cash' ? (
        <div className="mt-4 pt-2 border-t border-dashed border-gray-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-800">
            USTED AHORRÓ ${(totalCredit - totalCash).toFixed(2)} PAGANDO EN EFECTIVO
          </p>
        </div>
      ) : (
        <div className="mt-4 pt-2 border-t border-dashed border-gray-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-800">
            PAGUE EN EFECTIVO Y AHORRE ${(totalCredit - totalCash).toFixed(2)}
          </p>
        </div>
      )}
    </div>
  </div>
);

export const InvoicePreview: React.FC<PreviewProps> = ({
  cart,
  storeSettings,
  client,
  salesman,
  subtotal,
  taxAmount,
  taxesApplied,
  tipAmount = 0,
  totalCash,
  totalCredit,
  paymentMethod = 'Pending',
  creditTerm = 'Due on Receipt',
  dueDate = new Date().toLocaleDateString(),
  splits
}) => (
  <div className="w-full bg-white p-6 lg:p-8 text-gray-900 shadow-inner border border-gray-100 rounded-sm print:p-0 print:shadow-none print:border-none font-sans text-sm">
    {/* Header Section */}
    <div className="flex justify-between items-start mb-6">
      <div className="flex gap-4">
        {storeSettings.logoUrl ? (
          <img src={storeSettings.logoUrl} alt="Company Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-2xl font-black text-gray-800">
            {(storeSettings.nombre || 'A').charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-black text-gray-900 mb-0.5 uppercase tracking-tighter">{storeSettings.nombre || 'A & A DIST.'}</h1>
          <div className="text-xs text-gray-700 space-y-0.5 font-medium leading-tight">
            <p>{storeSettings.direccion || '123 Health Ave, Medical District'}</p>
            <p>{storeSettings.telefono || '(800) 555-0199'} • {storeSettings.email || 'contacto@ejemplo.com'}</p>
          </div>
        </div>
      </div>
      <div className="text-right">
        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-2">INVOICE</h2>
        <div className="space-y-0.5 text-xs font-bold leading-tight">
          <p className="text-gray-700">Invoice #: <span className="font-black text-gray-900">INV-{Math.floor(Math.random() * 1000000)}</span></p>
          <p className="text-gray-700">Date: <span className="font-black text-gray-900">{new Date().toLocaleDateString()}</span></p>
          <p className="text-gray-700">Status: <span className="font-black text-gray-900">{paymentMethod === 'Pending' ? 'Pending' : 'Pagado'}</span></p>
        </div>
      </div>
    </div>

    {/* Billed To / Sales Rep Section */}
    <div className="grid grid-cols-2 gap-8 mb-6">
      <div>
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">BILLED TO</h3>
        <div className="space-y-0.5 leading-tight">
          <p className="text-sm font-black text-gray-900 uppercase">{client?.nombre || 'General Client'}</p>
          <div className="text-xs text-gray-700 font-medium">
            <p>{client?.direccion || ''}</p>
            <p>{client?.telefono || ''}</p>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">SALES REPRESENTATIVE</h3>
        <div className="space-y-0.5 leading-tight">
          <p className="text-sm font-black text-gray-900 uppercase">{salesman?.nombre || 'Salesman'}</p>
          <div className="text-xs text-gray-700 font-medium">
            <p>{salesman?.email || ''}</p>
            <p>{salesman?.telefono || ''}</p>
          </div>
        </div>
      </div>
    </div>

    {/* Items Table */}
    <table className="w-full mb-6 text-sm">
      <thead>
        <tr className="border-b-2 border-gray-200 text-left">
          <th className="py-1.5 text-xs font-black text-gray-900 uppercase">Item</th>
          <th className="py-1.5 text-xs font-black text-gray-900 uppercase text-center">Qty</th>
          <th className="py-1.5 text-xs font-black text-gray-900 uppercase text-center">Price</th>
          <th className="py-1.5 text-xs font-black text-gray-900 uppercase text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {cart.map((item, idx) => {
          const itemQuantity = item.cantidad || 0;
          const itemPrice = item.precio || 0;
          const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
          const unitPrice = itemPrice + modifierTotal;
          const itemTotal = unitPrice * itemQuantity;
          return (
            <tr key={idx}>
              <td className="py-2">
                <p className="font-black text-gray-900 text-sm uppercase leading-tight">{item.nombre}</p>
                <p className="text-[10px] text-gray-500 font-bold leading-tight">UPC: {item.sku || '7410003710555'}</p>
                {item.promo && item.promo.type === 'combo' && item.promo.items && item.promo.items.map((promoItem, pIdx) => (
                  <p key={`p-${pIdx}`} className="text-[10px] text-gray-700 font-bold italic ml-2 leading-tight">
                    • {promoItem.cantidad}x {promoItem.nombre}
                  </p>
                ))}
                {(item.selectedModifiers || []).map((mod, midx) => (
                  <p key={midx} className="text-[10px] text-blue-600 font-bold italic ml-2 leading-tight">
                    + {mod.modifierName} {mod.precio > 0 ? `($${mod.precio.toFixed(2)})` : ''}
                  </p>
                ))}
              </td>
              <td className="py-2 text-center font-black text-gray-900">{item.cantidad}</td>
              <td className="py-2 text-center font-bold text-gray-700">${unitPrice.toFixed(2)}</td>
              <td className="py-2 text-right font-black text-gray-900">${itemTotal.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>

    {/* Payment Details & Totals */}
    <div className="grid grid-cols-2 gap-8 mb-6">
      <div className="space-y-2">
        <h3 className="text-xs font-black text-gray-900 uppercase">Payment Details</h3>
        <div className="space-y-1 text-xs font-bold text-gray-700 leading-tight">
          <p>Method: <span className="text-gray-900">{paymentMethod || 'Pending'}</span></p>
          <p>Terms: <span className="text-gray-900">{creditTerm || 'CASH/TODAY'}</span></p>
          {paymentMethod === 'Check' && (
            <p>Amount in Words: <span className="text-gray-900 italic">{numberToWords(totalCash)}</span></p>
          )}
          {paymentMethod === 'Split' && splits && splits.length > 0 && (
            <div className="mt-2 space-y-1 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-500 uppercase">Breakdown:</p>
              {splits.map((split, idx) => (
                <div key={idx} className="flex justify-between text-gray-900">
                  <span>{split.method}</span>
                  <span>${split.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-bold text-gray-700">
          <span>Subtotal</span>
          <span className="text-gray-900">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs font-bold text-gray-700">
          <span>Discount</span>
          <span className="text-gray-900">-$0.00</span>
        </div>
        {taxesApplied && taxesApplied.length > 0 ? (
          taxesApplied.map((tax, idx) => (
            <div key={idx} className="flex justify-between text-xs font-bold text-gray-700">
              <span>{tax.name} ({tax.rate}%)</span>
              <span className="text-gray-900">${tax.amount.toFixed(2)}</span>
            </div>
          ))
        ) : taxAmount > 0 ? (
          <div className="flex justify-between text-xs font-bold text-gray-700">
            <span>Tax</span>
            <span className="text-gray-900">${taxAmount.toFixed(2)}</span>
          </div>
        ) : null}
        {tipAmount > 0 && (
          <div className="flex justify-between text-xs font-bold text-gray-700">
            <span>Tip</span>
            <span className="text-gray-900">${tipAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-gray-200 mt-1">
          <span>Total</span>
          <span>${totalCash.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div className="text-center mb-6">
      <p className="text-xs font-bold text-gray-800">Thank you for your business!</p>
      {paymentMethod === 'Cash' ? (
        <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-200">
          <p className="text-sm font-black uppercase tracking-widest text-green-700">
            USTED AHORRÓ ${(totalCredit - totalCash).toFixed(2)} PAGANDO EN EFECTIVO
          </p>
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-200">
          <p className="text-sm font-black uppercase tracking-widest text-gray-800">
            PAGUE EN EFECTIVO Y AHORRE ${(totalCredit - totalCash).toFixed(2)}
          </p>
        </div>
      )}
    </div>

    {/* Check/Voucher Section */}
    {paymentMethod === 'Check' && (
      <div className="border-2 border-gray-900 p-6 rounded-lg relative">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-sm font-black text-gray-900 uppercase leading-tight">{client?.nombre || 'General Client'}</p>
            <p className="text-[10px] font-bold text-gray-600 leading-tight">{client?.direccion || ''}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-gray-900 tracking-widest leading-tight">0000</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-bold">Date:</span>
              <span className="border-b border-gray-900 px-6 text-sm font-black">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-3 mb-4">
          <span className="text-[10px] font-bold whitespace-nowrap">Pay to the order of:</span>
          <div className="flex-1 border-b border-gray-900 pb-0.5 px-3 text-sm font-black italic">
            {storeSettings.nombre || 'A & A DIST.'}
          </div>
          <div className="border-2 border-gray-900 p-1.5 flex items-center gap-2 min-w-[100px]">
            <span className="text-base font-black">$</span>
            <span className="text-lg font-black flex-1 text-right">{totalCash.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-end gap-3 mb-6">
          <div className="flex-1 border-b border-gray-900 pb-0.5 px-3 text-sm font-black italic">
            {numberToWords(totalCash)}
          </div>
          <span className="text-[10px] font-bold">Dollars</span>
        </div>

        <div className="flex justify-between items-end">
          <div className="flex items-end gap-2 flex-1 max-w-xs">
            <span className="text-[10px] font-bold">Memo:</span>
            <div className="flex-1 border-b border-gray-900 pb-0.5 px-3 text-[10px] font-bold">
              Invoice Payment
            </div>
          </div>
          <div className="flex items-end gap-2 flex-1 max-w-xs">
            <span className="text-[10px] font-bold">Signature:</span>
            <div className="flex-1 border-b border-gray-900"></div>
          </div>
        </div>
      </div>
    )}
  </div>
);
