import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Product, CartItem, Client, BusinessCategory, ModifierGroup, SelectedModifier, Category } from '../types';
import { Search, LayoutGrid, List, Plus, User, UserPlus, X as CloseIcon, Check, ChevronRight, Tag, Star, ListFilter } from 'lucide-react';
import { QuantityControl } from './QuantityControl';

const ComboImage: React.FC<{ items: { productId: string }[]; products: Product[] }> = ({ items, products }) => {
  const images = React.useMemo(() => {
    return items
      .map(item => products.find(p => p.id === item.productId)?.imagenUrl)
      .filter(Boolean) as string[];
  }, [items, products]);

  if (images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    return <img src={images[0]} className="absolute inset-0 w-full h-full object-cover transition-transform hover:scale-110" referrerPolicy="no-referrer" />;
  }

  return (
    <div className={`absolute inset-0 w-full h-full grid ${images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'} gap-0.5 bg-gray-100`}>
      {images.slice(0, 4).map((url, idx) => (
        <div key={idx} className="w-full h-full overflow-hidden bg-white">
          <img src={url} className="w-full h-full object-cover transition-transform hover:scale-110" referrerPolicy="no-referrer" />
        </div>
      ))}
    </div>
  );
};

interface ModifierSelectionModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (selectedModifiers: SelectedModifier[]) => void;
}

const ModifierSelectionModal: React.FC<ModifierSelectionModalProps> = ({ product, onClose, onConfirm }) => {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const toggleModifier = (group: ModifierGroup, modifierId: string) => {
    const current = selections[group.id] || [];
    if (group.allowMultiple) {
      if (current.includes(modifierId)) {
        setSelections({ ...selections, [group.id]: current.filter(id => id !== modifierId) });
      } else {
        setSelections({ ...selections, [group.id]: [...current, modifierId] });
      }
    } else {
      setSelections({ ...selections, [group.id]: [modifierId] });
    }
  };

  const handleConfirm = () => {
    // Validate required groups
    const missingRequired = product.modifierGroups?.filter(g => g.required && (!selections[g.id] || selections[g.id].length === 0));
    if (missingRequired && missingRequired.length > 0) {
      alert(`Please select required options for: ${missingRequired.map(g => g.nombre).join(', ')}`);
      return;
    }

    const selectedModifiers: SelectedModifier[] = [];
    product.modifierGroups?.forEach(group => {
      const selectedIds = selections[group.id] || [];
      selectedIds.forEach(id => {
        const mod = group.modifiers.find(m => m.id === id);
        if (mod) {
          selectedModifiers.push({
            groupId: group.id,
            groupName: group.nombre,
            modifierId: mod.id,
            modifierName: mod.nombre,
            precio: mod.precio
          });
        }
      });
    });

    onConfirm(selectedModifiers);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh] h-full">
        <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Plus className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">{product.nombre}</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Customize your order</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-all">
            <CloseIcon className="w-8 h-8 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-10 bg-slate-50/50">
          {product.modifierGroups?.map((group) => (
            <div key={group.id} className="space-y-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    {group.nombre}
                    {group.required && (
                      <span className="text-[10px] bg-red-50 text-red-500 px-3 py-1 rounded-full font-black uppercase tracking-widest">Required</span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                    {group.allowMultiple ? 'Select one or more options' : 'Select one option'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.modifiers.map((mod) => {
                  const isSelected = (selections[group.id] || []).includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModifier(group, mod.id)}
                      className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50/80 shadow-md shadow-blue-100/50 scale-[1.02]' 
                          : 'border-gray-100 hover:border-blue-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 bg-white'
                        }`}>
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>
                        <span className={`font-bold text-lg ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>{mod.nombre}</span>
                      </div>
                      {mod.precio > 0 && (
                        <span className={`font-black text-lg ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>+${mod.precio.toFixed(2)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 sm:p-8 bg-white border-t border-gray-100 shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
          <button
            onClick={handleConfirm}
            className="w-full py-5 bg-blue-600 text-white font-black text-xl rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-3 group"
          >
            ADD TO ORDER <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface CatalogProps {
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product, quantity?: number, selectedModifiers?: SelectedModifier[]) => void;
  onUpdateQuantity: (cartId: string, cantidad: number) => void;
  isReceiveMode?: boolean;
  clients?: Client[];
  selectedClient?: Client | null;
  onSelectClient?: (client: Client | null) => void;
  onAddClient?: () => void;
  onToggleFeatured?: (product: Product) => void;
  featuredProductId?: string;
  businessCategory?: BusinessCategory | null;
  storeSettings?: any;
  categories?: Category[];
}

const Catalog: React.FC<CatalogProps> = ({ 
  products, 
  cart, 
  onAddToCart, 
  onUpdateQuantity, 
  isReceiveMode,
  clients = [],
  selectedClient,
  onSelectClient,
  onAddClient,
  onToggleFeatured,
  featuredProductId,
  businessCategory,
  storeSettings,
  categories = []
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const availableCategories = React.useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.map(c => c.nombre);
    }
    const uniq = new Set<string>();
    products.forEach(p => {
      if (p.categoria) {
        uniq.add(p.categoria);
      }
    });
    return Array.from(uniq);
  }, [categories, products]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [selectedProductForModifiers, setSelectedProductForModifiers] = useState<Product | null>(null);
  const clientResultsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientResultsRef.current && !clientResultsRef.current.contains(event.target as Node)) {
        setShowClientResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (search.length >= 8) {
      const exactMatch = products.find(p => p.upc === search || p.boxBarcode === search);
      if (exactMatch) {
        const isBox = exactMatch.boxBarcode === search;
        const quantity = isBox ? (exactMatch.unitsPerBox || 1) : 1;
        onAddToCart(exactMatch, quantity);
        setSearch('');
      }
    }
  }, [search, products, onAddToCart]);

  const filtered = products.filter(p => {
    const matchesSearch = (p.nombre || '').toLowerCase().includes(search.toLowerCase()) || 
      (p.componenteActivo || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.upc || '').includes(search) ||
      (p.boxBarcode && p.boxBarcode.includes(search));
    
    const matchesCategory = !selectedCategory || (p.categoria || '').toLowerCase() === selectedCategory.toLowerCase();
    
    if (isReceiveMode) return matchesSearch && matchesCategory;
    return p.showInPOS !== false && matchesSearch && matchesCategory;
  });

  const filteredClients = clients.filter(c => 
    (c.nombre || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.codigo || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.telefono || '').includes(clientSearch)
  );

  const handleProductClick = (product: Product) => {
    if (product.modifierGroups && product.modifierGroups.length > 0) {
      setSelectedProductForModifiers(product);
    } else {
      const cartItem = cart.find(item => item.id === product.id);
      if (cartItem) {
        onUpdateQuantity(cartItem.cartId, cartItem.cantidad + 1);
      } else {
        onAddToCart(product);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 print:hidden">
      <div className="p-4 bg-white shadow-sm z-10 sticky top-0 flex items-center gap-4">
        <div className="flex-1 flex gap-4">
          {/* Product Search (50%) */}
          <div className="relative w-1/2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder={isReceiveMode ? t('Search Products...', 'Search Products...') : t('Search Products...', 'Search Products...')} 
              className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 outline-none text-lg ${isReceiveMode ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-blue-500'}`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Client Search (50%) */}
          <div className="relative w-1/2 flex items-center gap-2" ref={clientResultsRef}>
            <div className="relative flex-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder={t('Search Client...', 'Search Client...')} 
                className={`w-full pl-10 pr-10 py-3 rounded-lg border focus:ring-2 outline-none text-lg ${selectedClient ? 'border-green-500 bg-green-50 focus:ring-green-500' : 'border-gray-200 focus:ring-blue-500'}`}
                value={selectedClient ? `${selectedClient.nombre}` : clientSearch}
                onChange={e => {
                  const val = e.target.value;
                  setClientSearch(val);
                  setShowClientResults(true);
                  const exactMatch = clients.find(c => c.nombre.toLowerCase() === val.toLowerCase());
                  if (exactMatch) {
                    onSelectClient?.(exactMatch);
                    setShowClientResults(false);
                  } else if (selectedClient) {
                    onSelectClient?.(null);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && filteredClients.length > 0) {
                    onSelectClient?.(filteredClients[0]);
                    setShowClientResults(false);
                    setClientSearch('');
                    e.target.blur();
                  }
                }}
                onFocus={() => setShowClientResults(true)}
                onBlur={() => {
                  setTimeout(() => {
                    if (!selectedClient && clientSearch && filteredClients.length > 0) {
                      onSelectClient?.(filteredClients[0]);
                      setClientSearch('');
                    }
                    setShowClientResults(false);
                  }, 200);
                }}
              />
              {selectedClient && (
                <button 
                  onClick={() => {
                    onSelectClient?.(null);
                    setClientSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <button 
              onClick={onAddClient}
              className="p-3 bg-white text-gray-400 rounded-lg border border-gray-200 hover:bg-emerald-50 hover:text-emerald-500 transition-colors shadow-sm"
              title="Add Client"
            >
              <UserPlus className="w-5 h-5" />
            </button>

            {/* Client Results Dropdown */}
            {showClientResults && clientSearch && !selectedClient && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50">
                {filteredClients.length > 0 ? (
                  filteredClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onSelectClient?.(c);
                        setShowClientResults(false);
                        setClientSearch('');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-none transition-colors"
                    >
                      <p className="font-bold text-gray-800">{c.nombre}</p>
                      <p className="text-xs text-gray-500">{c.codigo} • {c.telefono}</p>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-400 text-sm">{t('No clients found', 'No se encontraron clientes')}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
          className="p-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors shrink-0"
          title={`Switch to ${viewMode === 'list' ? 'Grid' : 'List'} View`}
        >
          {viewMode === 'list' ? <LayoutGrid className="w-6 h-6" /> : <List className="w-6 h-6" />}
        </button>
      </div>
      
      {availableCategories.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0 z-10 shadow-sm">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider mr-2 whitespace-nowrap flex items-center gap-1.5">
            <ListFilter className="w-4 h-4 text-slate-400" />
            {t('Category', 'Categoría')}:
          </span>
          
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase transition-all tracking-wider whitespace-nowrap border ${
              selectedCategory === ''
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 border-blue-600'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
            }`}
          >
            {t('All', 'Todas')}
          </button>

          {availableCategories.map((catName) => (
            <button
              key={catName}
              onClick={() => setSelectedCategory(catName)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase transition-all tracking-wider whitespace-nowrap border ${
                selectedCategory.toLowerCase() === catName.toLowerCase()
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 border-blue-600'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >
              {t(catName, catName)}
            </button>
          ))}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
            <Search className="w-16 h-16 opacity-20" />
            <p className="text-lg font-medium">No products found matching "{search}"</p>
            <button 
              onClick={() => setSearch('')}
              className="text-blue-600 font-bold hover:underline"
            >
              Clear Search
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filtered.map(product => {
              const cartItem = cart.find(item => item.id === product.id);
              return (
                <div 
                  key={product.id} 
                  onClick={() => handleProductClick(product)}
                  className={`bg-white rounded-xl sm:rounded-2xl shadow-sm border overflow-hidden transition-all flex flex-col cursor-pointer active:scale-95 ${!cartItem ? `hover:shadow-md ${isReceiveMode ? 'hover:border-orange-400' : 'hover:border-blue-400'} border-gray-100` : `${isReceiveMode ? 'border-orange-500 ring-2 ring-orange-100' : 'border-blue-500 ring-2 ring-blue-100'}`}`}
                >
                  <div className={`relative w-full ${(!storeSettings?.hideProductImages) ? 'pt-[100%]' : 'py-2 px-2'} bg-gray-50 overflow-hidden flex ${storeSettings?.hideProductImages ? 'justify-start' : ''}`}>
                    {(!businessCategory || businessCategory.enabledFields.imagenUrl) && !storeSettings?.hideProductImages && (
                      product.promo?.type === 'combo' && product.promo.items ? (
                        <ComboImage items={product.promo.items} products={products} />
                      ) : (
                        <img 
                          src={product.imagenUrl} 
                          alt={product.nombre} 
                          className="absolute inset-0 w-full h-full object-cover transition-transform hover:scale-110" 
                          referrerPolicy="no-referrer"
                        />
                      )
                    )}
                    {product.promo && product.promo.type === 'quantity' && (
                      <div className={`${!storeSettings?.hideProductImages ? 'absolute top-2 left-2' : 'relative'} bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] sm:text-xs font-black px-2 sm:px-3 py-1 rounded-full shadow-lg border border-pink-400/50 flex items-center gap-1 z-10 animate-bounce`}>
                         <Tag className="w-3 h-3" /> {t('BUY', 'LLEVA')} {product.promo.quantity}X
                      </div>
                    )}
                    {product.promo && product.promo.type === 'combo' && (
                      <div className={`${!storeSettings?.hideProductImages ? 'absolute top-2 left-2' : 'relative'} bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] sm:text-xs font-black px-2 sm:px-3 py-1 rounded-full shadow-lg border border-indigo-400/50 flex items-center gap-1 z-10 animate-pulse`}>
                         <Tag className="w-3 h-3" /> {t('SPECIAL COMBO', 'COMBO ESPECIAL')}
                      </div>
                    )}
                    {(product.descuento > 0 && (!businessCategory || businessCategory.enabledFields.descuento)) && (
                      <div className={`${!storeSettings?.hideProductImages ? 'absolute top-2 right-2' : 'relative ml-auto'} bg-red-500 text-white text-[8px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shadow-sm z-10`}>
                        -{product.descuento}%
                      </div>
                    )}
                    {onToggleFeatured && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFeatured(product);
                        }}
                        className={`absolute top-2 right-2 p-1.5 rounded-full shadow-lg transition-all z-20 ${
                          featuredProductId === product.id 
                            ? 'bg-yellow-400 text-white border-2 border-yellow-500 scale-110' 
                            : 'bg-white/80 text-gray-400 hover:text-yellow-500 hover:bg-white'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${featuredProductId === product.id ? 'fill-current' : ''}`} />
                      </button>
                    )}
                  </div>
                  <div className="p-2 sm:p-4 flex flex-col flex-1">
                    <div className="mb-auto">
                      {(!businessCategory || businessCategory.enabledFields.sku) && (
                        <p className="text-[8px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5 sm:mb-1">{product.sku}</p>
                      )}
                      <h3 className="font-black text-gray-800 leading-tight mb-0.5 sm:mb-1 text-xs sm:text-sm line-clamp-2">{product.nombre}</h3>
                      {(!businessCategory || businessCategory.enabledFields.componenteActivo) && (
                        <p className="text-[10px] sm:text-xs text-blue-600 font-bold line-clamp-1 mb-1 sm:mb-2">{product.componenteActivo}</p>
                      )}
                      <p className="hidden sm:block text-[10px] text-gray-500 font-medium">
                        {(!businessCategory || businessCategory.enabledFields.laboratorio) && product.laboratorio}
                        {(!businessCategory || businessCategory.enabledFields.laboratorio) && (!businessCategory || businessCategory.enabledFields.unidad) && ' • '}
                        {(!businessCategory || businessCategory.enabledFields.unidad) && product.unidad}
                      </p>
                      {product.promo && product.promo.type === 'combo' && product.promo.items && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {product.promo.items.map((item, i) => (
                            <span key={i} className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-black border border-indigo-100">
                              {item.cantidad}x {item.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-50">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        {(businessCategory?.enabledFields?.stock !== false) && (
                          <div className="flex flex-col">
                            <span className="text-[8px] sm:text-[10px] text-gray-400 font-bold uppercase">{t('Stock', 'Stock')}</span>
                            <span className={`text-xs sm:text-sm font-black ${product.stock < (product.threshold || 0) ? 'text-red-500' : 'text-green-600'}`}>{product.stock}</span>
                          </div>
                        )}
                        <p className={`text-sm sm:text-xl font-black tracking-tighter ${isReceiveMode ? 'text-orange-600' : 'text-gray-900'} ${(businessCategory?.enabledFields?.stock !== false) ? '' : 'w-full text-center'}`}>
                          ${Number((isReceiveMode ? product.costo : product.precio) || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex justify-center">
                        <QuantityControl 
                          quantity={cartItem?.cantidad || 0} 
                          onChange={(q) => cartItem ? onUpdateQuantity(cartItem.cartId, q) : (q > 0 && onAddToCart(product, q))} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map(product => {
              const cartItem = cart.find(item => item.id === product.id);
              return (
                <div 
                  key={product.id} 
                  onClick={() => handleProductClick(product)}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all flex items-center p-4 gap-6 cursor-pointer active:scale-[0.99] ${!cartItem ? `hover:shadow-md ${isReceiveMode ? 'hover:border-orange-400' : 'hover:border-blue-400'} border-gray-100` : `${isReceiveMode ? 'border-orange-500 ring-2 ring-orange-100' : 'border-blue-500 ring-2 ring-blue-100'}`}`}
                >
                  {/* Image Container */}
                  {(!storeSettings?.hideProductImages) && (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-50 rounded-2xl relative flex-shrink-0 border border-gray-100 overflow-hidden">
                      {(!businessCategory || businessCategory.enabledFields.imagenUrl) && (
                        product.promo?.type === 'combo' && product.promo.items ? (
                          <ComboImage items={product.promo.items} products={products} />
                        ) : (
                          <img 
                            src={product.imagenUrl} 
                            alt={product.nombre} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        )
                      )}
                      {product.promo && product.promo.type === 'quantity' && (
                        <div className="absolute top-2 left-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg border border-pink-400/50 flex items-center gap-1 z-10 animate-bounce">
                           <Tag className="w-3 h-3" /> {t('BUY', 'LLEVA')} {product.promo.quantity}X
                        </div>
                      )}
                      {product.promo && product.promo.type === 'combo' && (
                        <div className="absolute top-2 left-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] sm:text-xs font-black px-2 sm:px-3 py-1 rounded-full shadow-lg border border-indigo-400/50 flex items-center gap-1 z-10 animate-pulse">
                           <Tag className="w-3 h-3" /> {t('SPECIAL COMBO', 'COMBO ESPECIAL')}
                        </div>
                      )}
                      {(product.descuento > 0 && (!businessCategory || businessCategory.enabledFields.descuento)) && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg z-10">
                          -{product.descuento}%
                        </div>
                      )}
                    </div>
                  )}

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-black text-gray-800 text-xl tracking-tight">{product.nombre}</h3>
                      {storeSettings?.hideProductImages && product.promo && product.promo.type === 'quantity' && (
                        <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full shadow border border-pink-400/50 flex items-center gap-1 animate-bounce">
                           <Tag className="w-3 h-3" /> LLEVA {product.promo.quantity}X
                        </div>
                      )}
                      {storeSettings?.hideProductImages && product.promo && product.promo.type === 'combo' && (
                        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full shadow border border-indigo-400/50 flex items-center gap-1 animate-pulse">
                           <Tag className="w-3 h-3" /> COMBO
                        </div>
                      )}
                      {storeSettings?.hideProductImages && product.descuento > 0 && (!businessCategory || businessCategory.enabledFields.descuento) && (
                        <div className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                           -{product.descuento}%
                        </div>
                      )}
                    </div>
                    {onToggleFeatured && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFeatured(product);
                        }}
                        className={`p-2 rounded-xl transition-all ${
                          featuredProductId === product.id 
                            ? 'bg-yellow-50 text-yellow-500 border border-yellow-100 scale-110' 
                            : 'bg-gray-50 text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${featuredProductId === product.id ? 'fill-current' : ''}`} />
                      </button>
                    )}
                    {(!businessCategory || businessCategory.enabledFields.componenteActivo) && (
                      <p className="text-sm text-blue-600 font-bold mb-2">{product.componenteActivo}</p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                      {(!businessCategory || businessCategory.enabledFields.upc) && (
                        <>
                          <span>UPC: {product.upc}</span>
                          <span>•</span>
                        </>
                      )}
                      {(!businessCategory || businessCategory.enabledFields.laboratorio) && (
                        <>
                          <span>{product.laboratorio}</span>
                          <span>•</span>
                        </>
                      )}
                      {(!businessCategory || businessCategory.enabledFields.unidad) && (
                        <span>{product.unidad}</span>
                      )}
                    </div>
                    {product.promo && product.promo.type === 'combo' && product.promo.items && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {product.promo.items.map((item, i) => (
                          <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-black border border-indigo-100 shadow-sm">
                            {item.cantidad}x {item.nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stock - Centered in middle */}
                  {(businessCategory?.enabledFields?.stock !== false) && (
                    <div className="hidden md:flex flex-col items-center justify-center px-8 border-l border-gray-50">
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">{t('Stock', 'Stock')}</span>
                      <span className={`text-2xl font-black ${product.stock < (product.threshold || 0) ? 'text-red-500' : 'text-green-600'}`}>
                        {product.stock}
                      </span>
                    </div>
                  )}

                  {/* Quantity Control */}
                  <div className="flex items-center justify-center px-4 border-l border-gray-50">
                    <QuantityControl 
                      quantity={cartItem ? cartItem.cantidad : 0} 
                      onChange={(q) => {
                        if (cartItem) {
                          onUpdateQuantity(cartItem.cartId, q);
                        } else if (q > 0) {
                          onAddToCart(product, q);
                        }
                      }} 
                    />
                  </div>

                  {/* Price/Cost */}
                  <div className="min-w-[100px] text-right border-l border-gray-50 pl-6">
                    <p className={`text-3xl font-black tracking-tighter ${isReceiveMode ? 'text-orange-600' : 'text-gray-900'}`}>
                      ${Number((isReceiveMode ? product.costo : product.precio) || 0).toFixed(0)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedProductForModifiers && (
        <ModifierSelectionModal
          product={selectedProductForModifiers}
          onClose={() => setSelectedProductForModifiers(null)}
          onConfirm={(selectedModifiers) => {
            onAddToCart(selectedProductForModifiers, 1, selectedModifiers);
            setSelectedProductForModifiers(null);
          }}
        />
      )}
    </div>
  );
};

export default Catalog;
