import React, { useState } from 'react';
import { CartItem, Category } from '../types';
import { X, DollarSign, Hash } from 'lucide-react';

interface EditCartItemModalProps {
  item: CartItem;
  categories: Category[];
  onClose: () => void;
  onSave: (updatedItem: CartItem) => void;
}

export const EditCartItemModal: React.FC<EditCartItemModalProps> = ({ item, categories, onClose, onSave }) => {
  const [nombre, setNombre] = useState(item.nombre);
  const [categoria, setCategoria] = useState(item.categoria || '');
  const [precio, setPrecio] = useState(item.precio.toString());
  const [cantidad, setCantidad] = useState(item.cantidad.toString());
  
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountFixed, setDiscountFixed] = useState('');

  const handleApplyDiscount = (type: 'percent' | 'fixed') => {
    let currentPrice = parseFloat(precio) || item.precio;
    if (type === 'percent') {
      const pct = parseFloat(discountPercent);
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
         currentPrice = currentPrice - (currentPrice * (pct / 100));
         setPrecio(currentPrice.toFixed(2));
         setDiscountPercent('');
      }
    } else if (type === 'fixed') {
      const amt = parseFloat(discountFixed);
      if (!isNaN(amt) && amt > 0) {
         currentPrice = currentPrice - amt;
         if (currentPrice < 0) currentPrice = 0;
         setPrecio(currentPrice.toFixed(2));
         setDiscountFixed('');
      }
    }
  };

  const handleSave = () => {
    onSave({
      ...item,
      nombre,
      categoria,
      precio: parseFloat(precio) || 0,
      cantidad: parseFloat(cantidad) || 1,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-gray-800">Edit Line Item</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Name & Category */}
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
                <input 
                  type="text" 
                  value={nombre} 
                  onChange={e => setNombre(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
             <div className="col-span-2">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Categoría</label>
                <select 
                  value={categoria} 
                  onChange={e => setCategoria(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">No Category</option>
                  {categories.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
             </div>
          </div>

          {/* Pricing & Qty */}
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Precio Unitario ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={precio} 
                    onChange={e => setPrecio(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
             </div>
             <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Cantidad</label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    value={cantidad} 
                    onChange={e => setCantidad(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
             </div>
          </div>

          {/* Discounts */}
          <div className="border-t border-gray-100 pt-4 mt-2">
             <h3 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-wider">Aplicar Descuento al Precio</h3>
             <div className="grid grid-cols-2 gap-4">
               {/* Fixed Amount Discount */}
               <div>
                  <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1">Monto Fijo ($)</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Ej: 2.00"
                      min="0"
                      value={discountFixed}
                      onChange={e => setDiscountFixed(e.target.value)}
                      className="w-full px-2 py-1.5 border border-emerald-200 bg-emerald-50 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button 
                      onClick={() => handleApplyDiscount('fixed')}
                      className="px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs whitespace-nowrap transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
               </div>

               {/* % Discount */}
               <div>
                  <label className="block text-[10px] font-black text-blue-600 uppercase tracking-wider mb-1">Porcentaje (%)</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Ej: 10"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={e => setDiscountPercent(e.target.value)}
                      className="w-full px-2 py-1.5 border border-blue-200 bg-blue-50 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button 
                      onClick={() => handleApplyDiscount('percent')}
                      className="px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-xs whitespace-nowrap transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
               </div>
             </div>
          </div>

        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
           <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-200 transition-colors">
             Cancel
           </button>
           <button onClick={handleSave} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
             Save Changes
           </button>
        </div>
      </div>
    </div>
  );
};
