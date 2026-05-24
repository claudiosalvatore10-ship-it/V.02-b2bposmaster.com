import React, { useState, useMemo } from 'react';
import { X, Printer, Calculator, DollarSign, CreditCard, FileText, Sparkles } from 'lucide-react';
import { Order, StoreSettings } from '../types';

interface ZReportModalProps {
  orders: Order[];
  storeSettings: StoreSettings;
  onClose: () => void;
}

export const ZReportModal: React.FC<ZReportModalProps> = ({ orders, storeSettings, onClose }) => {
  const [bills, setBills] = useState({
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0,
    coins: 0,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysOrders = useMemo(() => {
    return orders.filter((o) => {
      const orderDate = new Date(o.fecha);
      return orderDate >= today && o.estado !== 'Cancelado';
    });
  }, [orders, today]);

  const stats = useMemo(() => {
    let totalSales = 0;
    let cashSales = 0;
    let creditSales = 0;
    let checkSales = 0;
    let ebtSales = 0;
    let otherSales = 0;

    todaysOrders.forEach((o) => {
      totalSales += o.total;
      if (o.splits && o.splits.length > 0) {
        o.splits.forEach(sp => {
          if (sp.method === 'Cash') cashSales += sp.amount;
          else if (sp.method === 'Credit') creditSales += sp.amount;
          else if (sp.method === 'Check') checkSales += sp.amount;
          else if (sp.method === 'EBT') ebtSales += sp.amount;
          else otherSales += sp.amount;
        });
      } else {
        if (o.metodoPago === 'Cash') cashSales += o.total;
        else if (o.metodoPago === 'Credit') creditSales += o.total;
        else if (o.metodoPago === 'Check') checkSales += o.total;
        else if (o.metodoPago === 'EBT') ebtSales += o.total;
        else if (o.metodoPago === 'EBT + Cash') {
          // Fallback splits estimate
          const estEbt = o.articulos?.reduce((sum, item) => {
            if (item.categoria === 'Vegetables' || item.categoria === 'Fruit' || item.categoria === 'Beverages' || item.categoria === 'Dairy & Eggs') {
              return sum + (item.precio * item.cantidad);
            }
            return sum;
          }, 0) || 0;
          ebtSales += estEbt;
          cashSales += Math.max(0, o.total - estEbt);
        } else if (o.metodoPago === 'EBT + Credit') {
          const estEbt = o.articulos?.reduce((sum, item) => {
            if (item.categoria === 'Vegetables' || item.categoria === 'Fruit' || item.categoria === 'Beverages' || item.categoria === 'Dairy & Eggs') {
              return sum + (item.precio * item.cantidad);
            }
            return sum;
          }, 0) || 0;
          ebtSales += estEbt;
          creditSales += Math.max(0, o.total - estEbt);
        }
        else otherSales += o.total;
      }
    });

    return { totalSales, cashSales, creditSales, checkSales, ebtSales, otherSales, orderCount: todaysOrders.length };
  }, [todaysOrders]);

  const calculatedCash = useMemo(() => {
    return (
      bills[100] * 100 +
      bills[50] * 50 +
      bills[20] * 20 +
      bills[10] * 10 +
      bills[5] * 5 +
      bills[1] * 1 +
      bills.coins
    );
  }, [bills]);

  const cashDifference = calculatedCash - stats.cashSales;

  const handleBillChange = (denomination: number | 'coins', value: string) => {
    const numValue = denomination === 'coins' ? parseFloat(value) || 0 : parseInt(value, 10) || 0;
    setBills((prev) => ({ ...prev, [denomination]: numValue }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:max-h-none print:w-full">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0 print:hidden">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            Z-Report (End of Day)
          </h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Printer className="w-5 h-5 text-gray-600" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 print:p-0">
          {/* Print Header */}
          <div className="hidden print:block text-center mb-8">
            <h1 className="text-2xl font-black">{storeSettings.nombre}</h1>
            <p className="text-sm text-gray-600">Z-Report - {new Date().toLocaleDateString()}</p>
            <p className="text-sm text-gray-600">{new Date().toLocaleTimeString()}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Sales Summary */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-black text-gray-800 mb-4 uppercase tracking-widest border-b pb-2">Sales Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
                    <span className="font-bold text-blue-800">Gross Sales</span>
                    <span className="text-xl font-black text-blue-900">${stats.totalSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="font-bold text-gray-600">Total Orders</span>
                    <span className="font-black text-gray-900">{stats.orderCount}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-gray-800 mb-4 uppercase tracking-widest border-b pb-2">By Payment Method</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                    <div className="flex items-center gap-2 text-green-700">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-bold">Cash</span>
                    </div>
                    <span className="font-black text-green-800">${stats.cashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-2 text-purple-700">
                      <CreditCard className="w-4 h-4" />
                      <span className="font-bold">Credit Card</span>
                    </div>
                    <span className="font-black text-purple-800">${stats.creditSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-2 text-amber-700">
                      <FileText className="w-4 h-4" />
                      <span className="font-bold">Check</span>
                    </div>
                    <span className="font-black text-amber-800">${stats.checkSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold">EBT SNAP</span>
                    </div>
                    <span className="font-black text-emerald-800">${stats.ebtSales.toFixed(2)}</span>
                  </div>
                  {stats.otherSales > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="font-bold text-gray-600">Other</span>
                      <span className="font-black text-gray-800">${stats.otherSales.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Cash Calculator */}
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 print:border-none print:bg-transparent print:p-0">
              <h3 className="text-lg font-black text-gray-800 mb-4 uppercase tracking-widest border-b pb-2">Cash Calculator</h3>
              
              <div className="space-y-2 mb-6">
                {[100, 50, 20, 10, 5, 1].map((denom) => (
                  <div key={denom} className="flex items-center gap-4">
                    <div className="w-16 font-bold text-gray-600 text-right">${denom}</div>
                    <div className="text-gray-400">x</div>
                    <input
                      type="number"
                      min="0"
                      value={bills[denom as keyof typeof bills] || ''}
                      onChange={(e) => handleBillChange(denom, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none print:border-none print:bg-transparent print:text-left"
                      placeholder="0"
                    />
                    <div className="w-24 font-black text-gray-800 text-right">
                      ${(bills[denom as keyof typeof bills] * denom).toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-2 border-t border-gray-200">
                  <div className="w-16 font-bold text-gray-600 text-right">Coins</div>
                  <div className="text-gray-400">=</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bills.coins || ''}
                    onChange={(e) => handleBillChange('coins', e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none print:border-none print:bg-transparent print:text-left"
                    placeholder="0.00"
                  />
                  <div className="w-24 font-black text-gray-800 text-right">
                    ${bills.coins.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-600">Calculated Cash</span>
                  <span className="text-xl font-black text-gray-900">${calculatedCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-600">System Cash Sales</span>
                  <span className="text-xl font-black text-gray-900">${stats.cashSales.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between items-center pt-3 border-t border-gray-100 ${cashDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span className="font-black uppercase tracking-widest">Difference</span>
                  <span className="text-2xl font-black">
                    {cashDifference > 0 ? '+' : ''}{cashDifference.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
