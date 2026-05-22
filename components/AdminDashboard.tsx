import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { GoogleGenAI } from "@google/genai";
import InvoiceDisplay from './InvoiceDisplay';
import { TicketPreview, InvoicePreview } from './PrintPreviews';
import ReceiveInventoryModal from './ReceiveInventoryModal';
import { CreateClientModal } from './CreateClientModal';
import { CreatePromoModal } from './CreatePromoModal';
import { Product, Client, Salesman, Order, Inventory, Category, Tax, Device, StoreSettings, Vendor, PurchaseOrder, BusinessCategory, Modifier, ModifierGroup, GlobalModifierGroup } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_SALESMEN, INITIAL_CATEGORIES, INITIAL_TAXES, INITIAL_DEVICES, INITIAL_VENDORS, DEFAULT_BUSINESS_CATEGORIES } from '../constants';
import { LayoutDashboard, Package, Users, Briefcase, Tags, Settings, ShoppingCart, Archive, ArrowLeft, Plus, Download, Upload, Printer as PrinterIcon, Trophy, TrendingUp, Menu, X, Truck, FileText, Search, Mail, Trash2, CheckCircle, Building2, Tag, RefreshCw, Sparkles, ShieldCheck, ListFilter, Copy, CreditCard, LayoutGrid, Hand, Grid, ChefHat } from 'lucide-react';
import { doc, deleteDoc, setDoc, writeBatch, collection, getDocs, updateDoc, query, where, addDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import Papa from 'papaparse';
import { read, utils, writeFile } from 'xlsx';
import { QuantityControl } from './QuantityControl';

interface AdminDashboardProps {
  onBack: () => void;
  storeSettings: StoreSettings;
  setStoreSettings: (settings: StoreSettings) => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  salesmen: Salesman[];
  setSalesmen: React.Dispatch<React.SetStateAction<Salesman[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  inventory: Inventory[];
  setInventory: React.Dispatch<React.SetStateAction<Inventory[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  taxes: Tax[];
  setTaxes: React.Dispatch<React.SetStateAction<Tax[]>>;
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  vendors: Vendor[];
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
  purchaseOrders: PurchaseOrder[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  isSuperAdmin?: boolean;
  onBackToSuperAdmin?: () => void;
}

type Tab = 'Dashboard' | 'POS / Sales' | 'Products' | 'Clients' | 'Salesmen' | 'Categories' | 'Settings' | 'Orders' | 'Inventory' | 'Suppliers' | 'Purchase Orders' | 'Reports' | 'Devices' | 'Modifiers Library';

const EditableCell = ({ value, onChange, type = "text", className = "", step }: any) => {
  const [localValue, setLocalValue] = React.useState(() => {
    if (type === 'number' && step === '0.01') {
      return Number(value || 0).toFixed(2);
    }
    return value?.toString() ?? '';
  });

  React.useEffect(() => {
    if (type === 'number' && step === '0.01') {
      setLocalValue(Number(value || 0).toFixed(2));
    } else {
      setLocalValue(value?.toString() ?? '');
    }
  }, [value, type, step]);

  const handleBlur = () => {
    if (type === 'number') {
      const parsed = parseFloat(localValue) || 0;
      onChange(parsed);
      if (step === '0.01') {
        setLocalValue(parsed.toFixed(2));
      } else {
        setLocalValue(parsed.toString());
      }
    } else {
      onChange(localValue ?? '');
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <input
      type={type === 'number' && step === '0.01' ? 'text' : type}
      inputMode={type === 'number' ? (step === '0.01' ? 'decimal' : 'numeric') : undefined}
      value={localValue}
      step={step || (type === 'number' ? '0.01' : undefined)}
      onFocus={handleFocus}
      onChange={e => {
        if (type === 'number' && step === '0.01') {
          const rawValue = e.target.value.replace(/[^0-9.]/g, '');
          setLocalValue(rawValue);
        } else if (type === 'number') {
          const val = e.target.value.replace(/[^0-9.]/g, '');
          setLocalValue(val);
        } else {
          setLocalValue(e.target.value);
        }
      }}
      onBlur={handleBlur}
      onClick={e => e.stopPropagation()}
      className={`w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1 py-1 ${className}`}
    />
  );
};

const EditableCheckbox = ({ checked, onChange }: any) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={e => onChange(e.target.checked)}
    onClick={e => e.stopPropagation()}
    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
  />
);

const CreatePOModal = ({ vendors, products, onClose, onSave, isRestaurant }: any) => {
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [items, setItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentCheckNumber, setPaymentCheckNumber] = useState('');
  const [restaurantAmount, setRestaurantAmount] = useState<number>(0);
  
  const filteredProducts = products.filter((p: any) => 
    (p.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddItem = (product: any) => {
    const existingItem = items.find(i => i.productId === product.id);
    if (existingItem) {
      setItems(items.map(i => i.productId === product.id ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else {
      setItems([...items, { productId: product.id, nombre: product.nombre, cantidad: 1, costo: product.costo }]);
    }
  };

  const handleUpdateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setItems(items.filter(i => i.productId !== productId));
    } else {
      setItems(items.map(i => i.productId === productId ? { ...i, cantidad: qty } : i));
    }
  };

  const handleUpdateCost = (productId: string, cost: number) => {
    setItems(items.map(i => i.productId === productId ? { ...i, costo: cost } : i));
  };

  const handleSave = () => {
    let finalItems = items;
    let finalTotal = items.reduce((acc, item) => acc + (item.cantidad * item.costo), 0);
    
    if (isRestaurant) {
      finalItems = [{ productId: 'INSUMOS-REST', nombre: 'Insumos', cantidad: 1, costo: restaurantAmount }];
      finalTotal = restaurantAmount;
    }
    
    // Calculate expected date based on vendor terms
    const vendor = vendors.find((v: any) => v.id === vendorId);
    let expectedDate = Date.now();
    if (vendor && vendor.terminos) {
      const match = vendor.terminos.match(/(\d+)/);
      if (match) {
        const days = parseInt(match[1], 10);
        expectedDate += days * 24 * 60 * 60 * 1000;
      }
    }

    const newPO: PurchaseOrder = {
      id: `PO-${Date.now()}`,
      vendorId,
      fechaCreacion: Date.now(),
      fechaEsperada: expectedDate,
      estado: 'Borrador',
      articulos: finalItems,
      total: finalTotal,
      notas: '',
      invoiceNumber: isRestaurant ? invoiceNumber : undefined,
      checkNumber: isRestaurant ? paymentCheckNumber : undefined
    };
    onSave(newPO);
  };

  const total = isRestaurant ? restaurantAmount : items.reduce((acc, item) => acc + (item.cantidad * item.costo), 0);

  if (isRestaurant) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-auto flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
            <h2 className="text-2xl font-bold text-gray-800">Registrar Compra (Insumos)</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
          
          <div className="p-6 flex flex-col space-y-6 flex-1 overflow-y-auto">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Vendor</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="w-full p-4 border-2 border-gray-200 rounded-xl font-bold text-gray-800 focus:border-blue-500 transition focus:ring-0">
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Invoice Number</label>
              <input 
                type="text" 
                value={invoiceNumber} 
                onChange={e => setInvoiceNumber(e.target.value)} 
                className="w-full p-4 border-2 border-gray-200 rounded-xl font-bold text-gray-800 focus:border-blue-500 transition focus:ring-0" 
                placeholder="Ej. INV-001"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Monto Total de Insumos ($)</label>
              <input 
                type="number" 
                step="0.01" 
                min="0"
                value={restaurantAmount} 
                onChange={e => setRestaurantAmount(parseFloat(e.target.value) || 0)} 
                onFocus={e => e.target.select()}
                className="w-full p-4 border-2 border-gray-200 rounded-xl font-black text-2xl text-gray-800 focus:border-blue-500 transition focus:ring-0 text-right" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Número de Cheque (Pago)</label>
              <input 
                type="text" 
                value={paymentCheckNumber} 
                onChange={e => setPaymentCheckNumber(e.target.value)} 
                className="w-full p-4 border-2 border-gray-200 rounded-xl font-bold text-gray-800 focus:border-blue-500 transition focus:ring-0" 
                placeholder="Ej. CHK-2948"
              />
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-200 bg-gray-50 shrink-0">
            <div className="flex gap-4">
              <button onClick={onClose} className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition">
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={restaurantAmount <= 0}
                className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar Compra
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h2 className="text-2xl font-bold text-gray-800">Create Purchase Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Left Side: Product Search & List */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col bg-white">
            <div className="p-4 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search products by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 transition text-lg"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-3">
                {filteredProducts.map((product: any) => (
                  <div 
                    key={product.id} 
                    onClick={() => handleAddItem(product)}
                    className="flex justify-between items-center p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md cursor-pointer transition bg-white group"
                  >
                    <div>
                      <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition">{product.nombre}</h3>
                      <p className="text-sm text-gray-500 font-mono">{product.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">${Number(product.costo || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Stock: {Number.isInteger(product.stock) ? product.stock : Number(product.stock).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No products found matching "{searchQuery}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: PO Details */}
          <div className="w-1/2 flex flex-col bg-gray-50">
            <div className="p-4 border-b border-gray-200 shrink-0 bg-white">
              <label className="block text-sm font-bold text-gray-700 mb-2">Select Supplier</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-xl font-bold text-gray-800 focus:border-blue-500">
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <ShoppingCart className="w-16 h-16 opacity-20" />
                  <p className="text-lg font-medium">Select products from the left to add to PO</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-gray-800">{item.nombre}</h4>
                        <button onClick={() => handleUpdateQuantity(item.productId, 0)} className="text-red-500 hover:text-red-700 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 font-bold">Qty:</span>
                          <input 
                            type="number" 
                            min="0" 
                            step="0.01"
                            value={item.cantidad} 
                            onChange={e => {
                              handleUpdateQuantity(item.productId, parseFloat(e.target.value) || 0);
                            }} 
                            onFocus={e => e.target.select()}
                            className="w-20 p-2 border border-gray-300 rounded text-center font-bold"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 font-bold">Cost $:</span>
                          <input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            value={item.costo} 
                            onChange={e => handleUpdateCost(item.productId, parseFloat(e.target.value) || 0)} 
                            className="w-24 p-2 border border-gray-300 rounded text-right font-bold"
                          />
                        </div>
                        <div className="font-black text-lg text-gray-900 w-24 text-right">
                          ${Number((item.cantidad || 0) * (item.costo || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-white shrink-0">
              <div className="flex justify-between items-end mb-6">
                <span className="text-gray-500 font-bold uppercase tracking-wider">Total PO Value</span>
                <span className="text-4xl font-black text-gray-900">${Number(total || 0).toFixed(2)}</span>
              </div>
              <div className="flex gap-4">
                <button onClick={onClose} className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={items.length === 0} 
                  className="flex-1 py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition shadow-lg shadow-blue-200"
                >
                  Save Purchase Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatStock = (stock: number, unitsPerBox?: number) => {
  const safeStock = stock ?? 0;
  if (!unitsPerBox || unitsPerBox <= 1) {
    return Number.isInteger(safeStock) ? safeStock.toString() : Number(safeStock).toFixed(2);
  }
  const boxes = Math.floor(safeStock / unitsPerBox);
  const loose = safeStock % unitsPerBox;
  if (boxes === 0) return `${Number.isInteger(loose) ? loose : loose.toFixed(2)} units`;
  if (loose === 0) return `${boxes} boxes`;
  return `${boxes} boxes, ${Number.isInteger(loose) ? loose : loose.toFixed(2)} units`;
};

const ModifierGroupEditor = ({ onSave, onCancel, initialGroup }: { onSave: (group: ModifierGroup) => void, onCancel: () => void, initialGroup?: ModifierGroup }) => {
  const [group, setGroup] = useState<ModifierGroup>(initialGroup || {
    id: `GRP-${Date.now()}`,
    nombre: '',
    required: false,
    allowMultiple: false,
    modifiers: []
  });

  const addModifier = () => {
    setGroup({
      ...group,
      modifiers: [...group.modifiers, { id: `MOD-${Date.now()}`, nombre: '', precio: 0 }]
    });
  };

  const removeModifier = (id: string) => {
    setGroup({
      ...group,
      modifiers: group.modifiers.filter(m => m.id !== id)
    });
  };

  const updateModifier = (id: string, updates: Partial<Modifier>) => {
    setGroup({
      ...group,
      modifiers: group.modifiers.map(m => m.id === id ? { ...m, ...updates } : m)
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Group Name</label>
          <input
            type="text"
            value={group.nombre}
            onChange={e => setGroup({ ...group, nombre: e.target.value })}
            className="w-full p-3 bg-white border-2 border-gray-100 rounded-xl font-bold outline-none focus:border-blue-500 transition-all"
            placeholder="e.g., Extra Toppings"
          />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={group.required}
              onChange={e => setGroup({ ...group, required: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-bold text-gray-600 uppercase">Required</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={group.allowMultiple}
              onChange={e => setGroup({ ...group, allowMultiple: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-bold text-gray-600 uppercase">Allow Multiple</span>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Options</h4>
          <button
            type="button"
            onClick={addModifier}
            className="text-[10px] font-black text-blue-600 uppercase hover:underline"
          >
            + Add Option
          </button>
        </div>
        {group.modifiers.map((mod) => (
          <div key={mod.id} className="flex gap-2 items-center animate-in slide-in-from-left-2 duration-200">
            <input
              type="text"
              value={mod.nombre}
              onChange={e => updateModifier(mod.id, { nombre: e.target.value })}
              className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
              placeholder="Option Name"
            />
            <div className="relative w-24">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-bold">$</span>
              <input
                type="number"
                step="0.01"
                value={mod.precio}
                onChange={e => updateModifier(mod.id, { precio: parseFloat(e.target.value) || 0 })}
                className="w-full pl-5 pr-2 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => removeModifier(mod.id)}
              className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(group)}
          disabled={!group.nombre || group.modifiers.length === 0}
          className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          Save to Library
        </button>
      </div>
    </div>
  );
};

const CreateProductModal = ({ onClose, onSave, categories, initialProduct, globalImages = [], businessCategory, globalModifierGroups = [], initialModuleType }: any) => {
    const [product, setProduct] = useState<Partial<Product>>({
    upc: '',
    boxBarcode: '',
    unitsPerBox: 1,
    nombre: '',
    precio: 0,
    costo: 0,
    categoria: categories[0]?.nombre || '',
    moduleType: initialModuleType || 'grocery',
    sku: '',
    lote: '',
    vencimiento: '',
    stock: 0,
    threshold: 0,
    componenteActivo: '',
    laboratorio: '',
    unidad: '',
    descuento: 0,
    imagenUrl: '',
    showInPOS: true,
    ...initialProduct
  });

  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>(initialProduct?.modifierGroups || []);
  const [imagePreview, setImagePreview] = useState<string>(product.imagenUrl || '');
  const [isImportingFromLibrary, setIsImportingFromLibrary] = useState(false);

  const handleImportModifiersExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = utils.sheet_to_json(sheet) as any[];

        const groupsMap = new Map<string, ModifierGroup>();

        rows.forEach(row => {
          const groupName = row['Group Name'] || row['Grupo'];
          if (!groupName) return;

          if (!groupsMap.has(groupName)) {
            groupsMap.set(groupName, {
              id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              nombre: groupName,
              required: String(row['Required'] || row['Obligatorio']).toLowerCase() === 'true',
              allowMultiple: String(row['Multiple'] || row['Multiple Seleccion']).toLowerCase() === 'true',
              modifiers: []
            });
          }

          const group = groupsMap.get(groupName)!;
          const modName = row['Modifier Name'] || row['Modificador'];
          if (modName) {
            group.modifiers.push({
              id: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              nombre: modName,
              precio: parseFloat(row['Price'] || row['Precio']) || 0
            });
          }
        });

        setModifierGroups(prev => [...prev, ...Array.from(groupsMap.values())]);
        toast.success('Modifiers imported successfully');
      } catch (error) {
        console.error("Error importing modifiers:", error);
        toast.error('Failed to import modifiers. Check file format.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic check for file size before processing
      if (file.size > 2 * 1024 * 1024) { // 2MB
        toast.error("Image too large. Please select an image under 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // Resize image to max 400x400 while maintaining aspect ratio
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Get resized base64 (using jpeg to reduce size further)
          const base64String = canvas.toDataURL('image/jpeg', 0.7);
          
          if (base64String.length > 800000) { // Still too big for Firestore (approx 800KB)
             toast.error("Image is still too large after resizing.");
             return;
          }

          setProduct({ ...product, imagenUrl: base64String });
          setImagePreview(base64String);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...product, id: product.id || `PROD-${Date.now()}`, modifierGroups });
  };

  const addModifierGroup = () => {
    const newGroup: ModifierGroup = {
      id: `GRP-${Date.now()}`,
      nombre: '',
      required: false,
      allowMultiple: false,
      modifiers: []
    };
    setModifierGroups([...modifierGroups, newGroup]);
  };

  const removeModifierGroup = (groupId: string) => {
    setModifierGroups(modifierGroups.filter(g => g.id !== groupId));
  };

  const updateModifierGroup = (groupId: string, updates: Partial<ModifierGroup>) => {
    setModifierGroups(modifierGroups.map(g => g.id === groupId ? { ...g, ...updates } : g));
  };

  const addModifier = (groupId: string) => {
    setModifierGroups(modifierGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          modifiers: [...g.modifiers, { id: `MOD-${Date.now()}`, nombre: '', precio: 0 }]
        };
      }
      return g;
    }));
  };

  const updateModifier = (groupId: string, modifierId: string, updates: Partial<Modifier>) => {
    setModifierGroups(modifierGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          modifiers: g.modifiers.map(m => m.id === modifierId ? { ...m, ...updates } : m)
        };
      }
      return g;
    }));
  };

  const removeModifier = (groupId: string, modifierId: string) => {
    setModifierGroups(modifierGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          modifiers: g.modifiers.filter(m => m.id !== modifierId)
        };
      }
      return g;
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">{initialProduct ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div className="flex flex-col items-center mb-4">
            <div className="w-32 h-32 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <Plus className="w-8 h-8 text-gray-400" />
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center pointer-events-none">
                <div className="bg-indigo-600 rounded-full p-2 mb-1 shadow-lg">
                  <Upload className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-[10px] font-black uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded-full">Change</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase">Click to upload product image</p>
          </div>

          {globalImages.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Or select from Global Image Bank</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {globalImages.map((img: any) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setProduct({ ...product, imagenUrl: img.url });
                      setImagePreview(img.url);
                    }}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl border-2 transition ${product.imagenUrl === img.url ? 'border-blue-600' : 'border-transparent'}`}
                  >
                    <img src={img.url} alt="Bank" className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {(!businessCategory || businessCategory.enabledFields.nombre) && (
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product Name</label>
                <input required type="text" value={product.nombre || ''} onChange={e => setProduct({...product, nombre: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.upc) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">UPC (Unit Barcode)</label>
                <input type="text" value={product.upc || ''} onChange={e => setProduct({...product, upc: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.boxBarcode) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Box Barcode (14 digits)</label>
                <input type="text" value={product.boxBarcode || ''} onChange={e => setProduct({...product, boxBarcode: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.unitsPerBox) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Units Per Box</label>
                <input 
                  type="number" 
                  min="0.1" 
                  step="0.1"
                  value={product.unitsPerBox || 1} 
                  onChange={e => {
                    setProduct({...product, unitsPerBox: parseFloat(e.target.value) || 1});
                  }} 
                  onFocus={e => e.target.select()}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.categoria) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                <select value={product.categoria || ''} onChange={e => setProduct({...product, categoria: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                  {categories.map((c: any) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
            )}
            {businessCategory?.id === 'combo' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Module Type</label>
                <select value={product.moduleType || 'grocery'} onChange={e => setProduct({...product, moduleType: e.target.value as 'grocery'|'restaurant'})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                  <option value="grocery">Grocery / Store</option>
                  <option value="restaurant">Restaurant</option>
                </select>
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.precio) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Price</label>
                <input type="number" step="0.01" value={product.precio || 0} onChange={e => setProduct({...product, precio: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.costo) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cost</label>
                <input type="number" step="0.01" value={product.costo || 0} onChange={e => setProduct({...product, costo: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.stock) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Initial Stock (Units)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={product.stock || 0} 
                  onChange={e => {
                    setProduct({...product, stock: parseFloat(e.target.value) || 0});
                  }} 
                  onFocus={e => e.target.select()}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.threshold) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reorder Threshold</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={product.threshold || 0} 
                  onChange={e => {
                    setProduct({...product, threshold: parseFloat(e.target.value) || 0});
                  }} 
                  onFocus={e => e.target.select()}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.sku) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU</label>
                <input type="text" value={product.sku || ''} onChange={e => setProduct({...product, sku: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.serialNumber) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Serial Number</label>
                <input type="text" value={product.serialNumber || ''} onChange={e => setProduct({...product, serialNumber: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.lote) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Batch (Lote)</label>
                <input type="text" value={product.lote || ''} onChange={e => setProduct({...product, lote: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.vencimiento) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiration Date</label>
                <input type="date" value={product.vencimiento || ''} onChange={e => setProduct({...product, vencimiento: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.componenteActivo) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Active Component</label>
                <input type="text" value={product.componenteActivo || ''} onChange={e => setProduct({...product, componenteActivo: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.laboratorio) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Laboratory</label>
                <input type="text" value={product.laboratorio || ''} onChange={e => setProduct({...product, laboratorio: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.unidad) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unit</label>
                <input type="text" value={product.unidad || ''} onChange={e => setProduct({...product, unidad: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            {(!businessCategory || businessCategory.enabledFields.descuento) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max Discount %</label>
                <input type="number" step="0.01" value={product.descuento || 0} onChange={e => setProduct({...product, descuento: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            )}
            <div className="col-span-2 flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-900">Show in POS</p>
                <p className="text-[10px] text-blue-600 font-medium">If disabled, this product will not appear in the sales catalog.</p>
              </div>
              <button
                type="button"
                onClick={() => setProduct({ ...product, showInPOS: !product.showInPOS })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  product.showInPOS ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    product.showInPOS ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Modifiers Section */}
          {(!businessCategory || businessCategory.enabledFields.modifiers) && (
            <div className="pt-6 border-t border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Product Modifiers</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Options like sizes, extras, or customizations</p>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-black hover:bg-green-100 transition-all cursor-pointer">
                    <Upload className="w-4 h-4" /> IMPORT EXCEL
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportModifiersExcel} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsImportingFromLibrary(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-black hover:bg-amber-100 transition-all"
                  >
                    <ListFilter className="w-4 h-4" /> FROM LIBRARY
                  </button>
                  <button
                    type="button"
                    onClick={addModifierGroup}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black hover:bg-blue-100 transition-all"
                  >
                    <Plus className="w-4 h-4" /> ADD GROUP
                  </button>
                </div>
              </div>

              {isImportingFromLibrary && (
                <div className="mb-6 p-4 bg-amber-50 rounded-2xl border-2 border-amber-100 animate-in fade-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest">Select from Library</h4>
                    <button onClick={() => setIsImportingFromLibrary(false)} className="text-amber-600 hover:text-amber-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                    {globalModifierGroups.map(group => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => {
                          setModifierGroups([...modifierGroups, { ...group, id: `GRP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` }]);
                          setIsImportingFromLibrary(false);
                          toast.success(`Added ${group.nombre}`);
                        }}
                        className="flex items-center justify-between p-3 bg-white border border-amber-200 rounded-xl hover:border-amber-500 hover:shadow-sm transition-all text-left"
                      >
                        <div>
                          <p className="text-xs font-black text-gray-900 uppercase">{group.nombre}</p>
                          <p className="text-[10px] text-gray-500">{group.modifiers.length} options</p>
                        </div>
                        <Plus className="w-4 h-4 text-amber-600" />
                      </button>
                    ))}
                    {globalModifierGroups.length === 0 && (
                      <p className="col-span-2 text-center py-4 text-xs font-bold text-amber-600 italic">No modifiers in library yet.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {modifierGroups.map((group) => (
                  <div key={group.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <div className="flex gap-4 items-start">
                      <div className="flex-1">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Group Name</label>
                        <input
                          type="text"
                          value={group.nombre}
                          onChange={e => updateModifierGroup(group.id, { nombre: e.target.value })}
                          placeholder="e.g. Choose Size, Extras..."
                          className="w-full p-2 bg-white border border-gray-200 rounded-lg font-bold text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-4 pt-6">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={group.required}
                            onChange={e => updateModifierGroup(group.id, { required: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-blue-600">Required</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={group.allowMultiple}
                            onChange={e => updateModifierGroup(group.id, { allowMultiple: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-blue-600">Multiple</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeModifierGroup(group.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Options</span>
                        <button
                          type="button"
                          onClick={() => addModifier(group.id)}
                          className="text-[10px] font-black text-blue-600 hover:underline"
                        >
                          + ADD OPTION
                        </button>
                      </div>
                      {group.modifiers.map((mod) => (
                        <div key={mod.id} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={mod.nombre}
                            onChange={e => updateModifier(group.id, mod.id, { nombre: e.target.value })}
                            placeholder="Option Name"
                            className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                          />
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-bold">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={mod.precio}
                              onChange={e => updateModifier(group.id, mod.id, { precio: parseFloat(e.target.value) || 0 })}
                              className="w-full p-2 pl-5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-right outline-none focus:border-blue-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeModifier(group.id, mod.id)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {modifierGroups.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No modifiers added yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">Cancel</button>
            <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200">Save Product</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CreateCategoryModal = ({ onClose, onSave, availableTaxes, businessCategory }: any) => {
  const [category, setCategory] = useState({ nombre: '', taxIds: [] as string[], quickAccess: false, moduleType: 'grocery' });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...category, id: `CAT-${Date.now()}` });
  };

  const toggleTax = (taxId: string) => {
    setCategory(prev => ({
      ...prev,
      taxIds: prev.taxIds.includes(taxId) 
        ? prev.taxIds.filter(id => id !== taxId)
        : [...prev.taxIds, taxId]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Category</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
            <input required type="text" placeholder="Nombre" value={category.nombre || ''} onChange={e => setCategory({...category, nombre: e.target.value})} className="w-full p-2 border rounded" />
          </div>

          {businessCategory?.id === 'combo' && (
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Module Type</label>
              <select 
                value={category.moduleType} 
                onChange={e => setCategory({...category, moduleType: e.target.value})} 
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              >
                <option value="grocery">Grocery / Store</option>
                <option value="restaurant">Restaurant</option>
              </select>
            </div>
          )}
          
          {availableTaxes && availableTaxes.length > 0 && (
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Taxes Aplicables</label>
              <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                {availableTaxes.map((tax: any) => (
                  <label key={tax.id} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={category.taxIds.includes(tax.id)}
                      onChange={() => toggleTax(tax.id)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{tax.nombre} ({tax.porcentaje}%)</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-800">Quick Access</p>
              <p className="text-xs text-slate-500">Show items in the Quick Access panel by default</p>
            </div>
            <button
              type="button"
              onClick={() => setCategory(prev => ({ ...prev, quickAccess: !prev.quickAccess }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${category.quickAccess ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${category.quickAccess ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CreateTaxModal = ({ onClose, onSave }: any) => {
  const [tax, setTax] = useState({ nombre: '', tasa: 0 });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...tax, id: `TAX-${Date.now()}` });
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Tax</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" placeholder="Nombre" value={tax.nombre || ''} onChange={e => setTax({...tax, nombre: e.target.value})} className="w-full p-2 border rounded" />
          <input required type="number" placeholder="Tasa (%)" value={tax.tasa || 0} onChange={e => setTax({...tax, tasa: Number(e.target.value)})} className="w-full p-2 border rounded" />
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CreateDeviceModal = ({ onClose, onSave }: any) => {
  const [device, setDevice] = useState({ nombre: '', direccion: '', tipo: 'Printer', conexion: 'WIFI', activo: true, modelo: '' });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...device, id: `DEV-${Date.now()}` });
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Device</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" placeholder="Device Name (e.g., Main Printer)" value={device.nombre || ''} onChange={e => setDevice({...device, nombre: e.target.value})} className="w-full p-2 border rounded-xl" />
          <select required value={device.tipo} onChange={e => setDevice({...device, tipo: e.target.value as any})} className="w-full p-2 border rounded-xl">
            <option value="Printer">Printer</option>
            <option value="Scale">Scale / Scanner</option>
            <option value="Scanner">Barcode Scanner</option>
            <option value="CreditCard">Credit Card Terminal</option>
          </select>
          {device.tipo === 'CreditCard' && (
            <select required value={device.modelo} onChange={e => setDevice({...device, modelo: e.target.value})} className="w-full p-2 border rounded-xl">
              <option value="">Select Terminal Model...</option>
              <option value="PAX A80">PAX A80</option>
              <option value="PAX A35">PAX A35</option>
              <option value="PAX A920">PAX A920</option>
              <option value="Other">Other Model</option>
            </select>
          )}
          <select required value={device.conexion} onChange={e => setDevice({...device, conexion: e.target.value as any})} className="w-full p-2 border rounded-xl">
            <option value="WIFI">WIFI</option>
            <option value="Bluetooth">Bluetooth</option>
            <option value="IP">IP / Network</option>
            <option value="USB">USB</option>
          </select>
          <input required={device.conexion !== 'USB'} type="text" placeholder={device.conexion === 'USB' ? "USB / System Port (Optional)" : "IP Address / Mac Address"} value={device.direccion || ''} onChange={e => setDevice({...device, direccion: e.target.value})} className="w-full p-2 border rounded-xl" />
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-xl font-bold text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700">Save Device</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditDeviceModal = ({ item, onClose, onSave }: any) => {
  const [device, setDevice] = useState({ ...item });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(device);
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Edit Device</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" placeholder="Device Name (e.g., Main Printer)" value={device.nombre || ''} onChange={e => setDevice({...device, nombre: e.target.value})} className="w-full p-2 border rounded-xl" />
          <select required value={device.tipo} onChange={e => setDevice({...device, tipo: e.target.value as any})} className="w-full p-2 border rounded-xl">
            <option value="Printer">Printer</option>
            <option value="Scale">Scale / Scanner</option>
            <option value="Scanner">Barcode Scanner</option>
            <option value="CreditCard">Credit Card Terminal</option>
          </select>
          {device.tipo === 'CreditCard' && (
            <select required value={device.modelo} onChange={e => setDevice({...device, modelo: e.target.value})} className="w-full p-2 border rounded-xl">
              <option value="">Select Terminal Model...</option>
              <option value="PAX A80">PAX A80</option>
              <option value="PAX A35">PAX A35</option>
              <option value="PAX A920">PAX A920</option>
              <option value="Other">Other Model</option>
            </select>
          )}
          <select required value={device.conexion} onChange={e => setDevice({...device, conexion: e.target.value as any})} className="w-full p-2 border rounded-xl">
            <option value="WIFI">WIFI</option>
            <option value="Bluetooth">Bluetooth</option>
            <option value="IP">IP / Network</option>
            <option value="USB">USB</option>
          </select>
          <input required={device.conexion !== 'USB'} type="text" placeholder={device.conexion === 'USB' ? "USB / System Port (Optional)" : "IP Address / Mac Address"} value={device.direccion || ''} onChange={e => setDevice({...device, direccion: e.target.value})} className="w-full p-2 border rounded-xl" />
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-xl font-bold text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700">Update Device</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CreateSalesmanModal = ({ onClose, onSave }: any) => {
  const [salesman, setSalesman] = useState({ nombre: '', apellido: '', codigo: '', email: '', telefono: '', direccion: '', ciudad: '', estado: '', cp: '', taxId: '', activo: true, pin: '1111' });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...salesman, id: `SAL-${Date.now()}` });
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Salesman</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input required type="text" placeholder="Nombre" value={salesman.nombre || ''} onChange={e => setSalesman({...salesman, nombre: e.target.value})} className="w-full p-2 border rounded" />
            <input required type="text" placeholder="Apellido" value={salesman.apellido || ''} onChange={e => setSalesman({...salesman, apellido: e.target.value})} className="w-full p-2 border rounded" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input required type="text" placeholder="Codigo" value={salesman.codigo || ''} onChange={e => setSalesman({...salesman, codigo: e.target.value})} className="w-full p-2 border rounded" />
            <input required type="text" maxLength={4} placeholder="PIN (4 digits)" value={salesman.pin || ''} onChange={e => setSalesman({...salesman, pin: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded font-mono" />
          </div>
          <input type="email" placeholder="Email" value={salesman.email || ''} onChange={e => setSalesman({...salesman, email: e.target.value})} className="w-full p-2 border rounded" />
          <input type="text" placeholder="Teléfono" value={salesman.telefono || ''} onChange={e => setSalesman({...salesman, telefono: e.target.value})} className="w-full p-2 border rounded" />
          <input type="text" placeholder="Direccion" value={salesman.direccion || ''} onChange={e => setSalesman({...salesman, direccion: e.target.value})} className="w-full p-2 border rounded" />
          <div className="grid grid-cols-3 gap-4">
            <input type="text" placeholder="Ciudad" value={salesman.ciudad || ''} onChange={e => setSalesman({...salesman, ciudad: e.target.value})} className="w-full p-2 border rounded" />
            <input type="text" placeholder="Estado" value={salesman.estado || ''} onChange={e => setSalesman({...salesman, estado: e.target.value})} className="w-full p-2 border rounded" />
            <input type="text" placeholder="CP" value={salesman.cp || ''} onChange={e => setSalesman({...salesman, cp: e.target.value})} className="w-full p-2 border rounded" />
          </div>
          <input type="text" placeholder="Tax ID" value={salesman.taxId || ''} onChange={e => setSalesman({...salesman, taxId: e.target.value})} className="w-full p-2 border rounded" />
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", type = "danger" }: any) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-bold"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            className={`px-4 py-2 text-white rounded-lg transition font-bold ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const Toast = ({ message, type = 'info', onClose }: any) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-blue-600';

  return (
    <div className={`fixed bottom-4 right-4 ${bgClass} text-white px-6 py-3 rounded-xl shadow-2xl z-[200] flex items-center gap-3 animate-in slide-in-from-right-10 duration-300`}>
      <span className="font-bold">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  onBack, storeSettings, setStoreSettings, products, setProducts, clients, setClients, salesmen, setSalesmen, orders, setOrders, inventory, setInventory, categories, setCategories, taxes, setTaxes, devices, setDevices, vendors, setVendors, purchaseOrders, setPurchaseOrders, isSuperAdmin, onBackToSuperAdmin 
}) => {
  const { t, i18n } = useTranslation();
  
  // Set language whenever settings change
  useEffect(() => {
    if (storeSettings.language && storeSettings.language !== i18n.language) {
      i18n.changeLanguage(storeSettings.language);
      localStorage.setItem('app_language', storeSettings.language);
    }
  }, [storeSettings.language, i18n]);

  const [activeTab, setActiveTab] = useState<Tab>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [isCreatingSalesman, setIsCreatingSalesman] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingTax, setIsCreatingTax] = useState(false);
  const [isCreatingGlobalModifier, setIsCreatingGlobalModifier] = useState(false);
  const [isImportingFromLibrary, setIsImportingFromLibrary] = useState(false);
  const [isCreatingDevice, setIsCreatingDevice] = useState(false);
  const [importTargetModule, setImportTargetModule] = useState<'grocery' | 'restaurant' | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingPromo, setIsAddingPromo] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productAdminComboView, setProductAdminComboView] = useState<'grocery' | 'restaurant'>('grocery');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [salesmanSearchQuery, setSalesmanSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryDateFilter, setInventoryDateFilter] = useState('');
  const [isReceivingInventory, setIsReceivingInventory] = useState(false);
  const [isScanningDevices, setIsScanningDevices] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderCustomerSearchQuery, setOrderCustomerSearchQuery] = useState('');
  const [activeToast, setActiveToast] = useState<{ message: string, type: 'info' | 'success' | 'error' } | null>(null);
  const [confirmation, setConfirmation] = useState<{ 
    isOpen: boolean, 
    title: string, 
    message: string, 
    onConfirm: () => void, 
    confirmText?: string,
    type?: 'danger' | 'info'
  }>({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: () => {} 
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, step: 1 | 2, productId: string | null }>({ isOpen: false, step: 1, productId: null });
  const [cleanConfirmation, setCleanConfirmation] = useState<{ isOpen: boolean, step: 1 | 2, collection: string | null, setter: any | null, title: string | null }>({ isOpen: false, step: 1, collection: null, setter: null, title: null });
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportCategory, setReportCategory] = useState<string>('all');
  const [reportProduct, setReportProduct] = useState<string>('');
  const [reportClient, setReportClient] = useState<string>('all');
  const [newEmailContact, setNewEmailContact] = useState({ nombre: '', email: '' });
  const [isViewingGlobalCatalog, setIsViewingGlobalCatalog] = useState(false);
  const [globalProducts, setGlobalProducts] = useState<any[]>([]);
  const [globalImages, setGlobalImages] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory | null>(null);
  const [globalModifierGroups, setGlobalModifierGroups] = useState<GlobalModifierGroup[]>([]);
  const [modifierSearchQuery, setModifierSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'modifiers'), where('storeId', '==', storeSettings.id));
    const unsub = onSnapshot(q, (snapshot) => {
      setGlobalModifierGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalModifierGroup)));
    });
    return () => unsub();
  }, [storeSettings.id]);

  const fetchGlobalCatalog = async () => {
    try {
      const [prodSnap, imgSnap] = await Promise.all([
        getDocs(collection(db, 'system', 'catalog', 'products')),
        getDocs(collection(db, 'system', 'catalog', 'images'))
      ]);
      setGlobalProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setGlobalImages(imgSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching global catalog:", error);
    }
  };

  const importGlobalProduct = async (gp: any) => {
    const newProduct: Product = {
      id: `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      storeId: storeSettings.id,
      nombre: gp.nombre,
      precio: gp.precio,
      costo: gp.precio * 0.7, // Estimate cost
      categoria: gp.categoria || 'Imported',
      imagenUrl: gp.imagen,
      stock: 0,
      upc: '',
      sku: '',
      lote: '',
      vencimiento: '',
      threshold: 5,
      componenteActivo: '',
      laboratorio: '',
      unidad: 'Unidad',
      descuento: 0,
      boxBarcode: '',
      unitsPerBox: 1
    };

    try {
      await setDoc(doc(db, 'products', newProduct.id), sanitizeForFirestore(newProduct));
      toast.success(`${gp.nombre} imported successfully!`);
    } catch (error) {
      console.error("Error importing global product:", error);
      toast.error("Failed to import product.");
    }
  };

  const tabs = [
    { id: 'Dashboard', icon: LayoutDashboard },
    { id: 'POS / Sales', icon: ShoppingCart },
    { id: 'Products', icon: Package },
    { id: 'Clients', icon: Users },
    { id: 'Salesmen', icon: Briefcase, label: storeSettings.salesmenLabel || 'Usuarios', isSalesmen: true },
    { id: 'Suppliers', icon: Truck },
    { id: 'Purchase Orders', icon: FileText },
    { id: 'Orders', icon: ShoppingCart },
    { id: 'Inventory', icon: Archive },
    { id: 'Modifiers Library', icon: ListFilter },
    { id: 'Categories', icon: Tags },
    { id: 'Reports', icon: TrendingUp },
    { id: 'Devices', icon: PrinterIcon },
    { id: 'Settings', icon: Settings },
  ];

  const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeForFirestore(item));
    }
    if (typeof obj === 'object' && !(obj instanceof Date)) {
      const sanitized: any = {};
      Object.keys(obj).forEach(key => {
        // Skip empty string or whitespace-only keys which are invalid in Firestore
        if (!key || key.trim() === "") return;
        
        if (obj[key] === undefined) {
          // Skip undefined
        } else {
          sanitized[key] = sanitizeForFirestore(obj[key]);
        }
      });
      return sanitized;
    }
    return obj;
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setActiveToast({ message, type });
  };

  const handleUpdateInventory = async (id: string, updates: Partial<Inventory>) => {
    const updatedInventory = inventory.map(inv => inv.id === id ? { ...inv, ...updates } : inv);
    setInventory(updatedInventory);
    
    try {
      const invRef = doc(db, 'inventory', id);
      const currentInv = updatedInventory.find(inv => inv.id === id);
      if (currentInv) {
        await setDoc(invRef, sanitizeForFirestore(currentInv), { merge: true });
        if (selectedInventory?.id === id) setSelectedInventory(currentInv);
        showToast("Inventory updated successfully", "success");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const handleReceivePO = async (po: PurchaseOrder) => {
    const updatedPO = { ...po, estado: 'Recibido' as const, fechaRecepcion: Date.now() };
    try {
      await setDoc(doc(db, 'purchaseOrders', po.id), sanitizeForFirestore(updatedPO), { merge: true });
      if (selectedPO?.id === po.id) setSelectedPO(updatedPO);
      
      // Update products stock and cost
      const newProducts = [...products];
      const productUpdates = po.articulos.map(async (item) => {
        const productIndex = newProducts.findIndex(p => p.id === item.productId);
        if (productIndex !== -1) {
          const updatedProduct = {
            ...newProducts[productIndex],
            stock: newProducts[productIndex].stock + item.cantidad,
            costo: item.costo // Update cost to latest purchase cost
          };
          newProducts[productIndex] = updatedProduct;
          // Update product in Firebase
          try {
            return await setDoc(doc(db, 'products', item.productId), sanitizeForFirestore(updatedProduct), { merge: true });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `products/${item.productId}`);
          }
        }
      });
      
      await Promise.all(productUpdates);
      setProducts(newProducts);

      // Add to inventory records
      const newInventoryRecord: Inventory = {
        id: `INV-${Date.now()}`,
        storeId: storeSettings.id,
        proveedor: vendors.find(v => v.id === po.vendorId)?.nombre || 'Unknown',
        fecha: Date.now(),
        factura: po.invoiceNumber || 'N/A',
        articulos: po.articulos.length,
        total: po.total,
        estado: 'Completado',
        items: po.articulos // Include items for better tracking
      };
      
      try {
        await setDoc(doc(db, 'inventory', newInventoryRecord.id), sanitizeForFirestore(newInventoryRecord));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `inventory/${newInventoryRecord.id}`);
      }

      showToast('Inventory updated successfully!', 'success');
    } catch (error) {
      if (error instanceof Error && error.message.includes('{')) {
        // Already handled by handleFirestoreError
        throw error;
      }
      handleFirestoreError(error, OperationType.UPDATE, `purchaseOrders/${po.id}`);
    }
  };

  const handlePOStatusUpdate = (po: PurchaseOrder, newStatus: PurchaseOrder['estado']) => {
    const updatedPO = { ...po, estado: newStatus };
    if (newStatus === 'Recibido' && !updatedPO.fechaRecepcion) {
      updatedPO.fechaRecepcion = Date.now();
    }
    setDoc(doc(db, 'purchaseOrders', po.id), sanitizeForFirestore(updatedPO), { merge: true }).catch(error => {
      handleFirestoreError(error, OperationType.UPDATE, `purchaseOrders/${po.id}`);
    });
    if (selectedPO?.id === po.id) setSelectedPO(updatedPO);
  };

  const handleProductChange = (id: string, field: keyof Product, value: any) => {
    const safeValue = value === undefined ? '' : value;
    setDoc(doc(db, 'products', id), { [field]: safeValue }, { merge: true }).catch(error => {
      handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
    });
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: safeValue } : p));
  };

  const handleClientChange = (id: string, field: keyof Client, value: any) => {
    const safeValue = value ?? '';
    setDoc(doc(db, 'clients', id), { [field]: safeValue }, { merge: true }).catch(error => {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${id}`);
    });
    // Optimistic update
  };

  const handleSalesmanChange = (id: string, field: keyof Salesman, value: any) => {
    const safeValue = value ?? '';
    setDoc(doc(db, 'salesmen', id), { [field]: safeValue }, { merge: true }).catch(error => {
      handleFirestoreError(error, OperationType.UPDATE, `salesmen/${id}`);
    });
    // Optimistic update
  };

  const handleDeleteProduct = (id: string) => {
    setDeleteConfirmation({ isOpen: true, step: 1, productId: id });
  };

  const handleDeleteClient = (id: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Client',
      message: 'Are you sure you want to delete this client? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'clients', id));
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          showToast('Client deleted successfully', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `clients/${id}`);
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handleDeleteSalesman = (id: string) => {
    if (id === 'admin') {
      showToast('Cannot delete the Admin user', 'error');
      return;
    }
    setConfirmation({
      isOpen: true,
      title: 'Delete Salesman',
      message: 'Are you sure you want to delete this salesman? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'salesmen', id));
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          showToast('Salesman deleted successfully', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `salesmen/${id}`);
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handleDeletePurchaseOrder = (id: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Purchase Order',
      message: 'Are you sure you want to delete this purchase order? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'purchaseOrders', id));
          if (selectedPO?.id === id) setSelectedPO(null);
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          showToast('Purchase order deleted successfully', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `purchaseOrders/${id}`);
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handleDeleteInventory = (id: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Inventory Record',
      message: 'Are you sure you want to delete this inventory record? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'inventory', id));
          if (selectedInventory?.id === id) setSelectedInventory(null);
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          showToast('Inventory record deleted successfully', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handleDeleteTax = (id: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Tax',
      message: 'Are you sure you want to delete this tax? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'taxes', id));
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          showToast('Tax deleted successfully', 'success');
        } catch (error) {
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          try {
            handleFirestoreError(error, OperationType.DELETE, `taxes/${id}`);
          } catch (e) {
            console.error(e);
            showToast('No se pudo borrar el tax. Verifique permisos.', 'error');
          }
        }
      }
    });
  };

  const handleDeleteOrderById = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'orders', id));
      if (selectedOrder?.id === id) setSelectedOrder(null);
      showToast('Order deleted successfully', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${id}`);
    }
  };

  const handleDeleteVendor = (id: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Vendor',
      message: 'Are you sure you want to delete this vendor? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'vendors', id));
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          showToast('Vendor deleted successfully', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `vendors/${id}`);
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handleCleanAll = (collectionName: string, setter: any, title: string) => {
    setCleanConfirmation({ isOpen: true, step: 1, collection: collectionName, setter, title });
  };

  const confirmCleanAll = async () => {
    if (cleanConfirmation.step === 1) {
      setCleanConfirmation(prev => ({ ...prev, step: 2 }));
    } else if (cleanConfirmation.step === 2 && cleanConfirmation.collection && cleanConfirmation.setter) {
      try {
        const q = query(collection(db, cleanConfirmation.collection), where('storeId', '==', storeSettings.id));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        cleanConfirmation.setter([]);
        setCleanConfirmation({ isOpen: false, step: 1, collection: null, setter: null, title: null });
        showToast(`${cleanConfirmation.title} cleaned successfully`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, cleanConfirmation.collection);
        setCleanConfirmation({ isOpen: false, step: 1, collection: null, setter: null, title: null });
      }
    }
  };

  const confirmDeleteProduct = () => {
    if (deleteConfirmation.step === 1) {
      setDeleteConfirmation(prev => ({ ...prev, step: 2 }));
    } else if (deleteConfirmation.step === 2 && deleteConfirmation.productId) {
      const id = deleteConfirmation.productId;
      console.log("Confirmed deletion for product:", id);
      deleteDoc(doc(db, 'products', id)).then(() => {
        console.log("Product deleted successfully from Firestore:", id);
        setDeleteConfirmation({ isOpen: false, step: 1, productId: null });
      }).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
        setDeleteConfirmation({ isOpen: false, step: 1, productId: null });
      });
    }
  };

  const handleSaveClient = async (client: Client) => {
    try {
      const clientWithStore = { ...client, storeId: storeSettings.id };
      await setDoc(doc(db, 'clients', client.id), sanitizeForFirestore(clientWithStore));
      setClients([...clients, clientWithStore]);
      setIsCreatingClient(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `clients/${client.id}`);
    }
  };

  const handleSaveCategory = async (category: any) => {
    try {
      const categoryWithStore = { ...category, storeId: storeSettings.id };
      await setDoc(doc(db, 'categories', category.id), sanitizeForFirestore(categoryWithStore));
      setCategories([...categories, categoryWithStore]);
      setIsCreatingCategory(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `categories/${category.id}`);
    }
  };

  const handleSaveGlobalModifier = async (group: ModifierGroup) => {
    try {
      const groupWithStore = { ...group, storeId: storeSettings.id };
      await setDoc(doc(db, 'modifiers', group.id), sanitizeForFirestore(groupWithStore));
      setIsCreatingGlobalModifier(false);
      showToast('Modifier group saved to library', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `modifiers/${group.id}`);
    }
  };

  const handleDeleteGlobalModifier = async (id: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Modifier Group',
      message: 'Are you sure you want to delete this modifier group from the library?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'modifiers', id));
          setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          showToast('Modifier group deleted from library', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `modifiers/${id}`);
        }
      }
    });
  };

  const handleImportGlobalModifiersExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = utils.sheet_to_json(sheet) as any[];

        const groupsMap = new Map<string, GlobalModifierGroup>();

        rows.forEach(row => {
          const groupName = row['Group Name'] || row['Grupo'];
          if (!groupName) return;

          if (!groupsMap.has(groupName)) {
            groupsMap.set(groupName, {
              id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              storeId: storeSettings.id,
              nombre: groupName,
              required: String(row['Required'] || row['Obligatorio']).toLowerCase() === 'true',
              allowMultiple: String(row['Multiple'] || row['Multiple Seleccion']).toLowerCase() === 'true',
              modifiers: []
            });
          }

          const group = groupsMap.get(groupName)!;
          const modName = row['Modifier Name'] || row['Modificador'];
          if (modName) {
            group.modifiers.push({
              id: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              nombre: modName,
              precio: parseFloat(row['Price'] || row['Precio']) || 0
            });
          }
        });

        const batch = writeBatch(db);
        groupsMap.forEach(group => {
          const ref = doc(collection(db, 'modifiers'));
          batch.set(ref, sanitizeForFirestore({ ...group, id: ref.id }));
        });
        await batch.commit();
        showToast('Modifiers imported to library successfully', 'success');
      } catch (error) {
        console.error("Error importing modifiers:", error);
        showToast('Failed to import modifiers. Check file format.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleDownloadModifierTemplate = () => {
    const template = [
      { 'Group Name': 'Toppings', 'Required': 'false', 'Multiple': 'true', 'Modifier Name': 'Extra Cheese', 'Price': 1.50 },
      { 'Group Name': 'Toppings', 'Required': 'false', 'Multiple': 'true', 'Modifier Name': 'Bacon', 'Price': 2.00 },
      { 'Group Name': 'Size', 'Required': 'true', 'Multiple': 'false', 'Modifier Name': 'Small', 'Price': 0 },
      { 'Group Name': 'Size', 'Required': 'true', 'Multiple': 'false', 'Modifier Name': 'Large', 'Price': 3.50 },
    ];
    const ws = utils.json_to_sheet(template);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, "Modifiers_Template.xlsx");
  };

  const handleSaveTax = async (tax: any) => {
    try {
      const taxWithStore = { ...tax, storeId: storeSettings.id };
      await setDoc(doc(db, 'taxes', tax.id), sanitizeForFirestore(taxWithStore));
      setTaxes([...taxes, taxWithStore]);
      setIsCreatingTax(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `taxes/${tax.id}`);
    }
  };

  const handleSaveDevice = async (device: any) => {
    try {
      const deviceWithStore = { ...device, storeId: storeSettings.id };
      await setDoc(doc(db, 'devices', device.id), sanitizeForFirestore(deviceWithStore));
      setDevices([...devices, deviceWithStore]);
      setIsCreatingDevice(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `devices/${device.id}`);
    }
  };

  const handleUpdateDevice = async (device: any) => {
    try {
      await setDoc(doc(db, 'devices', device.id), sanitizeForFirestore(device), { merge: true });
      setDevices(devices.map(d => d.id === device.id ? device : d));
      setEditingDevice(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `devices/${device.id}`);
    }
  };

  const handleSaveSalesman = async (salesman: Salesman) => {
    try {
      const salesmanWithStore = { ...salesman, storeId: storeSettings.id };
      await setDoc(doc(db, 'salesmen', salesman.id), sanitizeForFirestore(salesmanWithStore));
      setSalesmen([...salesmen, salesmanWithStore]);
      setIsCreatingSalesman(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `salesmen/${salesman.id}`);
    }
  };

  const handleReset = async (type: 'transactions' | 'zero') => {
    const password = prompt("Enter password to confirm:");
    if (password !== 'ACS3317') {
      showToast("Incorrect password", 'error');
      return;
    }

    try {
      const batch = writeBatch(db);
      
      const collectionsToReset = type === 'transactions' 
        ? ['orders', 'purchaseOrders', 'inventory']
        : ['orders', 'purchaseOrders', 'inventory', 'products', 'clients', 'salesmen', 'categories', 'taxes', 'devices', 'vendors'];

      for (const colName of collectionsToReset) {
        const q = query(collection(db, colName), where('storeId', '==', storeSettings.id));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
      }

      await batch.commit();
      showToast("Reset successful", 'success');
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reset-all');
    }
  };

  React.useEffect(() => {
    if (storeSettings.businessCategory) {
      const unsub = onSnapshot(doc(db, 'system', 'config', 'rubros', storeSettings.businessCategory), (snapshot) => {
        const fallback = DEFAULT_BUSINESS_CATEGORIES.find(c => c.id === storeSettings.businessCategory);
        if (snapshot.exists()) {
          const data = snapshot.data();
          setBusinessCategory({
            ...fallback,
            ...data,
            enabledFields: {
              ...(fallback?.enabledFields || {}),
              ...(data.enabledFields || {})
            }
          } as BusinessCategory);
        } else {
          // Fallback if not seeded
          setBusinessCategory(fallback as BusinessCategory || null);
        }
      });
      return () => unsub();
    } else {
      setBusinessCategory(null);
    }
  }, [storeSettings.businessCategory]);

  const handleVendorChange = (id: string, field: keyof Vendor, value: any) => {
    const safeValue = value ?? '';
    setDoc(doc(db, 'vendors', id), { [field]: safeValue }, { merge: true }).catch(error => {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${id}`);
    });
    // Optimistic update
  };

  const getEnabledProductHeaders = () => {
    const allHeaders = [
      { key: 'upc', label: 'UPC' },
      { key: 'boxBarcode', label: 'Box Barcode' },
      { key: 'unitsPerBox', label: 'Units/Box' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'precio', label: 'Precio' },
      { key: 'costo', label: 'Costo' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'sku', label: 'SKU' },
      { key: 'lote', label: 'Lote' },
      { key: 'vencimiento', label: 'Vencimiento' },
      { key: 'stock', label: 'Stock' },
      { key: 'componenteActivo', label: 'Comp. Activo' },
      { key: 'laboratorio', label: 'Laboratorio' },
      { key: 'unidad', label: 'Unidad' },
      { key: 'descuento', label: 'Desc %' },
      { key: 'threshold', label: 'Threshold' },
      { key: 'imagenUrl', label: 'Imagen URL' },
      { key: 'descripcion', label: 'Descripcion' }
    ];

    if (!businessCategory) return allHeaders;

    const filtered = allHeaders.filter(h => businessCategory.enabledFields[h.key as keyof typeof businessCategory.enabledFields]);
    if (businessCategory?.id === 'combo') {
      filtered.push({ key: 'moduleType', label: 'Module Type' });
    }
    return filtered;
  };

  const handleExportCSV = (data: any[], filename: string) => {
    if (!data.length) {
      showToast('No data to export', 'info');
      return;
    }

    let csvData: any[] = [];
    let headers: string[] = [];

    if (filename === 'Products') {
      const enabled = getEnabledProductHeaders();
      headers = enabled.map(h => h.label);
      csvData = data.map(row => enabled.map(h => row[h.key] ?? ''));
    } else if (filename === 'Clients') {
      headers = [
        'Nombre', 'Telefono', 'Direccion', 'Ciudad', 'Estado', 'CP', 'Email', 'Vendedor', 'Términos'
      ];
      csvData = data.map(row => [
        row.nombre, row.telefono, row.direccion, row.ciudad, row.estado, row.cp, row.email, row.vendedorAsignado, row.terminosCredito
      ]);
    } else {
      headers = Object.keys(data[0]);
      csvData = data.map(row => Object.values(row));
    }

    const csv = Papa.unparse({
      fields: headers,
      data: csvData
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${filename} exported successfully!`, 'success');
  };

  const handleExportExcel = (data: any[], filename: string) => {
    if (!data.length) {
      showToast('No data to export', 'info');
      return;
    }

    let exportData: any[] = [];
    if (filename === 'Products') {
      const enabled = getEnabledProductHeaders();
      exportData = data.map(row => {
        const obj: any = {};
        enabled.forEach(h => {
          obj[h.label] = row[h.key] ?? '';
        });
        return obj;
      });
    } else if (filename === 'Clients') {
      exportData = data.map(row => ({
        'Nombre': row.nombre,
        'Telefono': row.telefono,
        'Direccion': row.direccion,
        'Ciudad': row.ciudad,
        'Estado': row.estado,
        'CP': row.cp,
        'Email': row.email,
        'Vendedor': row.vendedorAsignado,
        'Términos': row.terminosCredito
      }));
    } else {
      exportData = data;
    }

    const worksheet = utils.json_to_sheet(exportData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, filename);
    writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast(`${filename} exported to Excel successfully!`, 'success');
  };

  const handleDownloadTemplate = (filename: string) => {
    let headers: string[] = [];
    let exampleData: any[] = [];

    if (filename === 'Products') {
      const enabled = getEnabledProductHeaders();
      headers = enabled.map(h => h.label);
      const exampleRow: any = [];
      enabled.forEach(h => {
        if (h.key === 'upc') exampleRow.push('123456789');
        else if (h.key === 'boxBarcode') exampleRow.push('987654321');
        else if (h.key === 'unitsPerBox') exampleRow.push(12);
        else if (h.key === 'nombre') exampleRow.push('Example Product');
        else if (h.key === 'precio') exampleRow.push(10.50);
        else if (h.key === 'costo') exampleRow.push(5.25);
        else if (h.key === 'categoria') exampleRow.push('General');
        else if (h.key === 'sku') exampleRow.push('SKU001');
        else if (h.key === 'lote') exampleRow.push('L001');
        else if (h.key === 'vencimiento') exampleRow.push('2025-12-31');
        else if (h.key === 'stock') exampleRow.push(100);
        else if (h.key === 'componenteActivo') exampleRow.push('Active Component');
        else if (h.key === 'laboratorio') exampleRow.push('Lab A');
        else if (h.key === 'unidad') exampleRow.push('Unit');
        else if (h.key === 'descuento') exampleRow.push(0);
        else if (h.key === 'threshold') exampleRow.push(10);
        else if (h.key === 'imagenUrl') exampleRow.push('https://picsum.photos/200');
        else if (h.key === 'descripcion') exampleRow.push('Product description');
        else exampleRow.push('');
      });
      exampleData = [exampleRow];
    } else if (filename === 'Clients') {
      headers = [
        'Nombre', 'Telefono', 'Direccion', 'Ciudad', 'Estado', 'CP', 'Email', 'Vendedor', 'Términos'
      ];
      exampleData = [
        ['John Doe', '555-0199', '123 Main St', 'City', 'State', '12345', 'john@example.com', 'SALES001', 'Net 30']
      ];
    } else if (filename === 'Salesmen') {
      headers = [
        'Nombre', 'Apellido', 'Codigo', 'Email', 'Telefono', 'Direccion', 'Ciudad', 'Estado', 'CP', 'TaxID', 'Activo'
      ];
      exampleData = [
        ['Jane', 'Smith', 'SALES001', 'jane@example.com', '555-0122', '456 Oak St', 'City', 'State', '12345', 'TAX-001', true]
      ];
    } else if (filename === 'Suppliers') {
      headers = [
        'Nombre', 'Contacto', 'Telefono', 'Email', 'Direccion', 'Terminos'
      ];
      exampleData = [
        ['Supplier Inc', 'Bob Wilson', '555-0333', 'bob@supplier.com', '789 Pine St', 'Net 30']
      ];
    }

    if (headers.length === 0) {
      showToast('Template not available for this tab', 'info');
      return;
    }

    const csv = Papa.unparse({
      fields: headers,
      data: exampleData
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_Template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${filename} template downloaded!`, 'success');
  };

  const handleImportClick = (moduleTarget?: 'grocery' | 'restaurant' | React.MouseEvent) => {
    if (typeof moduleTarget === 'string' && (moduleTarget === 'grocery' || moduleTarget === 'restaurant')) {
      setImportTargetModule(moduleTarget);
    } else if (activeTab === 'Products') {
      setImportTargetModule(productAdminComboView);
    } else {
      setImportTargetModule(null);
    }
    console.log("Import button clicked. Active tab:", activeTab);
    if (!fileInputRef.current) {
      console.error("fileInputRef is null!");
      showToast("Internal error: file input not found.", 'error');
      return;
    }
    fileInputRef.current.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("File selected for import:", file.name, "Size:", file.size, "Type:", file.type);
    showToast(`Reading file: ${file.name}...`, 'info');

    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (!isExcel && !isCSV) {
      console.error("Invalid file format selected:", file.name);
      showToast("Please select a valid CSV or Excel file.", 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const processData = async (data: any[]) => {
      console.log("Processing data array, length:", data?.length);
      if (!data || data.length === 0) {
        console.warn("Data array is empty or invalid");
        showToast("The file is empty or invalid.", 'info');
        return;
      }

      try {
        let collectionName = '';
        let setter: any = null;
        let currentData: any[] = [];
        
        switch (activeTab) {
          case 'Products': collectionName = 'products'; setter = setProducts; currentData = products; break;
          case 'Clients': collectionName = 'clients'; setter = setClients; currentData = clients; break;
          case 'Salesmen': collectionName = 'salesmen'; setter = setSalesmen; currentData = salesmen; break;
          case 'Categories': collectionName = 'categories'; setter = setCategories; currentData = categories; break;
          case 'Taxes': collectionName = 'taxes'; setter = setTaxes; currentData = taxes; break;
          case 'Devices': collectionName = 'devices'; setter = setDevices; currentData = devices; break;
          case 'Suppliers': collectionName = 'vendors'; setter = setVendors; currentData = vendors; break;
          case 'Modifiers Library': {
            const reader = new FileReader();
            reader.onload = async (evt) => {
              try {
                const data = evt.target?.result;
                const workbook = read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = utils.sheet_to_json(sheet) as any[];

                const groupsMap = new Map<string, GlobalModifierGroup>();

                rows.forEach(row => {
                  const groupName = row['Group Name'] || row['Grupo'];
                  if (!groupName) return;

                  if (!groupsMap.has(groupName)) {
                    groupsMap.set(groupName, {
                      id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      storeId: storeSettings.id,
                      nombre: groupName,
                      required: String(row['Required'] || row['Obligatorio']).toLowerCase() === 'true',
                      allowMultiple: String(row['Multiple'] || row['Multiple Seleccion']).toLowerCase() === 'true',
                      modifiers: []
                    });
                  }

                  const group = groupsMap.get(groupName)!;
                  const modName = row['Modifier Name'] || row['Modificador'];
                  if (modName) {
                    group.modifiers.push({
                      id: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      nombre: modName,
                      precio: parseFloat(row['Price'] || row['Precio']) || 0
                    });
                  }
                });

                const batch = writeBatch(db);
                groupsMap.forEach(group => {
                  const ref = doc(collection(db, 'modifiers'));
                  batch.set(ref, sanitizeForFirestore({ ...group, id: ref.id }));
                });
                await batch.commit();
                showToast('Modifiers imported to library successfully', 'success');
              } catch (error) {
                console.error("Error importing modifiers:", error);
                showToast('Failed to import modifiers. Check file format.', 'error');
              }
            };
            reader.readAsBinaryString(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
          default:
            showToast('Import not supported for this tab', 'info');
            return;
        }

        const importErrors: string[] = [];
        let successCount = 0;

        const headerMap: Record<string, string> = {
          // Common
          'id': 'id', 'nombre': 'nombre', 'name': 'nombre', 'email': 'email',
          'telefono': 'telefono', 'phone': 'telefono', 'direccion': 'direccion', 'address': 'direccion',
          'ciudad': 'ciudad', 'city': 'ciudad', 'estado': 'estado', 'state': 'estado',
          'cp': 'cp', 'zip': 'cp', 'zipcode': 'cp', 'zip code': 'cp',

          // Products
          'upc': 'upc', 'barcode': 'upc', 'bar code': 'upc', 'código de barras': 'upc', 'codigo de barras': 'upc', 'cod. barras': 'upc',
          'precio': 'precio', 'price': 'precio', 'costo': 'costo', 'cost': 'costo',
          'categoria': 'categoria', 'category': 'categoria', 'sku': 'sku',
          'lote': 'lote', 'batch': 'lote', 'vencimiento': 'vencimiento', 'expiration': 'vencimiento',
          'stock': 'stock', 'inventory': 'stock', 'existencia': 'stock',
          'componente activo': 'componenteActivo', 'active component': 'componenteActivo', 'comp. activo': 'componenteActivo',
          'laboratorio': 'laboratorio', 'lab': 'laboratorio', 'unidad': 'unidad', 'unit': 'unidad',
          'descuento': 'descuento', 'discount': 'descuento', 'desc %': 'descuento',
          'box barcode': 'boxBarcode', 'barcode caja': 'boxBarcode', 'codigo caja': 'boxBarcode', 'cod. caja': 'boxBarcode',
          'units/box': 'unitsPerBox', 'units per box': 'unitsPerBox', 'unidades por caja': 'unitsPerBox', 'unidades/caja': 'unitsPerBox',
          'threshold': 'threshold', 'stock minimo': 'threshold', 'min stock': 'threshold', 'minstock': 'threshold',
          'descripcion': 'descripcion', 'description': 'descripcion', 'imagen url': 'imagenUrl', 'image url': 'imagenUrl', 'imagenurl': 'imagenUrl', 'imageurl': 'imagenUrl',
          'activo': 'activo', 'active': 'activo',
          'module type': 'moduleType', 'module': 'moduleType', 'modulo': 'moduleType', 'tipo de modulo': 'moduleType',
          
          // Clients
          'vendedor': 'vendedorAsignado', 'salesman': 'vendedorAsignado', 'vendedor asignado': 'vendedorAsignado',
          'términos': 'terminosCredito', 'terms': 'terminosCredito', 'terminos de credito': 'terminosCredito',
          
          // Salesmen
          'apellido': 'apellido', 'last name': 'apellido', 'código': 'codigo', 'code': 'codigo',
          'tax id': 'taxId', 'taxid': 'taxId',
          
          // Taxes & Printers
          'porcentaje': 'porcentaje', 'percentage': 'porcentaje', 'percent': 'porcentaje', 'rate': 'porcentaje',
          'ip': 'ip', 'tipo': 'tipo', 'type': 'tipo', 'connection': 'ip'
        };

        // 1. Map and filter data
        const mappedBatch = data.map((item: any, index: number) => {
          if (!item || typeof item !== 'object') return null;

          let mappedItem: any = {};
          
          // Case-insensitive header mapping
          Object.keys(item).forEach(key => {
            const trimmedKey = key.trim();
            if (!trimmedKey) return;
            
            const normalizedKey = trimmedKey.toLowerCase();
            const mappedKey = headerMap[normalizedKey];
            if (mappedKey) {
              mappedItem[mappedKey] = item[key];
            } else {
              const fallbackKey = normalizedKey.replace(/\s+/g, '');
              if (fallbackKey) {
                mappedItem[fallbackKey] = item[key];
              }
            }
          });

          if (Object.keys(mappedItem).length === 0) return null;
          if (activeTab === 'Products' && !mappedItem.nombre && !mappedItem.upc && !mappedItem.sku) return null;
          if (activeTab === 'Clients' && !mappedItem.nombre && !mappedItem.email) return null;
          if (activeTab === 'Salesmen' && !mappedItem.nombre && !mappedItem.codigo) return null;

          if (activeTab === 'Products') {
            const enabled = getEnabledProductHeaders();
            const enabledKeys = new Set(enabled.map(h => h.key));
            
            const filteredItem: any = {};
            Object.keys(mappedItem).forEach(key => {
              if (enabledKeys.has(key) || key === 'id' || key === 'storeId') {
                filteredItem[key] = mappedItem[key];
              }
            });
            mappedItem = filteredItem;

            const formatBarcode = (val: any) => {
              if (val === undefined || val === null) return '';
              let s = String(val).trim();
              if (/^\d+\.?\d*e[+-]\d+$/i.test(s)) {
                try {
                  return BigInt(Math.round(Number(s))).toString();
                } catch (e) {
                  return Number(s).toFixed(0);
                }
              }
              return s;
            };

            mappedItem.upc = formatBarcode(mappedItem.upc);
            mappedItem.boxBarcode = formatBarcode(mappedItem.boxBarcode);
            
            mappedItem.precio = Number(String(mappedItem.precio || '0').replace(/[^0-9.-]/g, '')) || 0;
            mappedItem.costo = Number(String(mappedItem.costo || '0').replace(/[^0-9.-]/g, '')) || 0;
            mappedItem.stock = Number(String(mappedItem.stock || '0').replace(/[^0-9.-]/g, '')) || 0;
            mappedItem.threshold = Number(String(mappedItem.threshold || '0').replace(/[^0-9.-]/g, '')) || 0;
            mappedItem.descuento = Number(String(mappedItem.descuento || '0').replace(/[^0-9.-]/g, '')) || 0;
            mappedItem.unitsPerBox = Number(String(mappedItem.unitsPerBox || '1').replace(/[^0-9.-]/g, '')) || 1;
            
            if (!mappedItem.nombre) mappedItem.nombre = 'Imported Product';
            if (!mappedItem.upc) mappedItem.upc = `UPC-${Date.now()}-${index}`;
            if (!mappedItem.categoria) mappedItem.categoria = 'General';
            if (!mappedItem.imagenUrl) mappedItem.imagenUrl = 'https://picsum.photos/seed/product/200/200';
            
            if (importTargetModule) {
              mappedItem.moduleType = importTargetModule;
            } else if (mappedItem.moduleType) {
              const mt = String(mappedItem.moduleType).toLowerCase().trim();
              if (mt.includes('rest') || mt.includes('food')) mappedItem.moduleType = 'restaurant';
              else if (mt.includes('groce') || mt.includes('store') || mt.includes('groc')) mappedItem.moduleType = 'grocery';
              else mappedItem.moduleType = 'grocery';
            } else {
              mappedItem.moduleType = 'grocery';
            }
            
            // Try to match existing product by UPC or SKU to avoid duplicates
            // Only match if UPC/SKU is not a placeholder or too short
            const isValidForMatch = (val: string) => val && val.length > 3 && !val.startsWith('UPC-');

            if (!mappedItem.id) {
              const existing = currentData.find(p => 
                (isValidForMatch(mappedItem.upc) && p.upc === mappedItem.upc) || 
                (isValidForMatch(mappedItem.sku) && p.sku === mappedItem.sku)
              );
              if (existing) mappedItem.id = existing.id;
            }
          }

          if (activeTab === 'Clients') {
            if (!mappedItem.nombre) mappedItem.nombre = 'Imported Client';
            if (!mappedItem.terminosCredito) mappedItem.terminosCredito = 'CASH/TODAY';
            
            if (!mappedItem.id) {
              const existing = currentData.find(c => 
                (mappedItem.nombre && c.nombre === mappedItem.nombre) || 
                (mappedItem.email && c.email === mappedItem.email)
              );
              if (existing) mappedItem.id = existing.id;
            }
          }

          if (activeTab === 'Salesmen') {
            if (!mappedItem.nombre) mappedItem.nombre = 'Imported';
            if (!mappedItem.apellido) mappedItem.apellido = 'Salesman';
            mappedItem.activo = mappedItem.activo === 'true' || mappedItem.activo === true || mappedItem.activo === undefined;
            
            if (!mappedItem.id) {
              const existing = currentData.find(s => 
                (mappedItem.codigo && s.codigo === mappedItem.codigo) || 
                (mappedItem.email && s.email === mappedItem.email)
              );
              if (existing) mappedItem.id = existing.id;
            }
          }

          const finalId = (mappedItem.id && String(mappedItem.id).trim() !== '') 
            ? String(mappedItem.id) 
            : `${collectionName.slice(0, 3).toUpperCase()}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`;

          return { ...mappedItem, id: finalId, storeId: storeSettings.id };
        }).filter(Boolean);

        // 2. Deduplicate batch by ID (keep the last one in the file)
        const uniqueBatchMap = new Map();
        mappedBatch.forEach((item: any) => uniqueBatchMap.set(item.id, item));
        const batch = Array.from(uniqueBatchMap.values());

        console.log(`Starting import of ${batch.length} unique items to ${collectionName}`);
        if (batch.length === 0) {
          console.warn("No valid items found in the batch after mapping");
          showToast("No valid data found to import.", 'info');
          return;
        }

        showToast(`Importing ${batch.length} items...`, 'info');

        // Sync Categories
        if (activeTab === 'Products') {
          const newCategories = Array.from(new Set(batch.map((p: any) => p.categoria).filter(Boolean)));
          const existingCategoryNames = categories.map(c => c.nombre);
          const categoriesToAdd = newCategories.filter(cat => !existingCategoryNames.includes(cat));

          for (const catName of categoriesToAdd) {
            try {
              const firstMatchingProduct = batch.find((p: any) => p.categoria === catName);
              const newCat: Category = {
                id: `CAT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                storeId: storeSettings.id,
                nombre: String(catName),
                ...(businessCategory?.id === 'combo' && firstMatchingProduct?.moduleType ? { moduleType: firstMatchingProduct.moduleType as any } : {})
              };
              await setDoc(doc(db, 'categories', newCat.id), sanitizeForFirestore(newCat));
            } catch (e) {
              console.error("Error creating category during import:", e);
            }
          }
        }

        // Process items one by one
        for (const item of batch) {
          try {
            await setDoc(doc(db, collectionName, item.id), sanitizeForFirestore(item));
            successCount++;
            if (successCount % 10 === 0) {
              console.log(`Imported ${successCount}/${batch.length} items...`);
            }
          } catch (error: any) {
            console.error(`Error importing item ${item.id}:`, error);
            importErrors.push(`ID ${item.id}: ${error.message || String(error)}`);
          }
        }
        
        if (successCount > 0) {
          setter((prev: any) => {
            const prevMap = new Map(prev.map((p: any) => [p.id, p]));
            // Add or update items from batch
            batch.forEach((item: any) => {
              const existing = prevMap.get(item.id);
              prevMap.set(item.id, existing ? Object.assign({}, existing, item) : item);
            });
            return Array.from(prevMap.values());
          });
          showToast(`Successfully imported ${successCount} items!`, 'success');
        }

        if (importErrors.length > 0) {
          showToast(`${importErrors.length} items failed to import. Check console.`, 'error');
        }
      } catch (error) {
        console.error("Critical error during import process:", error);
        showToast("A critical error occurred during import.", 'error');
      }
    };

    if (isExcel) {
      console.log("Parsing Excel file...");
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = utils.sheet_to_json(worksheet);
          console.log("Excel parsed successfully, found", jsonData.length, "rows");
          await processData(jsonData);
        } catch (error) {
          console.error("Excel parse error:", error);
          showToast("Error parsing Excel file.", 'error');
        }
      };
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        showToast("Error reading file.", 'error');
      };
      reader.readAsArrayBuffer(file);
    } else {
      console.log("Parsing CSV file...");
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        dynamicTyping: false,
        transform: (value) => value.trim(),
        encoding: "UTF-8",
        error: (error: any) => {
          console.error("PapaParse error:", error);
          showToast(`Error parsing CSV: ${error.message || 'Unknown error'}`, 'error');
        },
        complete: async (results) => {
          console.log("CSV parsed successfully, found", results.data.length, "rows");
          await processData(results.data);
        }
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStoreSettingsChange = (field: keyof StoreSettings, value: any) => {
    const newSettings = { ...storeSettings, [field]: value };
    setDoc(doc(db, 'settings', storeSettings.id), sanitizeForFirestore(newSettings), { merge: true }).catch(error => {
      handleFirestoreError(error, OperationType.UPDATE, `settings/${storeSettings.id}`);
    });
    // Optimistic update
    setStoreSettings(newSettings);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      showToast("Logo file is too large. Please use a file under 500KB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleStoreSettingsChange('logoUrl', base64);
      showToast("Logo uploaded successfully", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateLogo = async () => {
    setIsGeneratingLogo(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Generate a high-quality, professional logo URL for a pharmacy named "${storeSettings.nombre}". 
      Since you cannot generate images directly, please provide a relevant high-quality placeholder image URL from a service like picsum.photos or similar that would fit a pharmacy/medical theme. 
      Return ONLY the URL string.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const generatedUrl = response.text?.trim();
      if (generatedUrl && generatedUrl.startsWith('http')) {
        handleStoreSettingsChange('logoUrl', generatedUrl);
        showToast("AI Logo generated successfully", "success");
      } else {
        const fallbackUrl = `https://picsum.photos/seed/${storeSettings.nombre.replace(/\s+/g, '')}/400/400`;
        handleStoreSettingsChange('logoUrl', fallbackUrl);
        showToast("AI suggested a theme, applied a relevant placeholder", "info");
      }
    } catch (error) {
      console.error("Error generating logo:", error);
      showToast("Failed to generate logo with AI", "error");
    } finally {
      setIsGeneratingLogo(false);
    }
  };

  const handleAddEmailContact = () => {
    if (!newEmailContact.nombre || !newEmailContact.email) {
      showToast("Please enter both name and email", "error");
      return;
    }
    const contacts = storeSettings.emailContacts || [];
    const newContact = { ...newEmailContact, id: `EC-${Date.now()}` };
    handleStoreSettingsChange('emailContacts', [...contacts, newContact]);
    setNewEmailContact({ nombre: '', email: '' });
    showToast("Email contact added", "success");
  };

  const handleRemoveEmailContact = (id: string) => {
    const contacts = storeSettings.emailContacts || [];
    handleStoreSettingsChange('emailContacts', contacts.filter(c => c.id !== id));
    showToast("Email contact removed", "info");
  };

  const handleSyncImages = () => {
    if (!storeSettings.googleDriveFolderId) {
      showToast("Por favor, configura el ID de la carpeta de Google Drive en Settings", "error");
      return;
    }

    setConfirmation({
      isOpen: true,
      title: "Sincronizar Imágenes",
      message: "¿Deseas sincronizar las imágenes de los productos con Google Drive? El sistema buscará archivos que coincidan con el nombre de cada producto.",
      confirmText: "Sincronizar",
      type: "info",
      onConfirm: async () => {
        const apiKey = storeSettings.googleApiKey?.trim();
        const folderId = storeSettings.googleDriveFolderId?.trim();
        
        if (!apiKey) {
          showToast("Se requiere una Google API Key en Settings para realizar la sincronización", "error");
          return;
        }

        showToast("Iniciando sincronización con Google Drive...", "info");

        try {
          // 1. Limpiar el ID de la carpeta (quitar espacios, puntos y extraer de URL si es necesario)
          let cleanFolderId = folderId.trim().replace(/\.$/, ""); // Quitar punto al final si existe
          
          // Intentar extraer el ID usando un patrón (letras, números, guiones, guiones bajos de al menos 25 caracteres)
          // Esto captura el ID incluso si hay parámetros como ?usp=sharing
          const idMatch = cleanFolderId.match(/[-\w]{25,}/);
          
          if (cleanFolderId.includes('drive.google.com')) {
            if (cleanFolderId.includes('/folders/')) {
              cleanFolderId = cleanFolderId.split('/folders/')[1].split('/')[0].split('?')[0];
            } else if (cleanFolderId.includes('?id=')) {
              cleanFolderId = cleanFolderId.split('?id=')[1].split('&')[0];
            } else if (cleanFolderId.includes('/home')) {
              throw new Error("Has pegado el enlace de tu página de inicio de Google Drive. Debes entrar en la carpeta específica de las fotos y copiar el ID de esa URL.");
            } else if (idMatch) {
              cleanFolderId = idMatch[0];
            } else {
              throw new Error("No se pudo extraer el ID de la carpeta de la URL proporcionada. Asegúrate de estar dentro de la carpeta correcta.");
            }
          } else if (idMatch) {
            // Si no es una URL pero contiene el ID (posiblemente con basura alrededor)
            cleanFolderId = idMatch[0];
          }
          
          // Validar que el ID tenga un formato básico (letras y números, usualmente 33 caracteres)
          if (cleanFolderId.length < 20 || cleanFolderId.includes('/') || cleanFolderId.includes(':')) {
            throw new Error("El ID de la carpeta parece ser inválido. Debe ser una cadena de caracteres como '1AbC2DeF3GhI4JkL...'");
          }

          // 2. Obtener lista de archivos de la carpeta de Drive
          const query = `'${cleanFolderId}' in parents and trashed = false`;
          const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&key=${apiKey}`;
          
          const response = await fetch(url);
          if (!response.ok) {
            const errorData = await response.json();
            const msg = errorData.error?.message || "Error desconocido";
            
            if (msg.toLowerCase().includes("api key not valid")) {
              throw new Error("La API Key de Google no es válida. Por favor, asegúrate de que: 1) La clave sea correcta. 2) La 'Google Drive API' esté habilitada en Google Cloud Console. 3) La clave no tenga restricciones de IP o Referrer que bloqueen la app.");
            }
            if (msg.toLowerCase().includes("file not found")) {
              throw new Error(`No se encontró la carpeta (ID: ${cleanFolderId}). Verifica que el ID sea correcto y que la carpeta esté compartida como 'Cualquier persona con el enlace'.`);
            }
            if (msg.toLowerCase().includes("access not configured")) {
              throw new Error("La Google Drive API no está habilitada en tu proyecto de Google Cloud.");
            }
            
            throw new Error(`Google Drive dice: ${msg}`);
          }

          const data = await response.json();
          const driveFiles = data.files || [];

          if (driveFiles.length === 0) {
            showToast("No se encontraron archivos en la carpeta de Google Drive", "info");
            return;
          }

          // 2. Función para normalizar nombres (quitar espacios, extensiones y pasar a minúsculas)
          const normalize = (str: string) => {
            if (!str) return "";
            return str.toLowerCase()
              .replace(/\.[^/.]+$/, "") // Quitar extensión (.jpg, .png, etc)
              .replace(/[\s\-_]+/g, "")  // Quitar espacios, guiones y guiones bajos
              .trim();
          };

          // 3. Mapear productos con archivos
          const batch = writeBatch(db);
          let updatedCount = 0;
          const updatedProducts = [...products];

          products.forEach((product, index) => {
            const normalizedProductName = normalize(product.nombre);
            if (!normalizedProductName) return;
            
            // Buscar coincidencia en Drive
            const matchingFile = driveFiles.find((file: any) => {
              const normalizedFileName = normalize(file.name);
              return normalizedFileName === normalizedProductName;
            });

            if (matchingFile) {
              // Generar URL de visualización directa de Google Drive
              // lh3.googleusercontent.com/d/ID es un truco para obtener la imagen directa
              const imageUrl = `https://lh3.googleusercontent.com/d/${matchingFile.id}`;
              
              // Actualizar en Firestore
              const productRef = doc(db, 'products', product.id);
              batch.update(productRef, { imagenUrl: imageUrl });
              
              // Actualizar en estado local
              updatedProducts[index] = { ...product, imagenUrl: imageUrl };
              updatedCount++;
            }
          });

          if (updatedCount > 0) {
            await batch.commit();
            setProducts(updatedProducts);
            showToast(`Sincronización completada: ${updatedCount} productos actualizados`, "success");
          } else {
            showToast("No se encontraron coincidencias entre los productos y los archivos de Drive. Verifica que los nombres sean iguales.", "info");
          }

        } catch (error: any) {
          console.error("Error en sincronización:", error);
          showToast(`Error: ${error.message}`, "error");
        }
      }
    });
  };

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    showToast(`Procesando ${files.length} imágenes...`, "info");
    const batch = writeBatch(db);
    let updatedCount = 0;
    const updatedProducts = [...products];

    const normalize = (str: string) => {
      if (!str) return "";
      return str.toLowerCase()
        .replace(/\.[^/.]+$/, "") 
        .replace(/[\s\-_]+/g, "")  
        .trim();
    };

    const resizeImage = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 400;
            const MAX_HEIGHT = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.7)); // compress
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    };

    const promises = Array.from(files).map(async (file: File) => {
      const normalizedFileName = normalize(file.name);
      const productIndex = updatedProducts.findIndex(p => normalize(p.nombre) === normalizedFileName || (p.codigo_barras && normalize(p.codigo_barras) === normalizedFileName));
      
      if (productIndex === -1) return null;

      const base64 = await resizeImage(file);
      return { index: productIndex, base64 };
    });

    try {
      const results = await Promise.all(promises);
      
      results.forEach(res => {
        if (!res) return;
        const { index, base64 } = res;
        updatedProducts[index] = { ...updatedProducts[index], imagenUrl: base64 };
        const productRef = doc(db, 'products', updatedProducts[index].id);
        batch.update(productRef, { imagenUrl: base64 });
        updatedCount++;
      });

      if (updatedCount > 0) {
        await batch.commit();
        setProducts(updatedProducts);
        showToast(`Importación completada: ${updatedCount} productos actualizados`, "success");
      } else {
        showToast("No se encontraron coincidencias. Nombra tus imágenes con el nombre del producto o su código de barras.", "info");
      }
    } catch(err: any) {
      console.error("Error in bulk image upload:", err);
      showToast(`Error al procesar imágenes: ${err.message}`, "error");
    } finally {
      // Clear the input so the same files can be selected again
      e.target.value = '';
    }
  };

  const seedInitialData = () => {
    setConfirmation({
      isOpen: true,
      title: "Seed Initial Data",
      message: "Are you sure you want to seed initial data? This will add initial products, clients, salesmen, categories, taxes, and vendors to your database.",
      confirmText: "Seed Data",
      type: "info",
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          
          // Seed Categories
          INITIAL_CATEGORIES.forEach(cat => {
            batch.set(doc(db, 'categories', cat.id), sanitizeForFirestore({ ...cat, storeId: storeSettings.id }));
          });
          
          // Seed Products
          INITIAL_PRODUCTS.forEach(prod => {
            batch.set(doc(db, 'products', prod.id), sanitizeForFirestore({ ...prod, storeId: storeSettings.id }));
          });
          
          // Seed Clients
          INITIAL_CLIENTS.forEach(client => {
            batch.set(doc(db, 'clients', client.id), sanitizeForFirestore({ ...client, storeId: storeSettings.id }));
          });
          
          // Seed Salesmen
          INITIAL_SALESMEN.forEach(salesman => {
            batch.set(doc(db, 'salesmen', salesman.id), sanitizeForFirestore({ ...salesman, storeId: storeSettings.id }));
          });
          
          // Seed Taxes
          INITIAL_TAXES.forEach(tax => {
            batch.set(doc(db, 'taxes', tax.id), sanitizeForFirestore({ ...tax, storeId: storeSettings.id }));
          });
          
          // Seed Vendors
          INITIAL_VENDORS.forEach(vendor => {
            batch.set(doc(db, 'vendors', vendor.id), sanitizeForFirestore({ ...vendor, storeId: storeSettings.id }));
          });

          // Seed Devices
          INITIAL_DEVICES.forEach(device => {
            batch.set(doc(db, 'devices', device.id), sanitizeForFirestore({ ...device, storeId: storeSettings.id }));
          });
          
          await batch.commit();
          
          // Update local state
          setCategories(INITIAL_CATEGORIES.map(cat => ({ ...cat, storeId: storeSettings.id })));
          setProducts(INITIAL_PRODUCTS.map(prod => ({ ...prod, storeId: storeSettings.id })));
          setClients(INITIAL_CLIENTS.map(client => ({ ...client, storeId: storeSettings.id })));
          setSalesmen(INITIAL_SALESMEN.map(salesman => ({ ...salesman, storeId: storeSettings.id })));
          setTaxes(INITIAL_TAXES.map(tax => ({ ...tax, storeId: storeSettings.id })));
          setVendors(INITIAL_VENDORS.map(vendor => ({ ...vendor, storeId: storeSettings.id })));
          setDevices(INITIAL_DEVICES.map(device => ({ ...device, storeId: storeSettings.id })));
          
          showToast('Initial data seeded successfully!', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'seed-initial-data');
        }
      }
    });
  };

  const ActionHeader = ({ title, onAdd, onExport, exportData, exportName, onClean, onDownloadTemplate, onSync, extraActions }: any) => (
    <div className="flex justify-between items-center mb-6 print:hidden">
      <h3 className="text-lg font-bold text-gray-800">{t(title)}</h3>
      <div className="flex gap-3">
        {extraActions}
        {onSync && (
          <button onClick={onSync} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-bold transition">
            <RefreshCw className="w-4 h-4" /> Sincronizar Fotos
          </button>
        )}
        {onClean && (
          <button onClick={onClean} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-bold transition">
            <Trash2 className="w-4 h-4" /> Clean All
          </button>
        )}
        {onDownloadTemplate && (
          <button onClick={onDownloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-bold transition">
            <FileText className="w-4 h-4" /> Template
          </button>
        )}
        {onExport && (
          <div className="flex gap-2">
            {(businessCategory?.id === 'combo' && (title === 'Products Catalog' || activeTab === 'Products')) ? (
              <div className="relative group/import">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-bold transition">
                  <Upload className="w-4 h-4" /> Import By Module
                </button>
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 opacity-0 invisible group-hover/import:opacity-100 group-hover/import:visible transition-all z-50">
                  <button 
                    onClick={() => handleImportClick('grocery')}
                    className="w-full px-4 py-2 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Grid className="w-4 h-4 text-blue-500" /> Import to Grocery
                  </button>
                  <button 
                    onClick={() => handleImportClick('restaurant')}
                    className="w-full px-4 py-2 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ChefHat className="w-4 h-4 text-orange-500" /> Import to Restaurant
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={handleImportClick as any} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-bold transition">
                <Upload className="w-4 h-4" /> Import (Excel/CSV)
              </button>
            )}
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-bold transition">
                <Download className="w-4 h-4" /> Export
              </button>
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button 
                  onClick={() => handleExportCSV(exportData, exportName)}
                  className="w-full px-4 py-2 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-blue-500" /> Export CSV
                </button>
                <button 
                  onClick={() => handleExportExcel(exportData, exportName)}
                  className="w-full px-4 py-2 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Package className="w-4 h-4 text-green-500" /> Export Excel
                </button>
              </div>
            </div>
          </div>
        )}
        {onAdd && (
          <button 
            onClick={typeof onAdd === 'function' ? onAdd : () => showToast(`Open create modal for ${title}`, 'info')} 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add New
          </button>
        )}
      </div>
    </div>
  );

  const renderTable = (headers: string[], data: any[], renderRow: (item: any, idx: number) => React.ReactNode, onRowClick?: (item: any) => void) => (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200 print:bg-transparent">
          <tr>
            {headers.map((h, i) => <th key={i} className="px-4 py-3 font-bold whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr 
              key={idx} 
              className={`border-b border-gray-100 hover:bg-gray-50 print:hover:bg-transparent ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick?.(item)}
            >
              {renderRow(item, idx)}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-6 py-8 text-center text-gray-500">No data available</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderDashboard = () => {
    const productSales: Record<string, { name: string, qty: number, revenue: number }> = {};
    const clientSales: Record<string, { name: string, total: number, orders: number }> = {};
    let totalRevenue = 0;
    let totalOrders = 0;

    orders.forEach(o => {
      if (o.estado !== 'Cancelado') {
        totalRevenue += o.total;
        totalOrders += 1;
        
        const clientName = clients.find(c => c.id === o.clienteId)?.nombre || 'Unknown Client';
        if (!clientSales[o.clienteId]) clientSales[o.clienteId] = { name: clientName, total: 0, orders: 0 };
        clientSales[o.clienteId].total += o.total;
        clientSales[o.clienteId].orders += 1;

        o.articulos?.forEach(item => {
          if (!productSales[item.id]) productSales[item.id] = { name: item.nombre, qty: 0, revenue: 0 };
          productSales[item.id].qty += item.cantidad;
          productSales[item.id].revenue += (item.precio * (1 - item.descuento/100)) * item.cantidad;
        });
      }
    });

    const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const topClients = Object.values(clientSales).sort((a, b) => b.total - a.total).slice(0, 5);

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">Sales & Performance Report</h3>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-bold transition print:hidden">
            <PrinterIcon className="w-4 h-4" /> Print Report
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-1">Total Revenue</p>
            <p className="text-3xl font-black text-gray-900">${Number(totalRevenue || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <p className="text-sm font-bold text-green-600 uppercase tracking-wider mb-1">Total Orders</p>
            <p className="text-3xl font-black text-gray-900">{totalOrders}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Top Products */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 print:bg-transparent print:border-gray-300">
            <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-500"/> Most Sold Products</h4>
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100 print:shadow-none print:border-b">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-gray-400">#{i+1}</span>
                    <span className="font-bold text-gray-800">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{p.qty} units</p>
                    <p className="text-xs text-gray-500">${Number(p.revenue || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && <p className="text-sm text-gray-500">No sales data yet.</p>}
            </div>
          </div>

          {/* Top Clients */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 print:bg-transparent print:border-gray-300">
            <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500"/> Best Clients Ranking</h4>
            <div className="space-y-3">
              {topClients.map((c, i) => (
                <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100 print:shadow-none print:border-b">
                  <div className="flex items-center gap-3">
                    <span className={`font-black ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'}`}>#{i+1}</span>
                    <span className="font-bold text-gray-800">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">${Number(c.total || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{c.orders} orders</p>
                  </div>
                </div>
              ))}
              {topClients.length === 0 && <p className="text-sm text-gray-500">No client data yet.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleDeleteOrder = () => {
    if (!selectedOrder) return;
    
    setConfirmation({
      isOpen: true,
      title: "Delete Order",
      message: "Are you sure you want to delete this order?",
      confirmText: "Delete",
      type: "danger",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'orders', selectedOrder.id));
          setSelectedOrder(null);
          showToast("Order deleted successfully", 'success');
        } catch (error) {
          console.error("Error deleting order:", error);
          showToast("Failed to delete order. Please try again.", 'error');
        }
      }
    });
  };

  const handleOrderStatusChange = (status: Order['estado']) => {
    if (selectedOrder) {
      setDoc(doc(db, 'orders', selectedOrder.id), { estado: status }, { merge: true }).catch(error => {
        console.error("Error updating order status:", error);
        showToast("Failed to update order status. It will sync when online.", 'error');
      });
      setSelectedOrder({ ...selectedOrder, estado: status });
    }
  };

  console.log("AdminDashboard - Salesmen:", salesmen);
  const renderContent = () => {
    switch (activeTab) {
      case 'Products': {
        const filteredProducts = products.filter(p => {
          const searchMatch = (p.nombre || '').toLowerCase().includes(productSearchQuery.toLowerCase()) ||
          (p.upc || '').toLowerCase().includes(productSearchQuery.toLowerCase()) ||
          (p.sku || '').toLowerCase().includes(productSearchQuery.toLowerCase()) ||
          (p.categoria || '').toLowerCase().includes(productSearchQuery.toLowerCase());
          
          if (businessCategory?.id === 'combo') {
            return searchMatch && (!p.moduleType || p.moduleType === productAdminComboView);
          }
          return searchMatch;
        });
        return (
          <>
            {businessCategory?.id === 'combo' && (
              <div className="flex justify-center mb-6 print:hidden">
                <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-full border border-slate-700 shadow-xl max-w-sm w-full mx-auto">
                  <button 
                    onClick={() => setProductAdminComboView('grocery')}
                    className={`flex-1 py-3 rounded-full text-sm font-black tracking-widest flex items-center justify-center gap-3 transition-colors ${productAdminComboView === 'grocery' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Grid className="w-5 h-5" /> GROCERY
                  </button>
                  <button 
                    onClick={() => setProductAdminComboView('restaurant')}
                    className={`flex-1 py-3 rounded-full text-sm font-black tracking-widest flex items-center justify-center gap-3 transition-colors ${productAdminComboView === 'restaurant' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <ChefHat className="w-5 h-5" /> REST.
                  </button>
                </div>
              </div>
            )}
            <ActionHeader 
              title={businessCategory?.id === 'combo' ? `Products Catalog - ${productAdminComboView.toUpperCase()}` : "Products Catalog"}
              extraActions={
                <>
                  <button 
                    onClick={() => setIsAddingPromo(true)} 
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm font-bold transition shadow-sm"
                  >
                    <Tag className="w-4 h-4" /> Generar Promo
                  </button>
                  <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 text-sm font-bold transition shadow-sm cursor-pointer">
                    <Upload className="w-4 h-4" /> Importar Imágenes (Bulk)
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleBulkImageUpload} />
                  </label>
                </>
              }
              onAdd={() => setIsAddingProduct(true)} 
              onExport 
              exportData={products} 
              exportName="Products" 
              onClean={() => handleCleanAll('products', setProducts, 'Products')}
              onDownloadTemplate={() => handleDownloadTemplate('Products')}
              onSync={handleSyncImages}
            />
            <div className="mb-6 flex gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search products by name, UPC, SKU or category..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                />
              </div>
              <button
                onClick={() => {
                  fetchGlobalCatalog();
                  setIsViewingGlobalCatalog(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition"
              >
                <Sparkles className="w-4 h-4" /> Global Catalog & Images
              </button>
              
              <div className="relative">
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;

                    showToast(`Procesando ${files.length} imágenes...`, 'info');
                    
                    let matchedCount = 0;
                    const promises = files.map((file: File) => {
                      return new Promise<void>((resolve) => {
                        const fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        const matchedProduct = products.find(p => 
                          (p.sku && p.sku.toLowerCase() === fileName.toLowerCase()) || 
                          (p.upc && p.upc.toLowerCase() === fileName.toLowerCase()) ||
                          (p.nombre.toLowerCase() === fileName.toLowerCase())
                        );

                        if (!matchedProduct) {
                          resolve();
                          return;
                        }

                        // Also verify size before converting 
                        if (file.size > 2 * 1024 * 1024) {
                           resolve();
                           return; // Skip images > 2MB
                        }

                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const img = new Image();
                          img.onload = async () => {
                            const MAX_WIDTH = 400;
                            const MAX_HEIGHT = 400;
                            let width = img.width;
                            let height = img.height;

                            if (width > height) {
                              if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                            } else {
                              if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                            }

                            const canvas = document.createElement('canvas');
                            canvas.width = width; canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                              ctx.drawImage(img, 0, 0, width, height);
                              const base64 = canvas.toDataURL('image/jpeg', 0.8);
                              try {
                                await setDoc(doc(db, 'products', matchedProduct.id), { imagenUrl: base64 }, { merge: true });
                                setProducts(prev => prev.map(p => p.id === matchedProduct.id ? { ...p, imagenUrl: base64 } : p));
                                matchedCount++;
                              } catch (err) {
                                console.error('Bulk image upload error:', err);
                              }
                            }
                            resolve();
                          };
                          img.onerror = () => resolve();
                          img.src = reader.result as string;
                        };
                        reader.onerror = () => resolve();
                        reader.readAsDataURL(file);
                      });
                    });

                    Promise.all(promises).then(() => {
                      showToast(`Se subieron ${matchedCount} imágenes exitosamente.`, 'success');
                      e.target.value = ''; // Reset
                    });
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Bulk Import Images (Match by Name, UPC, or SKU)"
                />
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition pointer-events-none">
                  <Package className="w-4 h-4" /> Bulk Import Images
                </div>
              </div>
            </div>
            {renderTable(
              [
                'Img',
                ...(!businessCategory || businessCategory.enabledFields.upc ? ['UPC'] : []),
                ...(!businessCategory || businessCategory.enabledFields.boxBarcode ? ['Box Barcode'] : []),
                ...(!businessCategory || businessCategory.enabledFields.unitsPerBox ? ['Units/Box'] : []),
                'Nombre',
                ...(!businessCategory || businessCategory.enabledFields.precio ? ['Precio'] : []),
                ...(!businessCategory || businessCategory.enabledFields.costo ? ['Costo'] : []),
                ...(!businessCategory || businessCategory.enabledFields.categoria ? ['Categoria'] : []),
                ...(!businessCategory || businessCategory.enabledFields.sku ? ['SKU'] : []),
                ...(!businessCategory || businessCategory.enabledFields.serialNumber ? ['Serial'] : []),
                ...(!businessCategory || businessCategory.enabledFields.lote ? ['Lote'] : []),
                ...(!businessCategory || businessCategory.enabledFields.vencimiento ? ['Vencimiento'] : []),
                ...(!businessCategory || businessCategory.enabledFields.stock ? ['Stock', 'Threshold'] : []),
                ...(!businessCategory || businessCategory.enabledFields.componenteActivo ? ['Comp. Activo'] : []),
                ...(!businessCategory || businessCategory.enabledFields.laboratorio ? ['Laboratorio'] : []),
                ...(!businessCategory || businessCategory.enabledFields.unidad ? ['Unidad'] : []),
                ...(!businessCategory || businessCategory.enabledFields.descuento ? ['Desc %'] : []),
                'POS',
                'Actions'
              ],
              filteredProducts,
              (p: Product) => (
                <>
                  <td className="px-2 py-1">
                    <div className="relative group w-10 h-10">
                      <div 
                        className="w-full h-full bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform" 
                        onClick={() => setEditingProduct(p)}
                        title="Edit Product"
                      >
                        <img src={p.imagenUrl || 'https://picsum.photos/seed/product/50/50'} alt={p.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <label 
                        className="absolute -bottom-2 -right-2 bg-indigo-600 rounded-full p-1.5 text-white cursor-pointer shadow-lg hover:bg-indigo-700 transition z-10 hover:scale-110 border-2 border-white"
                        title="Upload Single Image"
                      >
                        <Upload className="w-3 h-3" />
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                alert("Image must be smaller than 2MB");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                const img = new Image();
                                img.onload = () => {
                                  const MAX_WIDTH = 400; const MAX_HEIGHT = 400;
                                  let width = img.width; let height = img.height;
                                  if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                                  else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                                  const canvas = document.createElement('canvas');
                                  canvas.width = width; canvas.height = height;
                                  const ctx = canvas.getContext('2d');
                                  if (ctx) {
                                    ctx.drawImage(img, 0, 0, width, height);
                                    const base64 = canvas.toDataURL('image/jpeg', 0.8);
                                    handleProductChange(p.id, 'imagenUrl', base64);
                                  }
                                };
                                img.src = reader.result as string;
                              };
                              reader.readAsDataURL(file);
                            }
                          }} 
                        />
                      </label>
                    </div>
                  </td>
                  {(!businessCategory || businessCategory.enabledFields.upc) && (
                    <td className="px-2 py-1"><EditableCell value={p.upc} onChange={(v:any) => handleProductChange(p.id, 'upc', v)} className="font-mono text-xs w-24" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.boxBarcode) && (
                    <td className="px-2 py-1"><EditableCell value={p.boxBarcode || ''} onChange={(v:any) => handleProductChange(p.id, 'boxBarcode', v)} className="font-mono text-xs w-32" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.unitsPerBox) && (
                    <td className="px-2 py-1"><EditableCell type="number" value={p.unitsPerBox || 1} onChange={(v:any) => handleProductChange(p.id, 'unitsPerBox', v)} className="w-16" /></td>
                  )}
                  <td className="px-2 py-1 flex items-center gap-2">
                    {businessCategory?.id === 'combo' && p.moduleType && (
                      <span className="shrink-0 p-1 bg-slate-100 rounded-md text-slate-500" title={p.moduleType === 'restaurant' ? 'Restaurant' : 'Grocery'}>
                        {p.moduleType === 'restaurant' ? <ChefHat className="w-3 h-3" /> : <Grid className="w-3 h-3" />}
                      </span>
                    )}
                    <EditableCell value={p.nombre} onChange={(v:any) => handleProductChange(p.id, 'nombre', v)} className="font-bold min-w-[150px]" />
                  </td>
                  {(!businessCategory || businessCategory.enabledFields.precio) && (
                    <td className="px-2 py-1">
                      <EditableCell type="number" value={p.precio} step="0.01" onChange={(v:any) => handleProductChange(p.id, 'precio', v)} className="w-20" />
                      {p.promo && (
                        <div className="flex items-center gap-2 mt-1 whitespace-nowrap">
                          <span className="px-2 py-0.5 border border-red-200 text-red-600 bg-red-50 text-[8px] font-black uppercase rounded-full tracking-widest">
                            {p.promo.type === 'combo' ? 'Combo Promo' : 'Promo Qty'}
                          </span>
                          <div className="flex gap-1 text-[8px] border border-gray-200 rounded p-0.5 bg-gray-50 uppercase font-bold text-gray-600">
                            {p.promo.type === 'quantity' && <span className="px-1 border-r border-gray-200">QTY <span className="text-gray-900">{p.promo.quantity}</span></span>}
                            <span className="px-1">PRECIO <span className="text-gray-900">${p.promo.price}</span></span>
                          </div>
                        </div>
                      )}
                    </td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.costo) && (
                    <td className="px-2 py-1"><EditableCell type="number" value={p.costo} step="0.01" onChange={(v:any) => handleProductChange(p.id, 'costo', v)} className="w-20" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.categoria) && (
                    <td className="px-2 py-1"><EditableCell value={p.categoria} onChange={(v:any) => handleProductChange(p.id, 'categoria', v)} className="w-24" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.sku) && (
                    <td className="px-2 py-1"><EditableCell value={p.sku} onChange={(v:any) => handleProductChange(p.id, 'sku', v)} className="text-xs w-20" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.serialNumber) && (
                    <td className="px-2 py-1"><EditableCell value={p.serialNumber} onChange={(v:any) => handleProductChange(p.id, 'serialNumber', v)} className="text-xs w-20" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.lote) && (
                    <td className="px-2 py-1"><EditableCell value={p.lote} onChange={(v:any) => handleProductChange(p.id, 'lote', v)} className="text-xs w-20" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.vencimiento) && (
                    <td className="px-2 py-1"><EditableCell type="date" value={p.vencimiento} onChange={(v:any) => handleProductChange(p.id, 'vencimiento', v)} className="w-32" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.stock) && (
                    <>
                      <td className="px-2 py-1">
                        <div className="flex flex-col">
                          <EditableCell 
                            type="number" 
                            value={p.stock} 
                            onChange={(v:any) => handleProductChange(p.id, 'stock', v)} 
                            className={`font-bold w-20 ${p.stock < (p.threshold || 0) ? 'text-red-600' : 'text-green-600'}`} 
                          />
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">{formatStock(p.stock, p.unitsPerBox)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1"><EditableCell type="number" value={p.threshold || 0} onChange={(v:any) => handleProductChange(p.id, 'threshold', v)} className="w-20" /></td>
                    </>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.componenteActivo) && (
                    <td className="px-2 py-1"><EditableCell value={p.componenteActivo} onChange={(v:any) => handleProductChange(p.id, 'componenteActivo', v)} className="w-32" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.laboratorio) && (
                    <td className="px-2 py-1"><EditableCell value={p.laboratorio} onChange={(v:any) => handleProductChange(p.id, 'laboratorio', v)} className="w-24" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.unidad) && (
                    <td className="px-2 py-1"><EditableCell value={p.unidad} onChange={(v:any) => handleProductChange(p.id, 'unidad', v)} className="w-20" /></td>
                  )}
                  {(!businessCategory || businessCategory.enabledFields.descuento) && (
                    <td className="px-2 py-1"><EditableCell type="number" value={p.descuento} onChange={(v:any) => handleProductChange(p.id, 'descuento', v)} className="w-16" /></td>
                  )}
                  <td className="px-2 py-1">
                    <button
                      onClick={() => handleProductChange(p.id, 'showInPOS', p.showInPOS === false ? true : false)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        p.showInPOS !== false ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          p.showInPOS !== false ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {isSuperAdmin && (
                        <button 
                          onClick={async () => {
                            if (!window.confirm(`Promote ${p.nombre} to Global Catalog?`)) return;
                            try {
                              await addDoc(collection(db, 'system', 'catalog', 'products'), {
                                nombre: p.nombre,
                                precio: p.precio,
                                categoria: p.categoria || 'Global',
                                imagen: p.imagenUrl || `https://picsum.photos/seed/${p.nombre}/400/400`,
                                createdAt: Date.now()
                              });
                              showToast('Product promoted to global catalog!', 'success');
                            } catch (error) {
                              console.error("Error promoting product:", error);
                              showToast('Failed to promote product.', 'error');
                            }
                          }}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Promote to Global Catalog"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </>
              )
            )}
          </>
        );
      }
      case 'Clients': {
        const filteredClients = clients.filter(c => 
          (c.nombre || '').toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          (c.email || '').toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          (c.telefono || '').toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          (c.ciudad || '').toLowerCase().includes(clientSearchQuery.toLowerCase())
        );
        return (
          <>
            <ActionHeader 
              title="Clients Directory" 
              onAdd={() => setIsCreatingClient(true)} 
              onExport 
              exportData={clients} 
              exportName="Clients" 
              onClean={() => handleCleanAll('clients', setClients, 'Clients')} 
              onDownloadTemplate={() => handleDownloadTemplate('Clients')}
            />
            <div className="mb-6 relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search clients by name, email, phone or city..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>
            {renderTable(
              ['Nombre', 'Telefono', 'Direccion', 'Ciudad', 'Estado', 'CP', 'Email', 'Vendedor', 'Términos', 'Acciones'],
              filteredClients,
              (c: Client) => (
                <>
                  <td className="px-2 py-1"><EditableCell value={c.nombre} onChange={(v:any) => handleClientChange(c.id, 'nombre', v)} className="font-bold min-w-[150px]" /></td>
                  <td className="px-2 py-1"><EditableCell value={c.telefono} onChange={(v:any) => handleClientChange(c.id, 'telefono', v)} className="w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={c.direccion} onChange={(v:any) => handleClientChange(c.id, 'direccion', v)} className="min-w-[150px]" /></td>
                  <td className="px-2 py-1"><EditableCell value={c.ciudad} onChange={(v:any) => handleClientChange(c.id, 'ciudad', v)} className="w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={c.estado} onChange={(v:any) => handleClientChange(c.id, 'estado', v)} className="w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={c.cp} onChange={(v:any) => handleClientChange(c.id, 'cp', v)} className="w-20" /></td>
                  <td className="px-2 py-1"><EditableCell value={c.email} onChange={(v:any) => handleClientChange(c.id, 'email', v)} className="w-40" /></td>
                  <td className="px-2 py-1">
                    <select 
                      value={c.vendedorAsignado} 
                      onChange={(e) => handleClientChange(c.id, 'vendedorAsignado', e.target.value)}
                      className="w-full p-1 border rounded text-xs"
                    >
                      <option value="">Select Salesman</option>
                      {salesmen.filter(s => s.id !== 'admin' || isSuperAdmin).map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} {s.apellido}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1"><EditableCell value={c.terminosCredito} onChange={(v:any) => handleClientChange(c.id, 'terminosCredito', v)} className="font-bold text-blue-600 w-24" /></td>
                  <td className="px-2 py-1">
                    <button 
                      onClick={() => handleDeleteClient(c.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Client"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </>
              )
            )}
          </>
        );
      }
      case 'Salesmen': {
        const filteredSalesmen = salesmen.filter(s => 
          (s.id !== 'admin' || isSuperAdmin) && (
            (s.nombre || '').toLowerCase().includes(salesmanSearchQuery.toLowerCase()) ||
            (s.apellido || '').toLowerCase().includes(salesmanSearchQuery.toLowerCase()) ||
            (s.codigo || '').toLowerCase().includes(salesmanSearchQuery.toLowerCase()) ||
            (s.email || '').toLowerCase().includes(salesmanSearchQuery.toLowerCase())
          )
        );
        const salesmenLabel = storeSettings.salesmenLabel || 'Usuarios';
        return (
          <>
            <ActionHeader 
              title={`${salesmenLabel} Team`} 
              onAdd={() => setIsCreatingSalesman(true)} 
              onExport 
              exportData={salesmen} 
              exportName={salesmenLabel} 
              onClean={() => handleCleanAll('salesmen', setSalesmen, salesmenLabel)} 
              onDownloadTemplate={() => handleDownloadTemplate('Salesmen')}
            />
            <div className="mb-6 relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={`Search ${salesmenLabel.toLowerCase()} by name, code or email...`}
                value={salesmanSearchQuery}
                onChange={(e) => setSalesmanSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>
            {renderTable(
              ['Nombre', 'Apellido', 'Codigo', 'Email', 'Telefono', 'Direccion', 'Ciudad', 'Estado', 'CP', 'TaxID', 'PIN', 'Activo', 'Acciones'],
              filteredSalesmen,
              (s: Salesman) => (
                <>
                  <td className="px-2 py-1"><EditableCell value={s.nombre} onChange={(v:any) => handleSalesmanChange(s.id, 'nombre', v)} className="font-bold w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.apellido} onChange={(v:any) => handleSalesmanChange(s.id, 'apellido', v)} className="font-bold w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.codigo} onChange={(v:any) => handleSalesmanChange(s.id, 'codigo', v)} className="font-mono w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.email} onChange={(v:any) => handleSalesmanChange(s.id, 'email', v)} className="w-40" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.telefono} onChange={(v:any) => handleSalesmanChange(s.id, 'telefono', v)} className="w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.direccion} onChange={(v:any) => handleSalesmanChange(s.id, 'direccion', v)} className="min-w-[150px]" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.ciudad} onChange={(v:any) => handleSalesmanChange(s.id, 'ciudad', v)} className="w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.estado} onChange={(v:any) => handleSalesmanChange(s.id, 'estado', v)} className="w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.cp} onChange={(v:any) => handleSalesmanChange(s.id, 'cp', v)} className="w-20" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.taxId} onChange={(v:any) => handleSalesmanChange(s.id, 'taxId', v)} className="w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={s.pin || ''} onChange={(v:any) => handleSalesmanChange(s.id, 'pin', v)} className="font-mono w-16" /></td>
                  <td className="px-2 py-1 text-center">
                    <EditableCheckbox 
                      checked={s.activo} 
                      onChange={(v:boolean) => {
                        if (s.id === 'admin' && !v) {
                          showToast('Cannot deactivate the Admin user', 'error');
                          return;
                        }
                        handleSalesmanChange(s.id, 'activo', v);
                      }} 
                    />
                  </td>
                  <td className="px-2 py-1">
                    {s.id !== 'admin' && (
                      <button 
                        onClick={() => handleDeleteSalesman(s.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Salesman"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </>
              )
            )}
          </>
        );
      }
      case 'Suppliers': {
        const filteredSuppliers = vendors.filter(v => 
          (v.nombre || '').toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
          (v.contacto || '').toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
          (v.email || '').toLowerCase().includes(supplierSearchQuery.toLowerCase())
        );
        return (
          <>
            <ActionHeader 
              title="Suppliers Directory" 
              onAdd={() => setIsAddingSupplier(true)} 
              onExport 
              exportData={vendors} 
              exportName="Suppliers" 
              onClean={() => handleCleanAll('vendors', setVendors, 'Suppliers')}
              onDownloadTemplate={() => handleDownloadTemplate('Suppliers')}
            />
            <div className="mb-6 relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search suppliers by name, contact or email..."
                value={supplierSearchQuery}
                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>
            {renderTable(
              ['Nombre', 'Contacto', 'Telefono', 'Email', 'Direccion', 'Terminos', 'Acciones'],
              filteredSuppliers,
              (v: Vendor) => (
                <>
                  <td className="px-2 py-1"><EditableCell value={v.nombre} onChange={(val:any) => handleVendorChange(v.id, 'nombre', val)} className="font-bold min-w-[150px]" /></td>
                  <td className="px-2 py-1"><EditableCell value={v.contacto} onChange={(val:any) => handleVendorChange(v.id, 'contacto', val)} className="w-32" /></td>
                  <td className="px-2 py-1"><EditableCell value={v.telefono} onChange={(val:any) => handleVendorChange(v.id, 'telefono', val)} className="w-24" /></td>
                  <td className="px-2 py-1"><EditableCell value={v.email} onChange={(val:any) => handleVendorChange(v.id, 'email', val)} className="w-40" /></td>
                  <td className="px-2 py-1"><EditableCell value={v.direccion} onChange={(val:any) => handleVendorChange(v.id, 'direccion', val)} className="min-w-[150px]" /></td>
                  <td className="px-2 py-1"><EditableCell value={v.terminos} onChange={(val:any) => handleVendorChange(v.id, 'terminos', val)} className="font-bold text-blue-600 w-24" /></td>
                  <td className="px-2 py-1">
                    <button 
                      onClick={() => handleDeleteVendor(v.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Vendor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </>
              )
            )}
          </>
        );
      }
      case 'Purchase Orders':
        return (
          <>
            <div className="flex justify-between items-center mb-6 print:hidden">
              <h3 className="text-xl font-bold text-gray-800">Purchase Orders</h3>
              <button onClick={() => setIsCreatingPO(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold">
                <Plus className="w-4 h-4" /> Create PO
              </button>
            </div>
            {renderTable(
              ['ID / Invoice details', 'Supplier', 'Status', 'Date', 'Items', 'Total', 'Actions'],
              purchaseOrders,
              (po: PurchaseOrder) => (
                <>
                  <td className="px-6 py-3 text-xs leading-relaxed">
                    <span className="font-mono text-gray-500">{po.id}</span>
                    {po.invoiceNumber && <div className="font-bold text-gray-800">Inv: {po.invoiceNumber}</div>}
                    {po.checkNumber && <div className="text-gray-400">Chk: {po.checkNumber}</div>}
                  </td>
                  <td className="px-6 py-3 font-bold">{vendors.find(v => v.id === po.vendorId)?.nombre || 'Unknown'}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      po.estado === 'Recibido' ? 'bg-green-100 text-green-700' :
                      po.estado === 'Enviado' ? 'bg-blue-100 text-blue-700' :
                      po.estado === 'Cancelado' ? 'bg-red-100 text-red-700' :
                      po.estado === 'Printed' ? 'bg-purple-100 text-purple-700' :
                      po.estado === 'Mailed' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {po.estado}
                    </span>
                  </td>
                  <td className="px-6 py-3">{new Date(po.fechaCreacion).toLocaleDateString()}</td>
                  <td className="px-6 py-3">{po.articulos.length} items</td>
                  <td className="px-6 py-3 font-bold">${Number(po.total || 0).toFixed(2)}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <button 
                        title="View"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        onClick={() => setSelectedPO(po)}
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button 
                        title="Print"
                        className={`p-1.5 rounded transition ${po.estado === 'Printed' ? 'text-green-600 bg-green-50' : 'text-gray-600 hover:bg-gray-100'}`}
                        onClick={() => {
                          flushSync(() => {
                            setSelectedPO(po);
                            handlePOStatusUpdate(po, 'Printed');
                          });
                          window.print();
                        }}
                      >
                        <PrinterIcon className="w-4 h-4" />
                      </button>
                      <button 
                        title="Email"
                        className={`p-1.5 rounded transition ${po.estado === 'Mailed' ? 'text-green-600 bg-green-50' : 'text-gray-600 hover:bg-gray-100'}`}
                        onClick={() => {
                          const vendor = vendors.find(v => v.id === po.vendorId);
                          if (!vendor?.email) {
                            showToast('El proveedor no tiene un email.', 'error');
                            return;
                          }
                          const subject = `Purchase Order ${po.id}`;
                          const body = `Hello ${vendor.nombre},\n\nBelow are the details for the purchase order:\n\n${po.articulos.map(i => `${i.cantidad || 1}x ${i.nombre || 'Item'} - $${((i.costo || 0) * (i.cantidad || 1)).toFixed(2)}`).join('\n')}\n\nTotal: $${po.total.toFixed(2)}\n\nThank you!`;
                          
                          let mailtoUrl = `mailto:${vendor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                          if (storeSettings.emailContacts && storeSettings.emailContacts.length > 0) {
                            const bccEmails = storeSettings.emailContacts.map(c => c.email).join(',');
                            mailtoUrl += `&bcc=${encodeURIComponent(bccEmails)}`;
                          }
                          
                          window.location.href = mailtoUrl;
                          handlePOStatusUpdate(po, 'Mailed');
                          showToast('Abriendo cliente de correo...', 'success');
                        }}
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button 
                        title="Mark as Sent"
                        className={`p-1.5 rounded transition ${po.estado === 'Enviado' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'}`}
                        onClick={() => handlePOStatusUpdate(po, 'Enviado')}
                      >
                        <Truck className="w-4 h-4" />
                      </button>
                      <button 
                        title="Receive Inventory"
                        className={`p-1.5 rounded transition ${po.estado === 'Recibido' ? 'text-green-600 bg-green-50' : 'text-gray-600 hover:bg-gray-100'}`}
                        onClick={() => {
                          if (po.estado !== 'Recibido') {
                            setConfirmation({
                              isOpen: true,
                              title: "Receive Inventory",
                              message: "Are you sure you want to receive this inventory? This will update stock levels.",
                              confirmText: "Receive",
                              type: "success",
                              onConfirm: () => handleReceivePO(po)
                            });
                          }
                        }}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button 
                        title="Delete Purchase Order"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePurchaseOrder(po.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </>
              )
            )}
          </>
        );
      case 'Orders': {
        const filteredOrders = orders.filter(o => {
          const client = clients.find(c => c.id === o.clienteId);
          const clientName = client ? client.nombre : '';
          const matchesGeneral = (o.factura || '').toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
                                 (o.proveedor || '').toLowerCase().includes(orderSearchQuery.toLowerCase());
          const matchesCustomer = clientName.toLowerCase().includes(orderCustomerSearchQuery.toLowerCase());
          return matchesGeneral && matchesCustomer;
        });
        return (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h3 className="text-xl font-bold text-gray-800">Orders</h3>
              <div className="flex flex-1 max-w-2xl gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Search by Invoice or Supplier..." 
                    value={orderSearchQuery}
                    onChange={e => setOrderSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                </div>
                <div className="relative flex-1">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Search by Customer..." 
                    value={orderCustomerSearchQuery}
                    onChange={e => setOrderCustomerSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                </div>
                <button 
                  onClick={() => handleCleanAll('orders', setOrders, 'Orders')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-bold whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4" /> Clean All
                </button>
              </div>
            </div>
            {renderTable(
              ['Proveedor', 'Vendedor', 'Fecha', 'Factura', 'Artículos', 'Total', 'Estado', 'Pago', 'Acciones'],
              filteredOrders,
              (o: Order) => {
                const salesman = salesmen.find(s => s.id === o.vendedorId);
                return (
                  <>
                    <td className="px-6 py-3">{o.proveedor}</td>
                    <td className="px-6 py-3">{salesman ? `${salesman.nombre} ${salesman.apellido}` : 'N/A'}</td>
                    <td className="px-6 py-3">{new Date(o.fecha).toLocaleDateString()}</td>
                    <td className="px-6 py-3 font-mono">{o.factura}</td>
                    <td className="px-6 py-3">{o.articulos?.length || 0} items</td>
                    <td className="px-6 py-3 font-bold">${Number(o.total || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          o.estado === 'Pagado' ? 'bg-green-100 text-green-700' :
                          o.estado === 'Pendiente' ? 'bg-amber-100 text-amber-700' :
                          o.estado === 'Enviado' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {o.estado}
                        </span>
                        {o.estado !== 'Pagado' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDoc(doc(db, 'orders', o.id), { estado: 'Pagado' }, { merge: true });
                            }}
                            className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200 transition"
                            title="Mark as Paid"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {o.metodoPago && (
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          o.metodoPago === 'Cash' ? 'bg-green-100 text-green-700' :
                          o.metodoPago === 'Credit' ? 'bg-amber-100 text-amber-700' :
                          o.metodoPago === 'Check' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {o.metodoPago}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(o);
                          }}
                          className="text-blue-600 hover:underline font-bold"
                        >
                          View
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrderById(o.id);
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                          title="Delete Order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </>
                );
              },
              (o) => setSelectedOrder(o)
            )}
          </>
        );
      }
      case 'Inventory':
        const filteredInventory = inventory.filter(i => {
          const matchesSearch = (i.proveedor || '').toLowerCase().includes(inventorySearchQuery.toLowerCase()) ||
                               (i.factura || '').toLowerCase().includes(inventorySearchQuery.toLowerCase());
          const matchesDate = !inventoryDateFilter || new Date(i.fecha).toISOString().split('T')[0] === inventoryDateFilter;
          return matchesSearch && matchesDate;
        });
        return (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h3 className="text-xl font-bold text-gray-800">Inventory Records</h3>
              <div className="flex flex-1 max-w-2xl gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Search by Supplier or Invoice..." 
                    value={inventorySearchQuery}
                    onChange={e => setInventorySearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                </div>
                <input 
                  type="date" 
                  value={inventoryDateFilter}
                  onChange={e => setInventoryDateFilter(e.target.value)}
                  className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                />
                <button 
                  onClick={() => handleCleanAll('inventory', setInventory, 'Inventory')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-bold whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4" /> Clean All
                </button>
                <button 
                  onClick={() => setIsReceivingInventory(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> Receive Inventory
                </button>
              </div>
            </div>
            {renderTable(
              ['ID', 'Proveedor', 'Fecha', 'Factura', 'Artículos', 'Total', 'Estado', 'Acciones'],
              filteredInventory,
              (i: Inventory) => (
                <>
                  <td className="px-6 py-3 font-mono text-xs">{i.id}</td>
                  <td className="px-6 py-3">{i.proveedor}</td>
                  <td className="px-6 py-3">{new Date(i.fecha).toLocaleDateString()}</td>
                  <td className="px-6 py-3 font-mono">{i.factura}</td>
                  <td className="px-6 py-3">{i.articulos} items</td>
                  <td className="px-6 py-3 font-bold">${Number(i.total || 0).toFixed(2)}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">{i.estado}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInventory(i);
                        }}
                        className="text-blue-600 hover:underline font-bold"
                      >
                        View Details
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteInventory(i.id);
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                        title="Delete Inventory Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </>
              ),
              (i) => setSelectedInventory(i)
            )}
          </>
        );
      case 'Modifiers Library': {
        const filteredGroups = globalModifierGroups.filter(g => 
          g.nombre.toLowerCase().includes(modifierSearchQuery.toLowerCase())
        );
        return (
          <>
            <ActionHeader 
              title="Modifiers Library" 
              onAdd={() => setIsCreatingGlobalModifier(true)} 
              onExport 
              exportData={globalModifierGroups} 
              exportName="Modifiers_Library" 
              onClean={() => handleCleanAll('modifiers', setGlobalModifierGroups, 'Modifiers Library')}
              onDownloadTemplate={handleDownloadModifierTemplate}
            />
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search modifier groups..."
                  value={modifierSearchQuery}
                  onChange={(e) => setModifierSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                />
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition cursor-pointer">
                  <Upload className="w-4 h-4" />
                  IMPORT EXCEL
                  <input type="file" accept=".xlsx,.xls" onChange={handleImportGlobalModifiersExcel} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map(group => (
                <div key={group.id} className="bg-white p-6 rounded-[2rem] border-2 border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-black text-gray-900 uppercase tracking-tight">{group.nombre}</h3>
                      <div className="flex gap-2 mt-1">
                        {group.required && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-black uppercase rounded-full">Required</span>}
                        {group.allowMultiple && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded-full">Multiple</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleDeleteGlobalModifier(group.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {group.modifiers.map((mod, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-xl text-xs group/item">
                        <span className="font-bold text-gray-700">{mod.nombre}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-blue-600 font-black">$</span>
                          <EditableCell 
                            type="number" 
                            step="0.01" 
                            value={mod.precio} 
                            onChange={async (newPrice: number) => {
                              const updatedModifiers = group.modifiers.map((m, i) => i === idx ? { ...m, precio: newPrice } : m);
                              try {
                                await setDoc(doc(db, 'modifiers', group.id), { modifiers: updatedModifiers }, { merge: true });
                                toast.success('Price updated');
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, `modifiers/${group.id}`);
                              }
                            }}
                            className="w-16 text-right font-black text-blue-600 bg-white/50 rounded px-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      }
      case 'Categories':
        return (
          <>
            <ActionHeader title="Categories" onAdd={() => setIsCreatingCategory(true)} onClean={() => handleCleanAll('categories', setCategories, 'Categories')} />
            {renderTable(
              ['ID', 'Nombre', 'Taxes', 'Fondo', 'Borde', 'Quick Access', ...(businessCategory?.id === 'combo' ? ['Module Type'] : [])],
              categories,
              (c: Category) => (
                <>
                  <td className="px-6 py-3 font-mono text-xs">{c.id}</td>
                  <td className="px-6 py-3 font-bold">
                    <EditableCell 
                      value={c.nombre} 
                      onChange={async (v: string) => {
                        try {
                          await setDoc(doc(db, 'categories', c.id), { nombre: v }, { merge: true });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.UPDATE, `categories/${c.id}`);
                        }
                      }} 
                    />
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {taxes.map(tax => {
                        const isSelected = c.taxIds?.includes(tax.id);
                        return (
                          <button
                            key={tax.id}
                            onClick={async () => {
                              const newTaxIds = isSelected 
                                ? (c.taxIds || []).filter(id => id !== tax.id)
                                : [...(c.taxIds || []), tax.id];
                              try {
                                await setDoc(doc(db, 'categories', c.id), { taxIds: newTaxIds }, { merge: true });
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, `categories/${c.id}`);
                              }
                            }}
                            className={`px-2 py-1 text-[10px] font-bold rounded-full transition-colors ${
                              isSelected ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
                            }`}
                          >
                            {tax.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <input 
                      type="color"
                      value={c.color || '#ffffff'}
                      onChange={async (e) => {
                        try {
                          await setDoc(doc(db, 'categories', c.id), { color: e.target.value }, { merge: true });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.UPDATE, `categories/${c.id}`);
                        }
                      }}
                      className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <input 
                      type="color"
                      value={c.borderColor || '#f1f5f9'}
                      onChange={async (e) => {
                        try {
                          await setDoc(doc(db, 'categories', c.id), { borderColor: e.target.value }, { merge: true });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.UPDATE, `categories/${c.id}`);
                        }
                      }}
                      className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={async () => {
                        try {
                          await setDoc(doc(db, 'categories', c.id), { quickAccess: !c.quickAccess }, { merge: true });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.UPDATE, `categories/${c.id}`);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${c.quickAccess ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${c.quickAccess ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  {businessCategory?.id === 'combo' && (
                    <td className="px-6 py-3">
                      <select
                        value={c.moduleType || 'grocery'}
                        onChange={async (e) => {
                          try {
                            await setDoc(doc(db, 'categories', c.id), { moduleType: e.target.value }, { merge: true });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.UPDATE, `categories/${c.id}`);
                          }
                        }}
                        className="p-1 border rounded text-xs font-bold bg-slate-50"
                      >
                        <option value="grocery">Grocery</option>
                        <option value="restaurant">Restaurant</option>
                      </select>
                    </td>
                  )}
                </>
              )
            )}
          </>
        );
      case 'Reports': {
        const filteredOrders = orders.filter(order => {
          const orderDate = new Date(order.fecha).toISOString().split('T')[0];
          const inDateRange = orderDate >= reportStartDate && orderDate <= reportEndDate;
          return inDateRange;
        });

        const reportData = filteredOrders.flatMap(order => 
          order.articulos.map(item => {
            const product = products.find(p => p.id === (item.productId || item.id));
            const client = clients.find(c => c.id === order.clienteId);
            return {
              ...item,
              orderDate: new Date(order.fecha).toISOString().split('T')[0],
              category: product?.categoria || item.categoria || 'Uncategorized',
              productName: product?.nombre || item.nombre || 'Unknown Product',
              clientName: client?.nombre || 'Anonymous',
              clientId: order.clienteId
            };
          })
        ).filter(item => {
          const matchesCategory = reportCategory === 'all' || item.category === reportCategory;
          const matchesProduct = !reportProduct || 
                                 (item.productName || '').toLowerCase().includes(reportProduct.toLowerCase()) ||
                                 (item.productId || item.id || '').toLowerCase().includes(reportProduct.toLowerCase());
          const matchesClient = reportClient === 'all' || item.clientId === reportClient;
          return matchesCategory && matchesProduct && matchesClient;
        });

        const totalSales = reportData.reduce((sum, item) => sum + ((item.precio || 0) * (item.cantidad || 1)), 0);
        const totalItems = reportData.reduce((sum, item) => sum + (item.cantidad || 1), 0);

        const filteredInventory = inventory.filter(inv => {
          const invDate = new Date(inv.fecha).toISOString().split('T')[0];
          return invDate >= reportStartDate && invDate <= reportEndDate;
        });
        const totalExpenses = filteredInventory.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const netProfit = totalSales - totalExpenses;

        return (
          <div className="space-y-6 print:py-0 print:px-0">
            {/* Header only shown on Print */}
            <div className="hidden print:block border-b-2 border-gray-300 pb-4 mb-6">
              <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{storeSettings.nombre || 'CANTINA'}</h1>
              <p className="text-sm font-bold text-gray-600">{t('Detailed Sales Report', 'Reporte Detallado de Ventas')}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t('Date Range', 'Rango de Fechas')}: {reportStartDate} {t('to', 'al')} {reportEndDate}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:grid-cols-3 print:gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-blue-100 flex flex-col justify-center print:border-gray-200">
                <p className="text-sm font-black text-blue-500 tracking-widest uppercase mb-1">{t('Total Revenue', 'Ingresos Totales')}</p>
                <p className="text-4xl font-black text-gray-900">${totalSales.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-red-100 flex flex-col justify-center print:border-gray-200">
                <p className="text-sm font-black text-red-500 tracking-widest uppercase mb-1">{t('Total Expenses', 'Gastos Totales')}</p>
                <p className="text-4xl font-black text-gray-900">${totalExpenses.toFixed(2)}</p>
              </div>
              <div className={`bg-white p-6 rounded-3xl shadow-sm border-2 flex flex-col justify-center print:border-gray-200 ${netProfit >= 0 ? 'border-green-100' : 'border-red-100'}`}>
                <p className={`text-sm font-black tracking-widest uppercase mb-1 ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{t('Net Profit (P&L)', 'Utilidad Neta')}</p>
                <p className={`text-4xl font-black ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${netProfit.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6 print:hidden">
              <h2 className="text-3xl font-black text-gray-800 tracking-tight">{t('Sales Report', 'Reporte de Ventas')}</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (filteredOrders.length === 0) {
                      setActiveToast({ message: 'No orders to delete in this range', type: 'info' });
                      return;
                    }
                    setConfirmation({
                      isOpen: true,
                      title: 'Delete Filtered Reports?',
                      message: `Are you sure you want to delete ${filteredOrders.length} orders from ${reportStartDate} to ${reportEndDate}? This action cannot be undone.`,
                      onConfirm: async () => {
                        try {
                          const batch = writeBatch(db);
                          filteredOrders.forEach(order => {
                            batch.delete(doc(db, 'orders', order.id));
                          });
                          await batch.commit();
                          setConfirmation(prev => ({ ...prev, isOpen: false }));
                          setActiveToast({ message: 'Reports deleted successfully', type: 'success' });
                        } catch (error) {
                          console.error("Error deleting reports:", error);
                          setActiveToast({ message: 'Failed to delete reports', type: 'error' });
                        }
                      },
                      confirmText: 'Delete All',
                      type: 'danger'
                    });
                  }} 
                  className="p-2 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-all shadow-sm group"
                  title="Delete Filtered Orders"
                >
                  <Trash2 className="w-5 h-5 text-red-500 group-hover:text-red-600" />
                </button>
                <button onClick={() => window.print()} className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
                  <PrinterIcon className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 print:hidden">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">{t('Start Date', 'Fecha Inicio')}</label>
                <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">{t('End Date', 'Fecha Fin')}</label>
                <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">{t('Client', 'Cliente')}</label>
                <select value={reportClient} onChange={e => setReportClient(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                  <option value="all">{t('All Clients', 'Todos los Clientes')}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">{t('Category', 'Categoría')}</label>
                <select value={reportCategory} onChange={e => setReportCategory(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                  <option value="all">{t('All Categories', 'Todas las Categorías')}</option>
                  {categories.map(cat => <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">{t('Item', 'Artículo')}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder={t('Search product...', 'Buscar producto...')} 
                    value={reportProduct} 
                    onChange={e => setReportProduct(e.target.value)} 
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
              <div className="bg-blue-600 p-8 rounded-2xl shadow-lg shadow-blue-200 text-white">
                <p className="text-blue-100 font-bold uppercase tracking-widest text-sm mb-2">{t('Total Sales Revenue', 'Ingresos Totales por Ventas')}</p>
                <h3 className="text-4xl font-black">${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="bg-emerald-600 p-8 rounded-2xl shadow-lg shadow-emerald-200 text-white">
                <p className="text-emerald-100 font-bold uppercase tracking-widest text-sm mb-2">{t('Total Items Sold', 'Total Artículos Vendidos')}</p>
                <h3 className="text-4xl font-black">{totalItems.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 print:bg-transparent print:border-b-2">
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">{t('Date', 'Fecha')}</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">{t('Client', 'Cliente')}</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">{t('Product', 'Producto')}</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">{t('Category', 'Categoría')}</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">{t('Qty', 'Cant')}</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">{t('Price', 'Precio')}</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">{t('Total', 'Total')}</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider text-center print:hidden">{t('Actions', 'Acciones')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reportData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent print:border-b">
                      <td className="p-4 text-sm font-bold text-gray-600">{item.orderDate}</td>
                      <td className="p-4 text-sm font-bold text-blue-600 print:text-gray-900">{item.clientName}</td>
                      <td className="p-4 text-sm font-black text-gray-800">{item.productName}</td>
                      <td className="p-4 text-sm font-bold text-gray-600">{item.category}</td>
                      <td className="p-4 text-sm font-bold text-gray-800 text-right">{item.cantidad}</td>
                      <td className="p-4 text-sm font-bold text-gray-600 text-right">${Number(item.precio || 0).toFixed(2)}</td>
                      <td className="p-4 text-sm font-black text-gray-900 text-right">${Number((item.precio || 0) * (item.cantidad || 0)).toFixed(2)}</td>
                      <td className="p-4 text-center print:hidden">
                        <button 
                          onClick={() => {
                            const order = orders.find(o => 
                              new Date(o.fecha).toISOString().split('T')[0] === item.orderDate &&
                              o.articulos.some(art => art.productId === item.productId && art.cantidad === item.cantidad)
                            );
                            if (order) {
                              handleDeleteOrderById(order.id);
                            } else {
                              showToast("Could not find associated order", "error");
                            }
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                          title="Delete Associated Order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-gray-400 font-bold italic">
                        {t('No data found for the selected filters', 'No se encontraron datos para los filtros seleccionados')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
      case 'Devices': {
        const handleScanNetwork = async () => {
          setIsScanningDevices(true);
          showToast("Scanning network for devices...", "info");
          
          // Simulate network scan
          setTimeout(() => {
            const discoveredDevices: Device[] = [
              { id: `DEV-WIFI-${Date.now()}`, nombre: 'Discovered Printer (WIFI)', tipo: 'Printer', conexion: 'WIFI', direccion: '192.168.1.150', activo: true, storeId: storeSettings.id },
              { id: `DEV-IP-${Date.now()}`, nombre: 'Network Scale (IP)', tipo: 'Scale', conexion: 'IP', direccion: '192.168.1.200', activo: true, storeId: storeSettings.id }
            ];
            
            discoveredDevices.forEach(async (d) => {
              await setDoc(doc(db, 'devices', d.id), sanitizeForFirestore(d));
            });
            
            setIsScanningDevices(false);
            showToast("Network scan complete. 2 devices found.", "success");
          }, 3000);
        };

        return (
          <>
            <ActionHeader 
              title="Printers & Devices" 
              onAdd={() => setIsCreatingDevice(true)} 
              onClean={() => handleCleanAll('devices', setDevices, 'Devices')}
            />
            
            <div className="mb-6 flex gap-4 items-center">
              <button
                onClick={handleScanNetwork}
                disabled={isScanningDevices}
                className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 ${isScanningDevices ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isScanningDevices ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isScanningDevices ? 'Scanning Network...' : 'Auto-Discover Network Devices (WIFI/IP)'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map((device) => (
                <div key={device.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative group">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${
                      device.tipo === 'Printer' ? 'bg-blue-50 text-blue-600' :
                      device.tipo === 'Scale' ? 'bg-green-50 text-green-600' :
                      device.tipo === 'CreditCard' ? 'bg-yellow-50 text-yellow-600' :
                      'bg-purple-50 text-purple-600'
                    }`}>
                      {device.tipo === 'Printer' ? <PrinterIcon className="w-6 h-6" /> : 
                       device.tipo === 'Scale' ? <TrendingUp className="w-6 h-6" /> : 
                       device.tipo === 'CreditCard' ? <CreditCard className="w-6 h-6" /> :
                       <Tag className="w-6 h-6" />}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setEditingDevice(device)}
                        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setConfirmation({
                            isOpen: true,
                            title: "Delete Device",
                            message: `Are you sure you want to delete ${device.nombre}?`,
                            confirmText: "Delete",
                            type: "danger",
                            onConfirm: async () => {
                              await deleteDoc(doc(db, 'devices', device.id));
                            }
                          });
                        }}
                        className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <h4 className="font-black text-gray-900 mb-1">{device.nombre}</h4>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      {device.tipo}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      device.conexion === 'USB' ? 'bg-blue-100 text-blue-700' :
                      device.conexion === 'Bluetooth' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {device.conexion}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {device.modelo && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-bold">Model:</span>
                        <span className="font-bold text-gray-700">{device.modelo}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-bold">Address/ID:</span>
                      <span className="font-mono text-gray-700">{device.direccion}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-bold">Status:</span>
                      <span className={`font-bold ${device.activo ? 'text-green-600' : 'text-red-600'}`}>
                        {device.activo ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      const updatedDevice = { ...device, activo: !device.activo };
                      setDoc(doc(db, 'devices', device.id), sanitizeForFirestore(updatedDevice), { merge: true });
                      showToast(`${device.nombre} ${updatedDevice.activo ? 'enabled' : 'disabled'}`, 'info');
                    }}
                    className={`w-full mt-6 py-2 rounded-xl font-bold text-xs transition-all ${
                      device.activo ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
                    }`}
                  >
                    {device.activo ? 'Disable Device' : 'Enable Device'}
                  </button>
                </div>
              ))}
              {devices.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PrinterIcon className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">No devices configured</h3>
                  <p className="text-gray-500 text-sm mb-6">Add your printers, scales, and scanners to get started.</p>
                  <button 
                    onClick={() => setIsCreatingDevice(true)}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                  >
                    Add Your First Device
                  </button>
                </div>
              )}
            </div>
          </>
        );
      }
      case 'Settings':
        return (
          <div className="space-y-8">
            {/* Store Information Settings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Store Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Store ID (Multi-tenant)</label>
                  <input 
                    type="text" 
                    value={storeSettings.id || ''} 
                    onChange={e => handleStoreSettingsChange('id', e.target.value)} 
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50" 
                    placeholder="e.g. STORE-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">License Key</label>
                  <input 
                    type="text" 
                    value={storeSettings.licenseKey || ''} 
                    onChange={e => handleStoreSettingsChange('licenseKey', e.target.value)} 
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50" 
                    placeholder="License key provided by Super Admin"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Store Name</label>
                  <input 
                    type="text" 
                    value={storeSettings.nombre || ''} 
                    onChange={e => handleStoreSettingsChange('nombre', e.target.value)} 
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Address</label>
                  <input 
                    type="text" 
                    value={storeSettings.direccion || ''} 
                    onChange={e => handleStoreSettingsChange('direccion', e.target.value)} 
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={storeSettings.email || ''} 
                    onChange={e => handleStoreSettingsChange('email', e.target.value)} 
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Phone</label>
                  <input 
                    type="text" 
                    value={storeSettings.telefono || ''} 
                    onChange={e => handleStoreSettingsChange('telefono', e.target.value)} 
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Logo URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={storeSettings.logoUrl || ''} 
                      onChange={e => handleStoreSettingsChange('logoUrl', e.target.value)} 
                      placeholder="https://example.com/logo.png"
                      className="flex-1 p-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                    <input 
                      type="file" 
                      ref={logoInputRef} 
                      onChange={handleLogoUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button 
                      onClick={() => logoInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> Upload
                    </button>
                    <button 
                      onClick={handleGenerateLogo}
                      disabled={isGeneratingLogo}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Sparkles className={`w-4 h-4 ${isGeneratingLogo ? 'animate-spin' : ''}`} /> 
                      {isGeneratingLogo ? 'Generating...' : 'AI Generator'}
                    </button>
                  </div>
                  {storeSettings.logoUrl && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 inline-block">
                      <img src={storeSettings.logoUrl} alt="Store Logo" className="h-20 object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl md:col-span-2">
                  <div className="flex-1">
                    <p className="text-sm font-black text-amber-800">Training Mode</p>
                    <p className="text-xs text-amber-600 font-bold">When active, transactions will NOT be saved to the database.</p>
                  </div>
                  <button
                    onClick={() => handleStoreSettingsChange('trainingMode', !storeSettings.trainingMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      storeSettings.trainingMode ? 'bg-amber-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        storeSettings.trainingMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 md:col-span-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-indigo-800">System Language</h4>
                      <p className="text-xs text-indigo-600 font-bold">Choose the default display language.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleStoreSettingsChange('language', 'es')}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                        (!storeSettings.language || storeSettings.language === 'es')
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-black text-sm">Español</span>
                        <span className="text-[10px] opacity-80">(Default)</span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleStoreSettingsChange('language', 'en')}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                        storeSettings.language === 'en'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-black text-sm">English</span>
                        <span className="text-[10px] opacity-80">(US)</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 md:col-span-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <PrinterIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-blue-800">Print Format</h4>
                      <p className="text-xs text-blue-600 font-bold">Choose how orders are printed by default.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleStoreSettingsChange('printFormat', 'invoice')}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                        (storeSettings.printFormat || 'invoice') === 'invoice'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-black text-sm">INVOICE (A4/Letter)</span>
                        <span className="text-[10px] opacity-80">Best for Wholesalers</span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleStoreSettingsChange('printFormat', 'ticket')}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                        storeSettings.printFormat === 'ticket'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-black text-sm">TICKET (80mm)</span>
                        <span className="text-[10px] opacity-80">Best for Retailers</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Hide Product Images Toggle */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div>
                      <h4 className="font-bold text-gray-900">{t('Hide Product Images', 'Ocultar Imágenes de Productos')}</h4>
                      <p className="text-xs text-gray-500 mt-1">{t('Do not show photos in the catalog for a more compact view', 'No mostrar fotos en el catálogo para una vista más compacta')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={storeSettings.hideProductImages || false}
                        onChange={(e) => handleStoreSettingsChange('hideProductImages', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Tips Settings */}
                {['restaurant', 'combo'].includes(businessCategory?.id || '') && (
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-4">
                      <div>
                        <h4 className="font-bold text-gray-900">Habilitar Propinas (Tips)</h4>
                        <p className="text-xs text-gray-500 mt-1">Permitir a los clientes dejar propina al pagar</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={storeSettings.enableTips || false}
                          onChange={(e) => handleStoreSettingsChange('enableTips', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    
                    {storeSettings.enableTips && (
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Porcentajes de Propina Sugeridos (separados por coma)</label>
                        <input 
                          type="text" 
                          placeholder="Ej: 10, 15, 20"
                          value={storeSettings.tipPercentages?.join(', ') || '10, 15, 20'}
                          onChange={(e) => {
                            const values = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                            handleStoreSettingsChange('tipPercentages', values);
                          }}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Kiosk Settings */}
                {['restaurant', 'combo'].includes(businessCategory?.id || '') && (
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                        <LayoutGrid className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-orange-800">{t('Kiosk Payments', 'Pagos en Kiosko')}</h4>
                        <p className="text-xs text-orange-600 font-bold">{t('Configure which payment methods are available to customers.', 'Configura qué métodos de pago están disponibles para los clientes.')}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                          <h4 className="font-bold text-gray-900">{t('Enable Cash', 'Habilitar Efectivo')}</h4>
                          <p className="text-xs text-gray-500 mt-1">{t('Allow payment at counter', 'Permitir pago en mostrador')}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={storeSettings.kioskCashEnabled !== false}
                            onChange={(e) => handleStoreSettingsChange('kioskCashEnabled', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                          <h4 className="font-bold text-gray-900">{t('Enable Card', 'Habilitar Tarjeta')}</h4>
                          <p className="text-xs text-gray-500 mt-1">{t('Allow payment with credit/debit', 'Permitir pago con crédito/débito')}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={storeSettings.kioskCardEnabled !== false}
                            onChange={(e) => handleStoreSettingsChange('kioskCardEnabled', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Kiosk Media Section - Redesigned */}
                    <div className="mt-8 bg-pink-50/30 p-8 rounded-[2rem] border border-pink-100">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-pink-600 shadow-sm border border-pink-100">
                          <Hand className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-pink-900 uppercase tracking-tight">Imágenes y Videos del Kiosko</h4>
                          <p className="text-sm text-pink-600 font-bold">Sube imágenes o enlaza videos MP4 para la pantalla de inicio.</p>
                        </div>
                      </div>

                      <div className="flex gap-4 mb-8">
                        <input 
                          type="file"
                          id="kiosk-media-upload"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const url = event.target?.result as string;
                                const currentMedia = storeSettings.kioskMedia || [];
                                handleStoreSettingsChange('kioskMedia', [...currentMedia, { url, type: 'image', duration: 5 }]);
                              };
                              reader.readAsDataURL(file);
                            }
                            // Reset input
                            e.target.value = '';
                          }}
                        />
                        <button 
                          onClick={() => document.getElementById('kiosk-media-upload')?.click()}
                          className="flex items-center gap-2 bg-pink-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-pink-700 transition-all shadow-lg shadow-pink-200"
                        >
                          <Upload className="w-5 h-5" />
                          Subir Imagen
                        </button>
                        <button 
                          onClick={() => {
                            const currentMedia = storeSettings.kioskMedia || [];
                            handleStoreSettingsChange('kioskMedia', [...currentMedia, { url: '', type: 'video', duration: 10 }]);
                          }}
                          className="flex items-center gap-2 bg-white text-pink-600 border-2 border-pink-100 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-pink-50 transition-all"
                        >
                          <Plus className="w-5 h-5" />
                          Añadir URL de Video
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {(storeSettings.kioskMedia || []).map((media, idx) => (
                          <div key={idx} className="bg-white rounded-[2rem] border border-pink-100 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                            <div className="relative h-48 bg-gray-100">
                              {media.type === 'video' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-purple-50 text-purple-600 p-4">
                                  <CreditCard className="w-12 h-12 mb-2" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Video URL</span>
                                  <input 
                                    type="text"
                                    value={media.url}
                                    placeholder="URL del Video (.mp4)"
                                    className="w-full mt-2 bg-white/50 border-none rounded-lg px-2 py-1 text-[10px] font-bold text-center outline-none"
                                    onChange={(e) => {
                                      const newMedia = [...(storeSettings.kioskMedia || [])];
                                      newMedia[idx].url = e.target.value;
                                      handleStoreSettingsChange('kioskMedia', newMedia);
                                    }}
                                  />
                                </div>
                              ) : (
                                <>
                                  {media.url ? (
                                    <img src={media.url} className="w-full h-full object-cover" alt="Preview" />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 relative group/upload">
                                      <button 
                                        onClick={() => document.getElementById(`kiosk-media-upload-${idx}`)?.click()}
                                        className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 hover:bg-pink-50 transition-colors z-10"
                                      >
                                        <Upload className="w-12 h-12 mb-2 text-gray-400 group-hover/upload:text-pink-500 transition-colors" />
                                        <span className="text-[10px] font-black uppercase text-gray-400 group-hover/upload:text-pink-500">Toca para subir</span>
                                      </button>
                                      <input 
                                        type="file"
                                        id={`kiosk-media-upload-${idx}`}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                              const url = event.target?.result as string;
                                              const newMedia = [...(storeSettings.kioskMedia || [])];
                                              newMedia[idx].url = url;
                                              handleStoreSettingsChange('kioskMedia', newMedia);
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                          e.target.value = '';
                                        }}
                                      />
                                      <div className="absolute bottom-2 left-0 right-0 z-20 px-4">
                                        <input 
                                          type="text"
                                          value={media.url}
                                          placeholder="O pega URL de Imagen"
                                          className="w-full bg-white/80 border-none rounded-lg px-2 py-1 text-[10px] font-bold text-center outline-none shadow-sm focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all cursor-text"
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            const newMedia = [...(storeSettings.kioskMedia || [])];
                                            newMedia[idx].url = e.target.value;
                                            handleStoreSettingsChange('kioskMedia', newMedia);
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                              
                              <button 
                                onClick={() => {
                                  const newMedia = (storeSettings.kioskMedia || []).filter((_, i) => i !== idx);
                                  handleStoreSettingsChange('kioskMedia', newMedia);
                                }}
                                className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-xl shadow-sm hover:bg-red-600 transition-all focus:ring-2 focus:ring-red-400 z-30"
                                title="Eliminar medio"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="p-4 flex items-center justify-between bg-white border-t border-pink-50">
                              <span className="text-[10px] font-black text-pink-900 uppercase tracking-widest">Duración (Seg)</span>
                              <input 
                                type="number"
                                value={media.duration || 5}
                                className="w-16 bg-pink-50/50 border border-pink-100 rounded-xl px-3 py-1 text-right text-xs font-black text-pink-600 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
                                onChange={(e) => {
                                  const newMedia = [...(storeSettings.kioskMedia || [])];
                                  newMedia[idx].duration = parseInt(e.target.value) || 5;
                                  handleStoreSettingsChange('kioskMedia', newMedia);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                        {(storeSettings.kioskMedia || []).length === 0 && (
                          <div className="col-span-full p-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-pink-100">
                            <p className="text-pink-300 font-black uppercase text-xs tracking-[0.2em]">Sube tu primera imagen o video para comenzar</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Google Drive Integration Settings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Google Drive Integration</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4 font-bold">Configure your Google Drive folder to automatically sync product images based on their names.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Google Drive Folder ID</label>
                  <input 
                    type="text" 
                    value={storeSettings.googleDriveFolderId || ''} 
                    onChange={e => handleStoreSettingsChange('googleDriveFolderId', e.target.value)} 
                    placeholder="e.g. 1AbC2DeF3GhI4JkL..."
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                  <p className="text-[10px] text-gray-400 mt-1 italic">
                    Entra en la carpeta de Drive y copia el ID de la URL. 
                    Ej: drive.google.com/drive/folders/<b>1AbC2DeF...</b>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Google API Key (Required for Sync)</label>
                  <input 
                    type="password" 
                    value={storeSettings.googleApiKey || ''} 
                    onChange={e => handleStoreSettingsChange('googleApiKey', e.target.value)} 
                    placeholder="Enter your API Key"
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                  <p className="text-[10px] text-gray-400 mt-1 italic">
                    Necesaria para listar archivos de Drive. Consíguela en <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google Cloud Console</a>. 
                    Asegúrate de habilitar la <b>Google Drive API</b>.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Labels Settings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Tag className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Custom Labels</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4 font-bold">Customize the names of sections in your dashboard.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Salesmen / Users Label</label>
                  <input 
                    type="text" 
                    value={storeSettings.salesmenLabel || ''} 
                    onChange={e => handleStoreSettingsChange('salesmenLabel', e.target.value)} 
                    placeholder="e.g. Usuarios, Vendedores, Team"
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                  <p className="text-[10px] text-gray-400 mt-1 italic">
                    Change how "Salesmen" is displayed throughout the dashboard. Default is "Usuarios".
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Credit Surcharge (%)</label>
                  <input 
                    type="number" 
                    value={storeSettings.creditSurcharge || 0} 
                    onChange={e => handleStoreSettingsChange('creditSurcharge', parseFloat(e.target.value) || 0)} 
                    placeholder="e.g. 4"
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                  <p className="text-[10px] text-gray-400 mt-1 italic">
                    Percentage added to the total when paying with Credit Card. Default is 4%.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Enable "Cash Discount" Message</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={storeSettings.enableCashDiscount !== false}
                      onChange={(e) => handleStoreSettingsChange('enableCashDiscount', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <p className="text-[10px] text-gray-400 mt-1 italic">
                    Toggle to display "You saved X by paying cash" on invoices. Checked by default.
                  </p>
                </div>
              </div>
            </div>

            {/* Notification Emails Settings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Notification Emails (Distribution List)</h3>
              
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <label className="block text-sm font-black text-blue-900 mb-1">Sender Email (Correo de Salida)</label>
                <p className="text-xs text-blue-700 mb-3 font-medium">This is the email address from which the system will send emails (e.g., invoices, notifications) to clients and staff.</p>
                <input 
                  type="email" 
                  value={storeSettings.senderEmail || ''} 
                  onChange={e => handleStoreSettingsChange('senderEmail', e.target.value)} 
                  className="w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
                  placeholder="noreply@yourcompany.com"
                />
              </div>

              <h4 className="text-sm font-bold text-gray-800 mb-2">Distribution List</h4>
              <p className="text-xs text-gray-500 mb-4 font-bold">Configure the email addresses for different departments (e.g., Office, Warehouse, Clients) to receive notifications and invoices.</p>
              
              <div className="flex items-end gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Case / Department</label>
                  <input 
                    type="text" 
                    value={newEmailContact.nombre} 
                    onChange={e => setNewEmailContact(prev => ({ ...prev, nombre: e.target.value }))} 
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="e.g. Warehouse, Office, Billing"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    value={newEmailContact.email} 
                    onChange={e => setNewEmailContact(prev => ({ ...prev, email: e.target.value }))} 
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="email@example.com"
                  />
                </div>
                <button 
                  onClick={handleAddEmailContact}
                  className="h-[42px] px-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  title="Add Email"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add</span>
                </button>
              </div>

              <div className="space-y-2">
                {(storeSettings.emailContacts || []).map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900">{contact.nombre}</p>
                        <p className="text-xs font-bold text-gray-500">{contact.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveEmailContact(contact.id)}
                      className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(storeSettings.emailContacts || []).length === 0 && (
                  <p className="text-center py-4 text-gray-400 text-sm font-bold italic">No notification emails added yet.</p>
                )}
              </div>
            </div>

            <div>
              <ActionHeader title="Taxes" onAdd={() => setIsCreatingTax(true)} />
              {renderTable(
                ['ID', 'Nombre', 'Porcentaje', 'Acciones'],
                taxes,
                (t: Tax) => (
                  <>
                    <td className="px-6 py-3 font-mono text-xs">{t.id}</td>
                    <td className="px-6 py-3 font-bold">{t.nombre}</td>
                    <td className="px-6 py-3">{t.porcentaje}%</td>
                    <td 
                      className="px-6 py-3 text-red-600 cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTax(t.id);
                      }}
                    >
                      Delete
                    </td>
                  </>
                )
              )}
            </div>

            {/* Seed Data Section */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
              <h3 className="text-lg font-bold text-blue-800 mb-2">Initial Setup</h3>
              <p className="text-blue-600 text-sm mb-4">If this is your first time using the app, you can seed initial data to get started quickly with sample products, clients, and more.</p>
              <button 
                onClick={seedInitialData}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200"
              >
                Seed Initial Data
              </button>
            </div>

            {/* Danger Zone */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100">
              <h3 className="text-lg font-bold text-red-800 mb-4">Danger Zone</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">Clear All Sales Data</p>
                  <p className="text-xs text-gray-500">This will permanently delete all orders and reports.</p>
                </div>
                <button 
                  onClick={() => {
                    setConfirmation({
                      isOpen: true,
                      title: 'Clear All Sales Data?',
                      message: 'Are you sure you want to delete ALL orders? This action is permanent and cannot be undone.',
                      onConfirm: async () => {
                        try {
                          const q = query(collection(db, 'orders'), where('storeId', '==', storeSettings.id));
                          const querySnapshot = await getDocs(q);
                          
                          // Firestore batch limit is 500
                          const batches = [];
                          let currentBatch = writeBatch(db);
                          let operationCount = 0;

                          querySnapshot.forEach(doc => {
                            currentBatch.delete(doc.ref);
                            operationCount++;
                            if (operationCount === 450) {
                              batches.push(currentBatch);
                              currentBatch = writeBatch(db);
                              operationCount = 0;
                            }
                          });
                          
                          if (operationCount > 0) {
                            batches.push(currentBatch);
                          }

                          await Promise.all(batches.map(batch => batch.commit()));
                          
                          setConfirmation(prev => ({ ...prev, isOpen: false }));
                          setActiveToast({ message: 'All sales data cleared', type: 'success' });
                        } catch (error) {
                          console.error("Error clearing sales data:", error);
                          setActiveToast({ message: 'Failed to clear sales data', type: 'error' });
                        }
                      },
                      confirmText: 'Clear Everything',
                      type: 'danger'
                    });
                  }}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition-colors"
                >
                  Clear All Data
                </button>
              </div>
            </div>
          </div>
        );
      case 'Dashboard':
        return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-gray-900 print:min-h-0 print:h-auto print:bg-white print:block">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-50 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <span className="font-black tracking-tighter text-lg uppercase">Admin</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-xl"
        >
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Hidden file input for CSV import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
        className="hidden" 
      />
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-0 z-40 bg-white border-r transition-transform duration-300 md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        w-72 flex flex-col h-screen print:hidden
      `}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="text-white w-5 h-5" />
            </div>
            <span className="font-black tracking-tighter text-lg uppercase">Admin</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 border-b border-gray-100 space-y-2">
          <button 
            onClick={onBack}
            title={!isSidebarOpen ? "Go to Sale Page (POS)" : undefined}
            className={`w-full flex items-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-black hover:bg-blue-700 transition shadow-lg shadow-blue-100 ${!isSidebarOpen ? 'justify-center px-0' : 'justify-center'}`}
          >
            <ArrowLeft className="w-4 h-4 flex-shrink-0" /> 
            {isSidebarOpen && <span className="truncate">Sale Page (POS)</span>}
          </button>

          {isSuperAdmin && onBackToSuperAdmin && (
            <button 
              onClick={onBackToSuperAdmin}
              title={!isSidebarOpen ? "Super Admin Console" : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2.5 bg-slate-900 text-amber-400 rounded-lg text-sm font-black hover:bg-black transition shadow-lg shadow-slate-100 ${!isSidebarOpen ? 'justify-center px-0' : 'justify-center'}`}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" /> 
              {isSidebarOpen && <span className="truncate uppercase tracking-tighter">Super Admin</span>}
            </button>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'POS / Sales') {
                    onBack();
                  } else {
                    setActiveTab(tab.id as Tab);
                  }
                }}
                title={!isSidebarOpen ? tab.id : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                } ${!isSidebarOpen ? 'justify-center px-0' : ''}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isSidebarOpen && <span className="truncate">{((tab as any).isSalesmen && (!storeSettings.salesmenLabel || storeSettings.salesmenLabel === 'Usuarios')) ? t('Salesmen') : ((tab as any).label || t(tab.id))}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-100">
          {/* Bottom spacer or other elements if needed */}
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible print:h-auto print:block ${selectedOrder ? 'print:hidden' : ''}`}>
        <div className="mb-8 print:hidden">
          <h2 className="text-2xl font-bold text-gray-800">{activeTab}</h2>
          <p className="text-gray-500 text-sm">Manage your {activeTab.toLowerCase()} data and configurations.</p>
        </div>
        {renderContent()}
      </div>

      {/* Invoice Modal for Viewing Orders */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:static print:bg-white print:block print:p-0">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:max-w-none print:h-auto print:overflow-visible relative">
            
            <button 
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors z-10 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible flex flex-col items-center">
              {(() => {
                const isWholesale = businessCategory?.enabledFields?.printA4 || businessCategory?.name?.toLowerCase().includes('wholesale') || storeSettings.nombre?.toLowerCase().includes('wholesale');
                const displayFormat = (['restaurant', 'combo'].includes(businessCategory?.id || '') && !isWholesale) ? 'ticket' :
                                     (businessCategory?.enabledFields?.printA4 ? 'invoice' : 
                                     (businessCategory?.enabledFields?.thermal80mm ? 'ticket' : 
                                     (isWholesale ? 'invoice' : (storeSettings.printFormat || 'ticket'))));
                const orderSubtotal = (selectedOrder.articulos || []).reduce((acc, item) => acc + ((item.precio || 0) * (item.cantidad || 1)), 0);
                
                return displayFormat === 'invoice' ? (
                  <div className="w-full max-w-3xl">
                    <InvoicePreview 
                      cart={selectedOrder.articulos || []}
                      storeSettings={storeSettings}
                      salesman={salesmen.find(s => s.id === selectedOrder.vendedorId)}
                      client={clients.find(c => c.id === selectedOrder.clienteId)}
                      subtotal={orderSubtotal}
                      taxAmount={selectedOrder.tax || 0}
                      taxesApplied={selectedOrder.taxesApplied}
                      totalCash={selectedOrder.total || 0}
                      totalCredit={selectedOrder.total || 0}
                      paymentMethod={selectedOrder.metodoPago}
                      creditTerm={selectedOrder.terminosCredito}
                      splits={selectedOrder.splits}
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-md shadow-lg border border-gray-200">
                    <TicketPreview 
                      cart={selectedOrder.articulos || []}
                      storeSettings={storeSettings}
                      salesman={salesmen.find(s => s.id === selectedOrder.vendedorId)}
                      client={clients.find(c => c.id === selectedOrder.clienteId)}
                      subtotal={orderSubtotal}
                      taxAmount={selectedOrder.tax || 0}
                      taxesApplied={selectedOrder.taxesApplied}
                      totalCash={selectedOrder.total || 0}
                      totalCredit={selectedOrder.total || 0}
                      paymentMethod={selectedOrder.metodoPago}
                      splits={selectedOrder.splits}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center print:hidden">
              <button onClick={handleDeleteOrder} className="flex items-center gap-2 px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-lg transition">
                <Archive className="w-5 h-5" /> Delete Order
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                <PrinterIcon className="w-5 h-5" /> Print
              </button>
            </div>

          </div>
        </div>
      )}
      {/* Create PO Modal */}
      {isCreatingPO && (
        <CreatePOModal 
          vendors={vendors} 
          products={products} 
          isRestaurant={businessCategory?.name?.toLowerCase().includes('restaurant') || storeSettings.nombre?.toLowerCase().includes('restaurant') || storeSettings.businessCategory === 'restaurant' || storeSettings.businessCategory === 'combo'}
          onClose={() => setIsCreatingPO(false)} 
          onSave={(newPO: PurchaseOrder) => {
            const poWithStore = { ...newPO, storeId: storeSettings.id };
            setDoc(doc(db, 'purchaseOrders', newPO.id), sanitizeForFirestore(poWithStore)).catch(error => {
              console.error("Error creating purchase order:", error);
              showToast("Failed to create purchase order. It will sync when online.", 'error');
            });
            setPurchaseOrders([poWithStore, ...purchaseOrders]);
            setIsCreatingPO(false);
          }} 
        />
      )}
      {/* Create Client Modal */}
      {isCreatingClient && (
        <CreateClientModal 
          onClose={() => setIsCreatingClient(false)} 
          onSave={handleSaveClient} 
          salesmen={salesmen}
          isSuperAdmin={isSuperAdmin}
        />
      )}
      {/* Create Category Modal */}
      {isCreatingGlobalModifier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">New Modifier Group</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Add to your global library</p>
              </div>
              <button onClick={() => setIsCreatingGlobalModifier(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <div className="p-8">
              <ModifierGroupEditor 
                onSave={handleSaveGlobalModifier} 
                onCancel={() => setIsCreatingGlobalModifier(false)} 
              />
            </div>
          </div>
        </div>
      )}
      {isCreatingCategory && (
        <CreateCategoryModal onClose={() => setIsCreatingCategory(false)} onSave={handleSaveCategory} availableTaxes={taxes} businessCategory={businessCategory} />
      )}
      {/* Create Tax Modal */}
      {isCreatingTax && (
        <CreateTaxModal onClose={() => setIsCreatingTax(false)} onSave={handleSaveTax} />
      )}
      {/* Create Device Modal */}
      {isCreatingDevice && (
        <CreateDeviceModal onClose={() => setIsCreatingDevice(false)} onSave={handleSaveDevice} />
      )}
      {/* Edit Device Modal */}
      {editingDevice && (
        <EditDeviceModal item={editingDevice} onClose={() => setEditingDevice(null)} onSave={handleUpdateDevice} />
      )}
      {/* Create Salesman Modal */}
      {isCreatingSalesman && (
        <CreateSalesmanModal onClose={() => setIsCreatingSalesman(false)} onSave={handleSaveSalesman} />
      )}

      {/* View PO Modal */}
      {selectedPO && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:static print:bg-transparent print:p-0">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden print:shadow-none print:max-h-none print:max-w-none">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:hidden">
              <h2 className="text-2xl font-bold text-gray-800">Purchase Order {selectedPO.id}</h2>
              <button onClick={() => setSelectedPO(null)} className="p-2 hover:bg-gray-200 rounded-full transition">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">PURCHASE ORDER</h1>
                  <p className="text-gray-500 mt-1 font-mono">{selectedPO.id}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    selectedPO.estado === 'Recibido' ? 'bg-green-100 text-green-700' :
                    selectedPO.estado === 'Enviado' ? 'bg-blue-100 text-blue-700' :
                    selectedPO.estado === 'Cancelado' ? 'bg-red-100 text-red-700' :
                    selectedPO.estado === 'Printed' ? 'bg-purple-100 text-purple-700' :
                    selectedPO.estado === 'Mailed' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedPO.estado}
                  </span>
                  <div className="mt-4">
                    <p className="font-bold text-gray-800">{storeSettings.nombre}</p>
                    <p className="text-gray-600 text-sm whitespace-pre-line">{storeSettings.direccion}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Supplier</h3>
                  <p className="font-bold text-lg text-gray-800">{vendors.find(v => v.id === selectedPO.vendorId)?.nombre || 'Unknown'}</p>
                  <p className="text-gray-600">{vendors.find(v => v.id === selectedPO.vendorId)?.direccion}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Order Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500">Date:</span>
                    <span className="font-bold text-gray-800 text-right">{new Date(selectedPO.fechaCreacion).toLocaleDateString()}</span>
                    {selectedPO.fechaEsperada && (
                      <>
                        <span className="text-gray-500">Expected:</span>
                        <span className="font-bold text-gray-800 text-right">{new Date(selectedPO.fechaEsperada).toLocaleDateString()}</span>
                      </>
                    )}
                    {selectedPO.invoiceNumber && (
                      <>
                        <span className="text-gray-500">Invoice N°:</span>
                        <span className="font-bold text-gray-800 text-right">{selectedPO.invoiceNumber}</span>
                      </>
                    )}
                    {selectedPO.checkNumber && (
                      <>
                        <span className="text-gray-500">Check N°:</span>
                        <span className="font-bold text-gray-800 text-right">{selectedPO.checkNumber}</span>
                      </>
                    )}
                    <span className="text-gray-500">Status:</span>
                    <span className="font-bold text-gray-800 text-right">{selectedPO.estado}</span>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-800 text-sm uppercase tracking-wider text-gray-500">
                      <th className="py-3 font-bold">Product</th>
                      <th className="py-3 font-bold text-center">Quantity</th>
                      <th className="py-3 font-bold text-right">Unit Cost</th>
                      <th className="py-3 font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPO.articulos.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="py-4 font-bold text-gray-800">{item.nombre}</td>
                        <td className="py-4 text-center">{item.cantidad}</td>
                        <td className="py-4 text-right">${Number(item.costo || 0).toFixed(2)}</td>
                        <td className="py-4 text-right font-bold">${Number((item.cantidad || 0) * (item.costo || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="py-4 text-right font-bold text-gray-600">Total:</td>
                      <td className="py-4 text-right font-black text-xl text-gray-900">${Number(selectedPO.total || 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedPO.estado === 'Enviado' && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-8 print:hidden">
                  <h3 className="font-bold text-blue-800 mb-4">Receive Inventory</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-blue-700 mb-1">Invoice Number</label>
                      <input 
                        type="text" 
                        value={selectedPO.invoiceNumber || ''} 
                        onChange={e => setSelectedPO({...selectedPO, invoiceNumber: e.target.value})}
                        className="w-full p-2 border border-blue-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter supplier invoice #"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-blue-700 mb-1">Check Number (if paid)</label>
                      <input 
                        type="text" 
                        value={selectedPO.checkNumber || ''} 
                        onChange={e => setSelectedPO({...selectedPO, checkNumber: e.target.value})}
                        className="w-full p-2 border border-blue-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter check #"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedPO.estado === 'Recibido' && (selectedPO.invoiceNumber || selectedPO.checkNumber) && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-8">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selectedPO.invoiceNumber && (
                      <>
                        <span className="text-gray-500">Invoice Number:</span>
                        <span className="font-bold text-gray-800 text-right">{selectedPO.invoiceNumber}</span>
                      </>
                    )}
                    {selectedPO.checkNumber && (
                      <>
                        <span className="text-gray-500">Check Number:</span>
                        <span className="font-bold text-gray-800 text-right">{selectedPO.checkNumber}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4 print:hidden mt-8">
                <button 
                  onClick={() => {
                    flushSync(() => {
                      handlePOStatusUpdate(selectedPO, 'Printed');
                    });
                    window.print();
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition flex items-center gap-2"
                >
                  <PrinterIcon className="w-4 h-4" /> Print PO
                </button>
                <button 
                  onClick={() => {
                    const vendor = vendors.find(v => v.id === selectedPO.vendorId);
                    if (!vendor?.email) {
                      showToast('El proveedor no tiene un email.', 'error');
                      return;
                    }
                    const subject = `Purchase Order ${selectedPO.id}`;
                    const body = `Hello ${vendor.nombre},\n\nBelow are the details for the purchase order:\n\n${selectedPO.articulos.map(i => `${i.cantidad || i.quantity || 1}x ${i.nombre || i.name || 'Item'} - $${(((i.costo || i.price) || 0) * (i.cantidad || i.quantity || 1)).toFixed(2)}`).join('\n')}\n\nTotal: $${selectedPO.total.toFixed(2)}\n\nThank you!`;
                    
                    let mailtoUrl = `mailto:${vendor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    if (storeSettings.emailContacts && storeSettings.emailContacts.length > 0) {
                      const bccEmails = storeSettings.emailContacts.map(c => c.email).join(',');
                      mailtoUrl += `&bcc=${encodeURIComponent(bccEmails)}`;
                    }
                    
                    window.location.href = mailtoUrl;
                    handlePOStatusUpdate(selectedPO, 'Mailed');
                    showToast('Abriendo cliente de correo...', 'success');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" /> Email PO
                </button>

                {selectedPO.estado === 'Borrador' && (
                  <button 
                    onClick={() => handlePOStatusUpdate(selectedPO, 'Enviado')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg shadow-blue-200"
                  >
                    Mark as Sent
                  </button>
                )}
                {selectedPO.estado === 'Enviado' && (
                  <button 
                    onClick={() => {
                      if (!selectedPO.invoiceNumber) {
                        setConfirmation({
                          isOpen: true,
                          title: "Missing Invoice Number",
                          message: "Are you sure you want to receive this order without an invoice number?",
                          confirmText: "Receive Anyway",
                          type: "warning",
                          onConfirm: () => handleReceivePO(selectedPO)
                        });
                      } else {
                        handleReceivePO(selectedPO);
                      }
                    }}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow-lg shadow-green-200"
                  >
                    Receive Inventory
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {isReceivingInventory && (
        <ReceiveInventoryModal 
          vendors={vendors}
          products={products}
          onClose={() => setIsReceivingInventory(false)}
          storeSettings={storeSettings}
          onSave={async (newInventory: Inventory) => {
            console.log("Saving inventory:", newInventory);
            try {
              // Update products stock
              const newProducts = [...products];
              const productUpdates = (newInventory.items || []).map(async (item: any) => {
                const productIndex = newProducts.findIndex(p => p.id === item.productId);
                if (productIndex !== -1) {
                  const updatedProduct = {
                    ...newProducts[productIndex],
                    stock: newProducts[productIndex].stock + item.cantidad,
                    costo: item.costo
                  };
                  newProducts[productIndex] = updatedProduct;
                  return setDoc(doc(db, 'products', item.productId), sanitizeForFirestore(updatedProduct), { merge: true });
                }
              });
              
              await Promise.all(productUpdates);
              setProducts(newProducts);

              // Save inventory record
              await setDoc(doc(db, 'inventory', newInventory.id), sanitizeForFirestore(newInventory));
              console.log("Inventory saved successfully");
              
              setIsReceivingInventory(false);
              showToast('Inventory received successfully!', 'success');
            } catch (error) {
              console.error("Error receiving inventory:", error);
              showToast("Failed to receive inventory.", 'error');
            }
          }}
        />
      )}
      {isAddingProduct && (
        <CreateProductModal 
          categories={categories}
          globalImages={globalImages}
          businessCategory={businessCategory}
          globalModifierGroups={globalModifierGroups}
          initialModuleType={productAdminComboView}
          onClose={() => setIsAddingProduct(false)}
          onSave={async (newProduct: Product) => {
            try {
              const productWithStore = { ...newProduct, storeId: storeSettings.id };
              await setDoc(doc(db, 'products', newProduct.id), sanitizeForFirestore(productWithStore));
              setIsAddingProduct(false);
              showToast('Product added successfully!', 'success');
            } catch (error: any) {
              console.error("Error adding product:", error);
              if (error.code === 'permission-denied') {
                showToast("Permission denied. Product size might exceed limits.", 'error');
              } else if (error.message?.includes('too large')) {
                showToast("Product data is too large. Try a smaller image.", 'error');
              } else {
                showToast("Failed to add product.", 'error');
              }
            }
          }}
        />
      )}
      {isAddingPromo && (
        <CreatePromoModal
          products={products}
          onClose={() => setIsAddingPromo(false)}
          onSave={async (promoProduct) => {
            try {
              if ('clearPromo' in promoProduct && promoProduct.clearPromo) {
                const productToUpdate = products.find(p => p.id === promoProduct.id);
                if (!productToUpdate) return;
                const updatedProduct = { ...productToUpdate, promo: null, descuento: 0 };
                await setDoc(doc(db, 'products', updatedProduct.id), sanitizeForFirestore(updatedProduct));
              } else if ('promo' in promoProduct && promoProduct.promo?.type === 'combo') {
                // Determine a unique ID for combo
                const newProduct = { ...promoProduct, id: `COMBO-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, storeId: storeSettings.id } as Product;
                await setDoc(doc(db, 'products', newProduct.id), sanitizeForFirestore(newProduct));
              } else {
                // Determine the updated product for quantity or discount promo
                const updatedProduct = { ...promoProduct, storeId: storeSettings.id } as Product;
                await setDoc(doc(db, 'products', updatedProduct.id), sanitizeForFirestore(updatedProduct));
              }
              setIsAddingPromo(false);
              showToast('Promoción configurada exitosamente!', 'success');
            } catch (error) {
              console.error("Error setting promo:", error);
              showToast("Failed to save promo", 'error');
            }
          }}
        />
      )}
      {editingProduct && (
        <CreateProductModal 
          categories={categories}
          initialProduct={editingProduct}
          globalImages={globalImages}
          businessCategory={businessCategory}
          globalModifierGroups={globalModifierGroups}
          onClose={() => setEditingProduct(null)}
          onSave={async (updatedProduct: Product) => {
            try {
              const productWithStore = { ...updatedProduct, storeId: storeSettings.id };
              await setDoc(doc(db, 'products', updatedProduct.id), sanitizeForFirestore(productWithStore));
              setEditingProduct(null);
              showToast('Product updated successfully!', 'success');
            } catch (error: any) {
              console.error("Error updating product:", error);
              if (error.code === 'permission-denied') {
                showToast("Permission denied. You may not have access or the product size exceeds limits.", 'error');
              } else if (error.message?.includes('too large')) {
                showToast("Product data is too large. Try a smaller image.", 'error');
              } else {
                showToast("Failed to update product.", 'error');
              }
            }
          }}
        />
      )}
      {isAddingSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-black text-gray-800 tracking-tight">Add New Supplier</h2>
              <button onClick={() => setIsAddingSupplier(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newSupplier: Vendor = {
                id: `VEN-${Date.now()}`,
                storeId: storeSettings.id,
                nombre: formData.get('nombre') as string,
                contacto: formData.get('contacto') as string,
                telefono: formData.get('telefono') as string,
                email: formData.get('email') as string,
                direccion: formData.get('direccion') as string,
                terminos: formData.get('terminos') as string,
              };
              setDoc(doc(db, 'vendors', newSupplier.id), sanitizeForFirestore(newSupplier)).catch(err => {
                console.error("Error adding supplier:", err);
                showToast("Failed to add supplier. It will sync when online.", 'error');
              });
              setIsAddingSupplier(false);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Company Name</label>
                <input name="nombre" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold" placeholder="e.g. Tacos El Pastor S.A." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Contact Person</label>
                  <input name="contacto" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold" placeholder="Juan Perez" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                  <input name="telefono" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold" placeholder="(555) 555-0123" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Email</label>
                <input name="email" type="email" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold" placeholder="contacto@empresa.com" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Address</label>
                <input name="direccion" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold" placeholder="Av. Principal 123" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Payment Terms</label>
                <input name="terminos" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold" placeholder="e.g. Net 30" />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]">
                Save Supplier
              </button>
            </form>
          </div>
        </div>
      )}
      {selectedInventory && (
        <InvoiceDisplay 
          invoice={selectedInventory} 
          onClose={() => setSelectedInventory(null)} 
          storeSettings={storeSettings}
          onUpdatePayment={(updates) => handleUpdateInventory(selectedInventory.id, updates)}
        />
      )}

      <ConfirmationModal 
        isOpen={deleteConfirmation.isOpen}
        title={deleteConfirmation.step === 1 ? "Delete Product" : "Final Confirmation"}
        message={deleteConfirmation.step === 1 
          ? "Are you sure you want to delete this product?" 
          : "This action is permanent and cannot be undone. Are you REALLY sure?"
        }
        confirmText={deleteConfirmation.step === 1 ? "Yes, Delete" : "Yes, I am sure"}
        cancelText="Cancel"
        onConfirm={confirmDeleteProduct}
        onCancel={() => setDeleteConfirmation({ isOpen: false, step: 1, productId: null })}
        type="danger"
      />

      <ConfirmationModal 
        isOpen={cleanConfirmation.isOpen}
        title={cleanConfirmation.step === 1 ? `Clean All ${cleanConfirmation.title}` : "Final Confirmation"}
        message={cleanConfirmation.step === 1 
          ? `Are you sure you want to delete ALL ${cleanConfirmation.title}?` 
          : "This action is permanent and cannot be undone. Are you REALLY sure you want to delete EVERYTHING?"
        }
        confirmText={cleanConfirmation.step === 1 ? "Yes, Delete All" : "Yes, I am sure"}
        cancelText="Cancel"
        onConfirm={confirmCleanAll}
        onCancel={() => setCleanConfirmation({ isOpen: false, step: 1, collection: null, setter: null, title: null })}
        type="danger"
      />

      <ConfirmationModal 
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        confirmText={confirmation.confirmText}
        cancelText="Cancel"
        onConfirm={() => {
          confirmation.onConfirm();
          setConfirmation(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
        type={confirmation.type}
      />

      {activeToast && (
        <Toast 
          message={activeToast.message} 
          type={activeToast.type} 
          onClose={() => setActiveToast(null)} 
        />
      )}

      {/* Global Catalog Modal */}
      {isViewingGlobalCatalog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/30">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Global Catalog & Image Bank</h2>
                <p className="text-sm text-slate-500 font-medium">Import products or use global images for your store</p>
              </div>
              <button onClick={() => setIsViewingGlobalCatalog(false)} className="p-2 hover:bg-white rounded-full transition">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-8">
                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" /> Global Image Bank
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                  {globalImages.map((img) => (
                    <div key={img.id} className="aspect-square bg-slate-50 rounded-xl overflow-hidden border border-slate-100 group relative">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={() => {
                            // This could be used to just view or copy URL, 
                            // but for now it's just a preview.
                            // We'll allow using these in the product modal.
                          }}
                          className="text-white text-[10px] font-bold uppercase"
                        >
                          In Bank
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" /> Global Product Catalog
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {globalProducts.map((gp) => (
                  <div key={gp.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col">
                    <img src={gp.imagen} alt={gp.nombre} className="w-full h-32 object-cover rounded-xl mb-4" />
                    <h3 className="font-bold text-slate-900 mb-1">{gp.nombre}</h3>
                    <p className="text-indigo-600 font-black mb-4">${gp.precio.toFixed(2)}</p>
                    <button 
                      onClick={() => importGlobalProduct(gp)}
                      className="mt-auto w-full py-2 bg-white border border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Import Product
                    </button>
                  </div>
                ))}
                {globalProducts.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No global products available at the moment.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
