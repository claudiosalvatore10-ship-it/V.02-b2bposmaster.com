import React, { useState } from 'react';
import { toast } from 'sonner';
import { Product, StoreSettings, Vendor, Inventory } from '../types';
import { Archive, X, Search, Tag, Building2, Package, ShoppingCart } from 'lucide-react';
import { QuantityControl } from './QuantityControl';
import InvoiceDisplay from './InvoiceDisplay';

interface ReceiveInventoryModalProps {
  vendors: Vendor[];
  products: Product[];
  onClose: () => void;
  onSave: (inventory: Inventory) => void;
  storeSettings: StoreSettings;
  initialItems?: any[];
}

const ReceiveInventoryModal: React.FC<ReceiveInventoryModalProps> = ({ vendors, products, onClose, onSave, storeSettings, initialItems = [] }) => {
  const [isSimpleMode, setIsSimpleMode] = useState(storeSettings?.businessCategory === 'restaurant');
  const [simpleAmount, setSimpleAmount] = useState<number>(0);
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [items, setItems] = useState<any[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  
  // Payment State
  const [metodoPago, setMetodoPago] = useState<'Cash' | 'Credit' | 'Check' | ''>('Check');
  const [terminosCredito, setTerminosCredito] = useState('CASH/TODAY');
  const [amountTendered, setAmountTendered] = useState<number>(0);
  const [checkNumber, setCheckNumber] = useState('');
  const [montoLetras, setMontoLetras] = useState('');
  const [bills, setBills] = useState({
    b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0
  });

  const total = isSimpleMode ? simpleAmount : items.reduce((acc, item) => acc + (item.cantidad * item.costo), 0);
  const changeDue = Math.max(0, amountTendered - total);

  const handleBillChange = (bill: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const newBills = { ...bills, [bill]: numValue };
    setBills(newBills);
    
    // Update amount tendered based on bills
    const newTotal = (newBills.b100 * 100) + (newBills.b50 * 50) + (newBills.b20 * 20) + 
                     (newBills.b10 * 10) + (newBills.b5 * 5) + (newBills.b1 * 1);
    setAmountTendered(newTotal);
  };

  const filteredProducts = products.filter((p: any) => 
    (p.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.componenteActivo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.upc?.includes(searchQuery) ||
    p.boxBarcode?.includes(searchQuery)
  );

  const handleUpdateQuantity = (product: any, qty: number) => {
    if (qty <= 0) {
      setItems(items.filter(i => i.productId !== product.id));
    } else {
      const existingItem = items.find(i => i.productId === product.id);
      if (existingItem) {
        setItems(items.map(i => i.productId === product.id ? { ...i, cantidad: qty } : i));
      } else {
        setItems([...items, { 
          productId: product.id, 
          nombre: product.nombre, 
          cantidad: qty, 
          costo: product.costo || 0, 
          unitsPerBox: product.unitsPerBox || 1
        }]);
      }
    }
  };

  const handleSave = () => {
    if (!isSimpleMode && items.length === 0) {
      toast.error("Please add items to receive");
      return;
    }
    if (isSimpleMode && !simpleAmount) {
      toast.error("Please enter the total amount");
      return;
    }
    if (metodoPago === 'Check' && !checkNumber) {
      toast.error("Please enter the check number");
      return;
    }
    
    const newInventory: Inventory = {
      id: `INV-${Date.now()}`,
      proveedor: vendors.find((v: any) => v.id === vendorId)?.nombre || 'Unknown',
      fecha: Date.now(),
      factura: invoiceNumber,
      articulos: items.length,
      total,
      estado: 'Completado',
      items: items,
      metodoPago,
      terminosCredito,
      amountTendered,
      changeDue,
      checkNumber,
      montoLetras,
      bills
    };
    onSave(newInventory);
  };

  const tempInvoice: Inventory = {
    id: 'PREVIEW',
    proveedor: vendors.find((v: any) => v.id === vendorId)?.nombre || 'Unknown',
    fecha: Date.now(),
    factura: invoiceNumber || 'PENDING',
    articulos: items.length,
    total,
    estado: 'Borrador',
    items: items,
    metodoPago,
    terminosCredito,
    amountTendered,
    changeDue,
    checkNumber,
    montoLetras,
    bills
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 print:hidden animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden border border-white/20 relative">
        {/* Top Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Archive className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Receive Inventory</h2>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Stock Management Module</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-all active:scale-90">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Controls Bar - POS Style */}
        <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex flex-wrap items-center gap-4 shrink-0 justify-between">
          {!isSimpleMode && (
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
            <input
              type="text"
              placeholder="Search by Name, Active Component, or UPC..."
              value={searchQuery}
              autoFocus
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-lg font-bold shadow-sm"
            />
          </div>
          )}

          <div className={`flex items-center gap-4 ${isSimpleMode ? 'w-full justify-between' : ''}`}>
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1">Supplier</label>
              <select 
                value={vendorId} 
                onChange={e => setVendorId(e.target.value)} 
                className="p-4 bg-white border border-gray-200 rounded-[1.5rem] font-black text-gray-800 focus:ring-4 focus:ring-blue-100 outline-none shadow-sm min-w-[200px]"
              >
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1">Invoice #</label>
              <input 
                type="text" 
                value={invoiceNumber} 
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="Factura #"
                className="p-4 bg-white border border-gray-200 rounded-[1.5rem] font-black text-gray-800 focus:ring-4 focus:ring-blue-100 outline-none shadow-sm w-40"
              />
            </div>
            
            {!isSimpleMode && (
              <>
                <div className="flex flex-col">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1">Payment Method</label>
                  <select 
                    value={metodoPago} 
                    onChange={e => setMetodoPago(e.target.value as any)} 
                    className="p-4 bg-white border border-gray-200 rounded-[1.5rem] font-black text-gray-800 focus:ring-4 focus:ring-blue-100 outline-none shadow-sm min-w-[140px]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Check">Check</option>
                    <option value="Credit">Credit / Transfer</option>
                  </select>
                </div>

                {(metodoPago === 'Check' || metodoPago === 'Credit') && (
                  <div className="flex flex-col">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1">Ref / Check #</label>
                    <input 
                      type="text" 
                      value={checkNumber} 
                      onChange={e => setCheckNumber(e.target.value)}
                      placeholder="e.g. 1045"
                      className="p-4 bg-white border border-gray-200 rounded-[1.5rem] font-black text-gray-800 focus:ring-4 focus:ring-blue-100 outline-none shadow-sm w-40"
                    />
                  </div>
                )}
              </>
            )}

            <button 
              onClick={handleSave}
              className="px-8 py-4 bg-green-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-100 active:scale-95 flex items-center gap-2 mt-5"
            >
              Complete Receipt
            </button>
            
            <button 
              onClick={onClose}
              className="px-8 py-4 bg-red-500 text-white rounded-[1.5rem] font-black text-lg hover:bg-red-600 transition-all shadow-lg shadow-red-100 active:scale-95 flex items-center gap-2 mt-5"
            >
              Cancel
            </button>
          </div>
        </div>
        
        {/* Product List - POS Style */}
        {isSimpleMode ? (
          <div className="flex-1 p-6 bg-gray-50 flex items-center justify-center">
            <div className="bg-white rounded-[2rem] shadow-xl p-8 max-w-2xl w-full border border-gray-100 flex flex-col gap-6">
              <div className="text-center mb-4">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Register Purchase / Expense</h3>
                <p className="text-gray-500 font-medium mt-1">Select the vendor, enter the total amount and payment details.</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2 block">Total Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-black text-gray-400">$</span>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={simpleAmount || ''}
                      onChange={e => setSimpleAmount(parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className="w-full pl-12 pr-4 py-6 bg-gray-50 border-2 border-gray-200 rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-5xl font-black text-gray-900 shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2 block">Payment Method</label>
                    <select 
                      value={metodoPago} 
                      onChange={e => setMetodoPago(e.target.value as any)} 
                      className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-[1.5rem] font-black text-gray-800 focus:ring-4 focus:ring-blue-100 outline-none shadow-sm"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Check">Check</option>
                      <option value="Credit">Credit / Transfer</option>
                    </select>
                  </div>
                  {(metodoPago === 'Check' || metodoPago === 'Credit') && (
                    <div>
                      <label className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2 block">Reference / Check #</label>
                      <input 
                        type="text" 
                        value={checkNumber} 
                        onChange={e => setCheckNumber(e.target.value)}
                        placeholder="e.g. 1045"
                        className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-[1.5rem] font-black text-gray-800 focus:ring-4 focus:ring-blue-100 outline-none shadow-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 pb-32">
            <div className="max-w-6xl mx-auto space-y-4">
              {filteredProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 space-y-4">
                <Search className="w-16 h-16 opacity-10" />
                <p className="text-xl font-bold">No products found matching "{searchQuery}"</p>
              </div>
            ) : (
              filteredProducts.map((product: any) => {
                const item = items.find(i => i.productId === product.id);
                const quantity = item ? item.cantidad : 0;
                
                return (
                  <div 
                    key={product.id} 
                    className={`bg-white rounded-[2rem] p-5 border transition-all flex items-center gap-6 group ${quantity > 0 ? 'border-blue-500 ring-4 ring-blue-50 shadow-xl' : 'border-gray-100 hover:border-blue-200 hover:shadow-lg'}`}
                  >
                    {/* Image */}
                    <div className="w-28 h-28 bg-gray-50 rounded-[1.5rem] p-3 border border-gray-100 flex-shrink-0">
                      <img 
                        src={product.imagenUrl} 
                        alt={product.nombre} 
                        className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform" 
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-1">{product.nombre}</h3>
                      <p className="text-blue-600 font-bold mb-3">{product.componenteActivo}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-black text-gray-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> UPC: {product.upc}</span>
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {product.laboratorio}</span>
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {product.unidad}</span>
                      </div>
                    </div>

                    {/* Stock Display */}
                    <div className="hidden md:flex flex-col items-center justify-center px-10 border-l border-gray-50">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Stock</span>
                      <span className={`text-3xl font-black ${product.stock < (product.threshold || 0) ? 'text-red-500' : 'text-green-600'}`}>
                        {product.stock}
                      </span>
                    </div>

                    {/* Quantity Control */}
                    <div className="flex items-center justify-center px-6 border-l border-gray-50">
                      <QuantityControl 
                        quantity={quantity} 
                        onChange={(q) => handleUpdateQuantity(product, q)} 
                      />
                    </div>

                    {/* Cost */}
                    <div className="min-w-[140px] text-right border-l border-gray-50 pl-8">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Unit Cost</span>
                      {quantity > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xl font-black text-gray-400">$</span>
                          <input 
                            type="number" 
                            step="0.01"
                            value={item?.costo || 0}
                            onChange={(e) => {
                              const newCost = parseFloat(e.target.value) || 0;
                              setItems(items.map(i => i.productId === product.id ? { ...i, costo: newCost } : i));
                            }}
                            onFocus={e => e.target.select()}
                            className="text-3xl font-black text-gray-900 tracking-tighter w-24 text-right bg-gray-50 rounded-lg px-2 border border-transparent focus:border-blue-500 outline-none"
                          />
                        </div>
                      ) : (
                        <p className="text-3xl font-black text-gray-300 tracking-tighter">
                          ${Number(product.costo || 0).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        )}

        {/* Floating Summary Box - POS Style */}
        {!isSimpleMode && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-10">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-4 flex items-center justify-between gap-6 animate-in slide-in-from-bottom-8 duration-500">
            <div className="flex flex-col pl-4">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{items.length} ITEMS</span>
              <span className="text-4xl font-black text-blue-600 tracking-tighter">
                ${Number(total || 0).toFixed(2)}
              </span>
            </div>
            <button 
              onClick={() => setShowInvoicePreview(true)}
              className="flex-1 bg-blue-600 text-white rounded-[1.5rem] py-4 px-6 font-black text-xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200"
            >
              <ShoppingCart className="w-6 h-6" />
              View Invoice
            </button>
          </div>
        </div>
        )}

        {/* Invoice Preview Modal */}
        {showInvoicePreview && (
          <InvoiceDisplay 
            invoice={tempInvoice} 
            onClose={() => setShowInvoicePreview(false)} 
            storeSettings={storeSettings}
            onUpdatePayment={(updates) => {
              if (updates.metodoPago !== undefined) setMetodoPago(updates.metodoPago);
              if (updates.terminosCredito !== undefined) setTerminosCredito(updates.terminosCredito);
              if (updates.amountTendered !== undefined) setAmountTendered(updates.amountTendered);
              if (updates.checkNumber !== undefined) setCheckNumber(updates.checkNumber);
              if (updates.montoLetras !== undefined) setMontoLetras(updates.montoLetras);
              if (updates.bills !== undefined) setBills(updates.bills as any);
            }}
            onComplete={handleSave}
          />
        )}
      </div>
    </div>
  );
};

export default ReceiveInventoryModal;
