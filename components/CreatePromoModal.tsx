import React, { useState } from 'react';
import { PromoConfig, Product } from '../types';
import { X, Plus, Trash2, Tag, Percent, XOctagon } from 'lucide-react';

interface Props {
  products: Product[];
  onClose: () => void;
  onSave: (promoProduct: Partial<Product> | { id: string; clearPromo: boolean }) => void;
}

export const CreatePromoModal: React.FC<Props> = ({ products, onClose, onSave }) => {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'quantity' | 'combo' | 'discount' | 'clear'>('combo');
  const [precioTotal, setPrecioTotal] = useState<number>(0);
  
  // For Combo
  const [comboItems, setComboItems] = useState<{ productId: string; nombre: string; cantidad: number }[]>([]);
  const [selectedComboProductId, setSelectedComboProductId] = useState('');
  const [selectedComboQty, setSelectedComboQty] = useState(1);

  // For Quantity, Discount, Clear
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<number>(2);
  const [discountPercent, setDiscountPercent] = useState<number>(10);

  const handleAddComboItem = () => {
    if (!selectedComboProductId) return;
    const p = products.find(p => p.id === selectedComboProductId);
    if (!p) return;
    setComboItems([...comboItems, { productId: p.id, nombre: p.nombre, cantidad: selectedComboQty }]);
    setSelectedComboProductId('');
    setSelectedComboQty(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tipo === 'combo') {
      if (comboItems.length === 0) return;
      onSave({
        nombre,
        precio: precioTotal,
        costo: 0,
        categoria: 'PROMOS',
        stock: 999,
        min_stock: 0,
        showInPOS: true,
        promo: {
          type: 'combo',
          price: precioTotal,
          items: comboItems
        }
      });
    } else if (tipo === 'clear') {
      if (!selectedProductId) return;
      onSave({
        id: selectedProductId,
        clearPromo: true
      });
    } else if (tipo === 'discount') {
      if (!selectedProductId) return;
      const originalProduct = products.find(p => p.id === selectedProductId);
      if (!originalProduct) return;
      
      onSave({
        ...originalProduct,
        descuento: discountPercent,
        promo: {
          type: 'discount',
          discountPercent
        }
      });
    } else {
      if (!selectedProductId) return;
      const originalProduct = products.find(p => p.id === selectedProductId);
      if (!originalProduct) return;
      
      onSave({
        ...originalProduct,
        promo: {
          type: 'quantity',
          quantity: quantity,
          price: precioTotal
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4 text-left">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center gap-4 bg-gray-50">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Tag className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase">Gestión de Promociones</h2>
            <p className="text-sm font-bold text-gray-500">Crea o elimina promociones en tu catálogo</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {tipo !== 'clear' && tipo !== 'discount' && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nombre de la promo</label>
              <input required type="text" placeholder={tipo === 'combo' ? 'COMBO FAMILIAR' : 'PROMO LLEVA X'} value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-5 py-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-2xl text-gray-800 outline-none focus:border-blue-500 transition-all shadow-sm" />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Acción / Tipo de Promoción</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => setTipo('combo')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-2 ${tipo === 'combo' ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-200'}`}
              >
                <Tag className={`w-6 h-6 ${tipo === 'combo' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <span className={`block font-black text-sm ${tipo === 'combo' ? 'text-blue-700' : 'text-gray-700'}`}>Combo Fijo</span>
                  <span className="text-[10px] text-gray-500 font-bold leading-tight mt-1 hidden sm:block">Varios productos juntos a un precio.</span>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setTipo('quantity')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-2 ${tipo === 'quantity' ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-200'}`}
              >
                <Plus className={`w-6 h-6 ${tipo === 'quantity' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <span className={`block font-black text-sm ${tipo === 'quantity' ? 'text-blue-700' : 'text-gray-700'}`}>Por Cantidad</span>
                  <span className="text-[10px] text-gray-500 font-bold leading-tight mt-1 hidden sm:block">Lleva N unidades por precio especial.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipo('discount')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-2 ${tipo === 'discount' ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-200'}`}
              >
                <Percent className={`w-6 h-6 ${tipo === 'discount' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <span className={`block font-black text-sm ${tipo === 'discount' ? 'text-blue-700' : 'text-gray-700'}`}>% Descuento</span>
                  <span className="text-[10px] text-gray-500 font-bold leading-tight mt-1 hidden sm:block">Aplica un % directo a un producto.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipo('clear')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-2 ${tipo === 'clear' ? 'border-red-600 bg-red-50 shadow-md' : 'border-gray-200 bg-white hover:border-red-200'}`}
              >
                <XOctagon className={`w-6 h-6 ${tipo === 'clear' ? 'text-red-600' : 'text-gray-400'}`} />
                <div>
                  <span className={`block font-black text-sm ${tipo === 'clear' ? 'text-red-700' : 'text-gray-700'}`}>Terminar Promo</span>
                  <span className="text-[10px] text-gray-500 font-bold leading-tight mt-1 hidden sm:block">Eliminar promo/descuento de un ítem.</span>
                </div>
              </button>
            </div>
          </div>

          {tipo === 'combo' ? (
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-100 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <select value={selectedComboProductId} onChange={e => setSelectedComboProductId(e.target.value)} className="w-full px-5 py-3 bg-white border-2 border-gray-100 rounded-xl font-bold text-gray-700 outline-none focus:border-blue-500 transition-all cursor-pointer">
                    <option value="">Seleccionar Producto...</option>
                    {products.filter(p => !p.promo || p.promo.type !== 'combo').map(p => <option key={p.id} value={p.id}>{p.nombre} (${p.precio})</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <input type="number" min="1" value={selectedComboQty} onChange={e => setSelectedComboQty(Number(e.target.value))} className="w-full px-5 py-3 bg-white border-2 border-gray-100 rounded-xl font-black text-center text-gray-800 outline-none focus:border-blue-500 transition-all" />
                </div>
                <button type="button" onClick={handleAddComboItem} className="w-14 h-[52px] bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-2 mt-4">
                {comboItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-gray-100 shadow-sm">
                    <span className="font-bold text-gray-700">{item.cantidad}x {item.nombre}</span>
                    <button type="button" onClick={() => setComboItems(comboItems.filter((_, i) => i !== idx))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Producto Objetivo</label>
                <select required value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full px-5 py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:border-blue-500 transition-all cursor-pointer">
                  <option value="">Seleccionar Producto...</option>
                  {products.filter(p => !p.promo || p.promo.type !== 'combo').map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              
              {tipo === 'quantity' && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cantidad Requerida</label>
                  <input required type="number" min="2" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full px-5 py-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-2xl text-gray-800 outline-none focus:border-blue-500 transition-all" />
                </div>
              )}

              {tipo === 'discount' && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Descuento (%)</label>
                  <div className="relative">
                    <input required type="number" min="1" max="100" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} className="w-full pl-5 pr-12 py-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-2xl text-gray-800 outline-none focus:border-blue-500 transition-all" />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-xl text-gray-400">%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-6 pt-4 border-t border-gray-100">
            {(tipo === 'combo' || tipo === 'quantity') && (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">PRECIO TOTAL DE LA PROMO</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span>
                  <input required type="number" step="0.01" value={precioTotal || ''} onChange={e => setPrecioTotal(Number(e.target.value))} className="w-48 pl-10 pr-5 py-3 bg-white border-2 border-gray-200 rounded-xl font-black text-2xl text-gray-800 outline-none focus:border-green-500 transition-all font-mono" />
                </div>
              </div>
            )}
            
            <button type="submit" className={`flex-1 py-4 text-white rounded-xl font-black uppercase tracking-widest transition shadow-lg ${tipo === 'clear' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-green-500 hover:bg-green-600 shadow-green-200'}`}>
              {tipo === 'clear' ? 'Terminar Promoción' : 'Guardar Promoción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
