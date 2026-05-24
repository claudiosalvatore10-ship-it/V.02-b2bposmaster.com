import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Barcode from 'react-barcode';
import { 
  Search, Plus, Minus, Trash2, Settings, Printer, Eye, Tag, Archive, 
  ChevronLeft, ChevronRight, Grid, Columns, CreditCard, DollarSign, X, CheckCircle
} from 'lucide-react';
import { Product, StoreSettings, Category } from '../types';

interface LabelPrinterProps {
  products: Product[];
  storeSettings: StoreSettings;
  categories: Category[];
}

interface QueuedLabel {
  product: Product;
  quantity: number;
}

interface LabelTemplate {
  id: string;
  name: string;
  width: number; // inches
  height: number; // inches
  cols: number;
  rows: number;
  marginTop: number; // inches
  marginLeft: number; // inches
  gapHorizontal: number; // inches
  gapVertical: number; // inches
}

export const LabelPrinter: React.FC<LabelPrinterProps> = ({ products, storeSettings, categories }) => {
  const [activeTab, setActiveTab] = useState<'products' | 'preview'>('products');
  const [queue, setQueue] = useState<QueuedLabel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [surchargePercent, setSurchargePercent] = useState<number>(storeSettings.creditSurcharge ?? 4);
  const [pricingMode, setPricingMode] = useState<'both' | 'cash' | 'card'>('both');
  
  // Handlers for dynamic template settings (saved in localStorage)
  const [customSettings, setCustomSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('label_printer_settings_v3');
      return saved ? JSON.parse(saved) : {
        width: 2.625, // default Avery 5160 width (inches)
        height: 1.0,  // default Avery 5160 height (inches)
        gapHorizontal: 0.125,
        gapVertical: 0.0,
        autoCenter: true,
        cols: 3,
        rows: 10,
        marginTop: 0.5,
        marginLeft: 0.219,
      };
    } catch {
      return {
        width: 2.625,
        height: 1.0,
        gapHorizontal: 0.125,
        gapVertical: 0.0,
        autoCenter: true,
        cols: 3,
        rows: 10,
        marginTop: 0.5,
        marginLeft: 0.219,
      };
    }
  });

  // Track ingredients/notes per product
  const [productNotes, setProductNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('label_printer_notes_v3');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [measurementUnit, setMeasurementUnit] = useState<'inch' | 'mm'>('inch');
  const [showSettings, setShowSettings] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);

  // Track skipped slots on the first page
  const [skippedSlots, setSkippedSlots] = useState<Set<number>>(new Set());

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('label_printer_settings_v3', JSON.stringify(customSettings));
  }, [customSettings]);

  useEffect(() => {
    localStorage.setItem('label_printer_notes_v3', JSON.stringify(productNotes));
  }, [productNotes]);

  // Compute active layout dynamic variables on-the-fly
  const activeTemplate = useMemo(() => {
    const w = customSettings.width || 2.625;
    const h = customSettings.height || 1.0;
    const gapX = customSettings.gapHorizontal ?? 0.125;
    const gapY = customSettings.gapVertical ?? 0.0;

    if (customSettings.autoCenter) {
      // Automatic margins and grid calculation for standard 8.5" x 11" sheet
      const minMarginX = 0.15;
      const minMarginY = 0.15;

      // cols * width + (cols - 1) * gapX <= 8.5 - 2 * minMarginX
      const calculatedCols = Math.max(1, Math.floor((8.5 - 2 * minMarginX + gapX) / (w + gapX)));
      const calculatedRows = Math.max(1, Math.floor((11.0 - 2 * minMarginY + gapY) / (h + gapY)));

      const gridWidth = calculatedCols * w + (calculatedCols - 1) * gapX;
      const gridHeight = calculatedRows * h + (calculatedRows - 1) * gapY;

      const autoMarginLeft = Math.max(0.01, (8.5 - gridWidth) / 2);
      const autoMarginTop = Math.max(0.01, (11.0 - gridHeight) / 2);

      return {
        id: 'dynamic',
        name: `Planilla Automática (${calculatedCols} x ${calculatedRows} - ${calculatedCols * calculatedRows} por hoja)`,
        width: w,
        height: h,
        cols: calculatedCols,
        rows: calculatedRows,
        marginTop: autoMarginTop,
        marginLeft: autoMarginLeft,
        gapHorizontal: gapX,
        gapVertical: gapY,
        autoCenter: true
      };
    } else {
      // Manual margins and grid count overrides
      return {
        id: 'manual',
        name: 'Planilla Manual Personalizada',
        width: w,
        height: h,
        cols: customSettings.cols || 3,
        rows: customSettings.rows || 10,
        marginTop: customSettings.marginTop || 0.5,
        marginLeft: customSettings.marginLeft || 0.25,
        gapHorizontal: gapX,
        gapVertical: gapY,
        autoCenter: false
      };
    }
  }, [customSettings]);

  const labelsPerSheet = useMemo(() => {
    return activeTemplate.cols * activeTemplate.rows;
  }, [activeTemplate]);

  // Clear skipped slots on layout/sheet size switch
  useEffect(() => {
    setSkippedSlots(new Set());
    setPreviewPage(1);
  }, [labelsPerSheet]);

  const toggleSkipSlot = (index: number) => {
    setSkippedSlots(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const skipFirstN = (n: number) => {
    const next = new Set<number>();
    for (let i = 0; i < Math.min(n, labelsPerSheet); i++) {
      next.add(i);
    }
    setSkippedSlots(next);
  };

  const clearSkips = () => {
    setSkippedSlots(new Set());
  };

  // Unit converter
  const convertValue = (val: number, direction: 'toUnit' | 'fromUnit') => {
    if (measurementUnit === 'inch') return val;
    // 1 inch = 25.4 mm
    if (direction === 'toUnit') {
      return Number((val * 25.4).toFixed(1));
    } else {
      return Number((val / 25.4).toFixed(3));
    }
  };

  // Label configuration setter for custom values
  const handleCustomSettingChange = (field: string, value: number) => {
    const rawValue = measurementUnit === 'mm' && ['width', 'height', 'marginTop', 'marginLeft', 'gapHorizontal', 'gapVertical'].includes(field)
      ? Number((value / 25.4).toFixed(3))
      : value;
    setCustomSettings(prev => ({
      ...prev,
      [field]: rawValue
    }));
  };

  // Surcharged Price Helper
  const getCardPrice = (cashPrice: number) => {
    return cashPrice * (1 + surchargePercent / 100);
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = (p.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.upc || p.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = !selectedCategory || p.categoria === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Queue Operations
  const addToQueue = (product: Product, quantity: number = 1) => {
    setQueue(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const updateQueueQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromQueue(productId);
      return;
    }
    setQueue(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity } : item
    ));
  };

  const removeFromQueue = (productId: string) => {
    setQueue(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearQueue = () => {
    if (queue.length > 0 && confirm('¿Desea vaciar la cola de impresión?')) {
      setQueue([]);
    }
  };

  const addAllFilteredToQueue = () => {
    const count = filteredProducts.length;
    if (count === 0) return;
    if (confirm(`¿Desea agregar los ${count} productos filtrados a la cola?`)) {
      setQueue(prev => {
        let updated = [...prev];
        filteredProducts.forEach(p => {
          const index = updated.findIndex(item => item.product.id === p.id);
          if (index >= 0) {
            updated[index] = { ...updated[index], quantity: updated[index].quantity + 1 };
          } else {
            updated.push({ product: p, quantity: 1 });
          }
        });
        return updated;
      });
    }
  };

  // Compute total label grids
  const totalLabelsInQueue = useMemo(() => {
    return queue.reduce((sum, item) => sum + item.quantity, 0);
  }, [queue]);

  // Generate flattened array of labels for rendering pages
  const flattenedLabels = useMemo(() => {
    const list: Product[] = [];
    queue.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        list.push(item.product);
      }
    });
    return list;
  }, [queue]);

  // Compute flattened array of labels taking skips into account (ONLY affects the first sheet)
  const flattenedLabelsWithSkips = useMemo(() => {
    const result: (Product | null)[] = [];
    let queueIndex = 0;

    if (flattenedLabels.length === 0) {
      return [];
    }

    // First page slots:
    for (let i = 0; i < labelsPerSheet; i++) {
      if (skippedSlots.has(i)) {
        result.push(null);
      } else {
        if (queueIndex < flattenedLabels.length) {
          result.push(flattenedLabels[queueIndex]);
          queueIndex++;
        } else {
          result.push(null);
        }
      }
    }

    // Subsequent pages slots:
    while (queueIndex < flattenedLabels.length) {
      result.push(flattenedLabels[queueIndex]);
      queueIndex++;
    }

    // Finally, pad the very last sheet so it forms a complete grid of labelsPerSheet
    const lastSheetRemainder = result.length % labelsPerSheet;
    if (lastSheetRemainder > 0) {
      const padCount = labelsPerSheet - lastSheetRemainder;
      for (let i = 0; i < padCount; i++) {
        result.push(null);
      }
    }

    return result;
  }, [flattenedLabels, skippedSlots, labelsPerSheet]);

  const estimatedSheets = useMemo(() => {
    if (flattenedLabelsWithSkips.length === 0) return 0;
    return Math.ceil(flattenedLabelsWithSkips.length / labelsPerSheet);
  }, [flattenedLabelsWithSkips, labelsPerSheet]);

  // Print process
  const handlePrint = () => {
    if (flattenedLabels.length === 0) {
      alert('La cola de impresión está vacía.');
      return;
    }
    window.print();
  };

  // Pagination for screen preview
  const paginatedLabelsForPreview = useMemo(() => {
    const startIdx = (previewPage - 1) * labelsPerSheet;
    const endIdx = startIdx + labelsPerSheet;
    return flattenedLabelsWithSkips.slice(startIdx, endIdx);
  }, [flattenedLabelsWithSkips, previewPage, labelsPerSheet]);

  return (
    <div className="w-full bg-[#f8fafc] text-slate-800 rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
      
      {/* Dynamic Printing Style Block */}
      <style>{`
        @media print {
          /* Hide overall app shells */
          #root {
            display: none !important;
          }
          body > div:not(#print-labels-container-root) {
            display: none !important;
          }
          html, body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            width: 8.5in !important;
          }
          /* Show print wrapper */
          #print-labels-container-root {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 8.5in !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Standard letter page rules */
          @page {
            size: 8.5in 11in;
            margin: 0 !important;
          }
          /* Page splits */
          .print-sheet {
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 11in !important;
            width: 8.5in !important;
            box-sizing: border-box !important;
            background: white !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      {/* Header Panel */}
      <div className="bg-white p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-100">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">LABEL PRINTER</h1>
            <p className="text-slate-500 text-xs font-semibold leading-tight">Create and print grocery shelf labels for laser Avery stickers or customs</p>
          </div>
        </div>

        {/* Top controls and Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-inner">
            <button 
              onClick={() => setActiveTab('products')} 
              className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 ${activeTab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Grid className="w-4 h-4" /> Products
            </button>
            <button 
              onClick={() => setActiveTab('preview')} 
              className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 relative ${activeTab === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Eye className="w-4 h-4" /> Visual Preview
              {totalLabelsInQueue > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-white">
                  {totalLabelsInQueue}
                </span>
              )}
            </button>
          </div>

          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center gap-2 font-bold text-xs ${showSettings ? 'bg-slate-800 text-white border-slate-800' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
            title="Configure Label Dimensions"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[500px]">
          {/* Left Side settings side drawer/panel (expanded dynamically) */}
        {showSettings && (
          <div className="lg:col-span-4 bg-slate-50 border-b border-slate-200 p-6 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
            
            {/* Column 1: Preset quick loading */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3.5 flex items-center gap-2">
                  <Archive className="w-3.5 h-3.5" /> Tamaños Rápidos
                </h3>
                
                <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomSettings(prev => ({
                        ...prev,
                        width: 2.625,
                        height: 1.0,
                        gapHorizontal: 0.125,
                        gapVertical: 0.0,
                        autoCenter: true
                      }));
                    }}
                    className={`w-full text-left p-2 border rounded-lg text-xs font-semibold flex flex-col hover:bg-slate-50 transition-colors ${
                      customSettings.width === 2.625 && customSettings.height === 1.0
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'border-slate-100'
                    }`}
                  >
                    <span className="text-slate-955 font-black">Avery 5160 Pequeña</span>
                    <span className="text-slate-400 text-[10px]">1" x 2.625" (30 por hoja)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomSettings(prev => ({
                        ...prev,
                        width: 4.0,
                        height: 2.0,
                        gapHorizontal: 0.14,
                        gapVertical: 0.0,
                        autoCenter: true
                      }));
                    }}
                    className={`w-full text-left p-2 border rounded-lg text-xs font-semibold flex flex-col hover:bg-slate-50 transition-colors ${
                      customSettings.width === 4.0 && customSettings.height === 2.0
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'border-slate-100'
                    }`}
                  >
                    <span className="text-slate-955 font-black">Avery 5163 Mediana</span>
                    <span className="text-slate-400 text-[10px]">2" x 4.0" (10 por hoja)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomSettings(prev => ({
                        ...prev,
                        width: 3.0,
                        height: 4.0,
                        gapHorizontal: 0.12,
                        gapVertical: 0.12,
                        autoCenter: true
                      }));
                    }}
                    className={`w-full text-left p-2 border rounded-lg text-xs font-semibold flex flex-col hover:bg-slate-50 transition-colors ${
                      customSettings.width === 3.0 && customSettings.height === 4.0
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'border-slate-100'
                    }`}
                  >
                    <span className="text-slate-955 font-black">Tarjeta de Producto Grande</span>
                    <span className="text-slate-400 text-[10px]">3" x 4.0" (Etiquetas con Notas)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomSettings(prev => ({
                        ...prev,
                        width: 2.0,
                        height: 3.0,
                        gapHorizontal: 0.1,
                        gapVertical: 0.1,
                        autoCenter: true
                      }));
                    }}
                    className={`w-full text-left p-2 border rounded-lg text-xs font-semibold flex flex-col hover:bg-slate-50 transition-colors ${
                      customSettings.width === 2.0 && customSettings.height === 3.0
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'border-slate-100'
                    }`}
                  >
                    <span className="text-slate-955 font-black">Etiqueta Vertical Regular</span>
                    <span className="text-slate-400 text-[10px]">2" x 3.0" (Ingredientes)</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-150 pt-3">
                <label className="text-xs font-bold text-slate-500">Unidad de medida:</label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner">
                  <button 
                    onClick={() => setMeasurementUnit('inch')} 
                    className={`px-2 py-1 text-[10px] font-bold rounded-md ${measurementUnit === 'inch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                  >
                    Inches (")
                  </button>
                  <button 
                    onClick={() => setMeasurementUnit('mm')} 
                    className={`px-2 py-1 text-[10px] font-bold rounded-md ${measurementUnit === 'mm' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                  >
                    MM
                  </button>
                </div>
              </div>
            </div>

            {/* Column 2: Advanced template dimensions */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Columns className="w-3.5 h-3.5" /> Dimensiones de la Etiqueta
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500">Centrado automático:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomSettings(prev => ({
                        ...prev,
                        autoCenter: !prev.autoCenter
                      }));
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${customSettings.autoCenter ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${customSettings.autoCenter ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Ancho ({measurementUnit === 'inch' ? 'in' : 'mm'}):</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={convertValue(activeTemplate.width, 'toUnit')}
                    onChange={(e) => handleCustomSettingChange('width', parseFloat(e.target.value) || 0.1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Alto ({measurementUnit === 'inch' ? 'in' : 'mm'}):</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={convertValue(activeTemplate.height, 'toUnit')}
                    onChange={(e) => handleCustomSettingChange('height', parseFloat(e.target.value) || 0.1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Separación Horiz. ({measurementUnit === 'inch' ? 'in' : 'mm'}):</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={convertValue(activeTemplate.gapHorizontal, 'toUnit')}
                    onChange={(e) => handleCustomSettingChange('gapHorizontal', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Separación Vert. ({measurementUnit === 'inch' ? 'in' : 'mm'}):</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={convertValue(activeTemplate.gapVertical, 'toUnit')}
                    onChange={(e) => handleCustomSettingChange('gapVertical', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Columnas:</label>
                  <input 
                    type="number" 
                    disabled={customSettings.autoCenter}
                    value={activeTemplate.cols}
                    onChange={(e) => handleCustomSettingChange('cols', parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold disabled:opacity-60" 
                  />
                  {customSettings.autoCenter && (
                    <span className="text-[9px] text-emerald-600 font-bold block mt-1">Calculado: {activeTemplate.cols}</span>
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Filas por Hoja:</label>
                  <input 
                    type="number" 
                    disabled={customSettings.autoCenter}
                    value={activeTemplate.rows}
                    onChange={(e) => handleCustomSettingChange('rows', parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold disabled:opacity-60" 
                  />
                  {customSettings.autoCenter && (
                    <span className="text-[9px] text-emerald-600 font-bold block mt-1">Calculado: {activeTemplate.rows}</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Margen Superior ({measurementUnit === 'inch' ? 'in' : 'mm'}):</label>
                  <input 
                    type="number" 
                    step="0.01"
                    disabled={customSettings.autoCenter}
                    value={convertValue(activeTemplate.marginTop, 'toUnit')}
                    onChange={(e) => handleCustomSettingChange('marginTop', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold disabled:opacity-60" 
                  />
                  {customSettings.autoCenter && (
                    <span className="text-[9px] text-emerald-600 font-bold block mt-1">Dinámico: {convertValue(activeTemplate.marginTop, 'toUnit')}</span>
                  )}
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Margen Izquierdo ({measurementUnit === 'inch' ? 'in' : 'mm'}):</label>
                  <input 
                    type="number" 
                    step="0.01"
                    disabled={customSettings.autoCenter}
                    value={convertValue(activeTemplate.marginLeft, 'toUnit')}
                    onChange={(e) => handleCustomSettingChange('marginLeft', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold disabled:opacity-60" 
                  />
                  {customSettings.autoCenter && (
                    <span className="text-[9px] text-emerald-600 font-bold block mt-1">Dinámico: {convertValue(activeTemplate.marginLeft, 'toUnit')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Column 3: Pricing calculations */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" /> Opciones de Precio
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Card Surcharge rate (%):</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.1" 
                      value={surchargePercent}
                      onChange={(e) => setSurchargePercent(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 pl-6 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                    />
                    <span className="absolute left-2.5 top-2.5 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 mb-1">Pricing display mode:</label>
                  <select 
                    value={pricingMode}
                    onChange={(e) => setPricingMode(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  >
                    <option value="both">💵 Doble (Cash & Tarjeta)</option>
                    <option value="cash">💵 Solo CASH</option>
                    <option value="card">💳 Solo TARJETA (Card)</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'products' ? (
          <>
            {/* GRID 3 COLS: PRODUCT FINDER & SELECTOR */}
            <div className="lg:col-span-3 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col h-[650px] overflow-hidden">
              
              {/* Filter inputs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    placeholder="Search products by name or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-2 px-9 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 rounded-full p-0.5 hover:bg-slate-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="w-full sm:w-48">
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full p-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={addAllFilteredToQueue}
                  disabled={filteredProducts.length === 0}
                  className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-100/80 disabled:opacity-40 font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" /> ADD ALL ({filteredProducts.length})
                </button>
              </div>

              {/* Products Catalog Cards Grid */}
              <div className="flex-1 overflow-y-auto pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center h-full text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mt-2">
                    <Archive className="w-12 h-12 mb-3 text-slate-300" />
                    <p className="font-bold">No products found</p>
                    <p className="text-xs text-slate-400">Try cleaning your search filters</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 mt-1 pb-4">
                    {filteredProducts.map(p => {
                      const cardVal = getCardPrice(p.precio);
                      const isUpc = !!(p.upc || p.sku);
                      return (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-md hover:border-slate-300/80 transition shadow-sm">
                          <div>
                            <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                              {p.categoria || 'Uncategorized'}
                            </span>
                            <h3 className="font-bold text-slate-800 text-sm mt-1 mb-2 line-clamp-1 uppercase leading-tight">{p.nombre}</h3>
                            
                            {/* Pricing badges */}
                            <div className="space-y-1 mb-4">
                              <div className="flex items-center gap-2 justify-between">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CASH Price</span>
                                <span className="text-emerald-600 font-black text-sm">${p.precio.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-2 justify-between">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CARD Price ({surchargePercent}%)</span>
                                <span className="text-sky-600 font-black text-sm">${cardVal.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[10px]">
                            <span className={`font-mono font-bold uppercase ${isUpc ? 'text-slate-400' : 'text-amber-500'}`}>
                              {isUpc ? `BC: ${p.upc || p.sku}` : 'No BC'}
                            </span>
                            <button 
                              onClick={() => addToQueue(p, 1)}
                              className="px-3 py-1.5 bg-slate-900 border border-slate-950 text-white hover:bg-slate-800 rounded-lg font-bold flex items-center gap-1 hover:shadow-sm shadow-black/10 transition-all text-[11px]"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add to Queue
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="lg:col-span-3 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col h-[650px] bg-slate-200/50 overflow-hidden">
            
            {/* SHEETS VISUAL PREVIEW CONTROL PANEL WITH INTERACTIVE MAP */}
            <div className="flex flex-col xl:flex-row gap-5 mb-4 flex-shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                      <Grid className="w-4 h-4 text-emerald-500" /> PLANILLA DE {labelsPerSheet} ETIQUETAS
                    </h3>
                    
                    <div className="flex items-center gap-2 text-xs">
                      <button 
                        onClick={() => setPreviewPage(prev => Math.max(1, prev - 1))}
                        disabled={previewPage === 1}
                        className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-600 transition"
                        title="Página Anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-bold text-slate-700 bg-slate-50 border border-slate-200 p-1 px-3 rounded-lg text-[11px]">
                        Planilla {previewPage} de {Math.max(1, estimatedSheets)}
                      </span>
                      <button 
                        onClick={() => setPreviewPage(prev => Math.min(estimatedSheets, prev + 1))}
                        disabled={previewPage >= estimatedSheets}
                        className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-600 transition"
                        title="Siguiente Página"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-slate-500 text-[10.5px] font-semibold leading-relaxed">
                    Las etiquetas se acomodan para saltear los espacios usados. Haz clic en las celdas de la primera planilla (abajo o en el croquis) para marcar las que ya fueron impresas.
                  </p>
                </div>

                {/* Quick skip actions */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Saltear rápidos:</span>
                  {[3, 5, 10, 15, 20].map(n => (
                    <button
                      key={n}
                      onClick={() => skipFirstN(n)}
                      className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 transition"
                      title={`Saltear las primeras ${n} etiquetas`}
                    >
                      +{n}
                    </button>
                  ))}
                  {skippedSlots.size > 0 && (
                    <button
                      onClick={clearSkips}
                      className="p-1 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-black border border-red-200 transition"
                    >
                      Vaciar Salteados
                    </button>
                  )}
                </div>
              </div>

              {/* Crocodile / Interactive grid representation */}
              <div className="w-full xl:w-80 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex flex-col items-center justify-center">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Settings className="w-3 h-3 text-slate-500 animate-spin-slow" /> Croquis de Planilla (Haz clic)
                </div>
                
                {/* Visual miniature layout */}
                <div 
                  className="grid gap-[3px] border border-slate-300 p-1.5 rounded bg-white shadow-inner"
                  style={{
                    gridTemplateColumns: `repeat(${activeTemplate.cols}, minmax(0, 1fr))`,
                    width: '100%',
                    maxWidth: '190px'
                  }}
                >
                  {Array.from({ length: labelsPerSheet }).map((_, idx) => {
                    const isSkipped = skippedSlots.has(idx);
                    
                    // What content is inside this cell?
                    const labelItem = flattenedLabelsWithSkips[idx];
                    
                    let bgClass = "bg-slate-100 border border-slate-200 hover:border-slate-400";
                    let titleText = `Slot ${idx + 1}: Vacío (Sin Usar)`;
                    let bubbleEl = null;

                    if (isSkipped) {
                      bgClass = "bg-red-50 border border-dashed border-red-300 hover:border-red-400 cursor-pointer";
                      titleText = `Slot ${idx + 1}: Salteado (Haz clic para habilitar)`;
                      bubbleEl = <span className="text-[7.5px] font-black text-red-600 leading-none">🚫</span>;
                    } else if (labelItem) {
                      bgClass = "bg-emerald-500 hover:bg-emerald-600 border border-emerald-600 cursor-pointer shadow-sm text-white";
                      titleText = `Slot ${idx + 1}: Imprime "${labelItem.nombre}"`;
                      bubbleEl = <span className="text-[8px] font-black truncate max-w-[40px] leading-none">{idx + 1}</span>;
                    } else {
                      bgClass = "bg-slate-50 border border-dashed border-slate-200 hover:border-slate-300 cursor-pointer text-slate-450";
                      titleText = `Slot ${idx + 1}: Libre (Sin etiqueta)`;
                      bubbleEl = <span className="text-[7.5px] font-mono leading-none">{idx + 1}</span>;
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => toggleSkipSlot(idx)}
                        className={`aspect-video rounded flex items-center justify-center transition-all h-[15px] ${bgClass}`}
                        title={titleText}
                      >
                        {bubbleEl}
                      </button>
                    );
                  })}
                </div>
                
                <div className="mt-1.5 text-[8.5px] font-semibold text-slate-400 flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-sm font-bold"></span> Con Etiqueta</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-100 border border-dashed border-red-300 rounded-sm font-bold"></span> Salteado</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-50 border border-slate-200 rounded-sm font-bold"></span> Libre</span>
                </div>
              </div>
            </div>

            {/* Simulated interactive physical paper layout container */}
            <div className="flex-1 overflow-auto flex items-start justify-center p-2">
              {flattenedLabels.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 w-full max-w-lg mt-8 shadow-sm">
                  <Eye className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="font-bold">Visual sheet preview is empty</p>
                  <p className="text-xs text-slate-400">Add products to your queue to see how they arrange on physical label grids</p>
                </div>
              ) : (
                <div 
                  className="bg-white border rounded-lg shadow-xl relative text-black scale-[0.82] origin-top shrink-0 border-slate-300"
                  style={{
                    width: '8.5in',
                    height: '11in',
                    boxSizing: 'border-box',
                    paddingTop: `${activeTemplate.marginTop}in`,
                    paddingLeft: `${activeTemplate.marginLeft}in`,
                    paddingRight: `${activeTemplate.marginLeft}in`,
                    paddingBottom: `${activeTemplate.marginTop}in`,
                    backgroundColor: 'white'
                  }}
                >
                  {/* Grid of Avery Labels on Sheet */}
                  <div 
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${activeTemplate.cols}, ${activeTemplate.width}in)`,
                      gridTemplateRows: `repeat(${activeTemplate.rows}, ${activeTemplate.height}in)`,
                      columnGap: `${activeTemplate.gapHorizontal}in`,
                      rowGap: `${activeTemplate.gapVertical}in`,
                      width: '100%',
                      height: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    {paginatedLabelsForPreview.map((item, idx) => {
                      const absoluteIdx = (previewPage - 1) * labelsPerSheet + idx;
                      const isSkipped = previewPage === 1 && skippedSlots.has(idx);
                      
                      const cardVal = item ? getCardPrice(item.precio) : 0;
                      const keyStr = item ? (item.upc || item.sku || '') : '';
                      
                      return (
                        <div 
                          key={idx}
                          onClick={() => {
                            if (previewPage === 1) {
                              toggleSkipSlot(idx);
                            }
                          }}
                          className={`p-2 flex flex-col justify-between overflow-hidden relative select-none transition-all ${
                            isSkipped 
                              ? 'border border-dashed border-red-300 bg-red-50/40 hover:bg-red-50/60 cursor-pointer' 
                              : item 
                                ? 'border border-slate-200 bg-white hover:border-slate-400 cursor-pointer hover:shadow-inner'
                                : 'border border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 cursor-pointer'
                          }`}
                          style={{
                            boxSizing: 'border-box',
                            width: `${activeTemplate.width}in`,
                            height: `${activeTemplate.height}in`,
                            borderWidth: '1px',
                            fontSize: activeTemplate.height <= 1.2 ? '9px' : '11px',
                            lineHeight: '1.2'
                          }}
                          title={previewPage === 1 ? (isSkipped ? "Haz clic para habilitar" : "Haz clic para saltear etiqueta") : undefined}
                        >
                          {isSkipped ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center text-red-500">
                              <span className="text-base font-bold leading-none">🚫</span>
                              <span className="text-[7.5px] font-black uppercase tracking-wider mt-1 opacity-80 animate-pulse">Salteada / Vacía</span>
                              <span className="text-[6.5px] text-slate-400 font-semibold leading-none mt-0.5">Haz clic para habilitar</span>
                            </div>
                          ) : item ? (
                            /* Inner Label Container */
                            <div className="flex flex-col h-full justify-between">
                              {/* Head metadata */}
                              <div className="text-center">
                                <span className="text-[7.5px] font-black uppercase text-slate-500 tracking-wide block truncate">
                                  {storeSettings.nombre || 'GOURMET GROCERS'}
                                </span>
                                <h4 className="font-black text-[9px] text-slate-900 border-b border-slate-100 pb-0.5 uppercase tracking-tighter truncate mt-0.5 animate-fade-in">
                                  {item.nombre}
                                </h4>
                              </div>

                              {/* Custom label ingredients/notes section */}
                              {productNotes[item.id] && activeTemplate.height >= 0.95 && (
                                <div className="text-[7px] font-black text-slate-500 bg-slate-50 border border-slate-100 p-1 rounded-md text-left leading-tight my-1 max-h-[46px] overflow-hidden line-clamp-2">
                                  <span className="text-[5.5px] font-extrabold text-slate-400 block tracking-widest leading-none mb-0.5 uppercase">INGREDIENTES:</span>
                                  {productNotes[item.id]}
                                </div>
                              )}

                              {/* Bottom Footer block containing barcode and price next to it */}
                              <div className="flex items-center justify-between mt-auto pt-1 border-t border-slate-100 w-full gap-1">
                                {/* CASH Price on the left (if enabled) */}
                                {pricingMode !== 'card' ? (
                                  <div className="text-left shrink-0 min-w-[32px]">
                                    <span className="text-[5.5px] font-black text-emerald-600 block leading-none uppercase">CASH</span>
                                    <span className="text-[10px] font-black text-emerald-600 leading-none">${item.precio.toFixed(2)}</span>
                                  </div>
                                ) : (
                                  <div className="w-8"></div> // spacer to keep barcode centered
                                )}

                                {/* Barcode in the center */}
                                <div className="flex-1 flex flex-col items-center justify-center min-w-0 max-w-[80px]">
                                  {keyStr ? (
                                    <div className="flex flex-col items-center w-full">
                                      <div className="scale-x-[0.8] origin-center w-full flex justify-center">
                                        <Barcode 
                                          value={keyStr.length > 20 ? keyStr.substring(0, 12) : keyStr} 
                                          width={activeTemplate.width < 2.5 ? 0.7 : activeTemplate.width < 3.5 ? 0.8 : 1.0} 
                                          height={activeTemplate.height < 1.3 ? 10 : 18} 
                                          margin={0} 
                                          fontSize={5} 
                                          displayValue={false} 
                                        />
                                      </div>
                                      <span className="text-[5.5px] text-slate-400 font-mono font-bold leading-none select-none truncate max-w-full text-center">{keyStr}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[5.5px] font-mono leading-none tracking-wider text-slate-300 uppercase text-center w-full block">Sin SKU</span>
                                  )}
                                </div>

                                {/* CARD Price on the right (if enabled) */}
                                {pricingMode !== 'cash' ? (
                                  <div className="text-right shrink-0 min-w-[32px]">
                                    <span className="text-[5.5px] font-black text-sky-600 block leading-none uppercase text-right">CARD</span>
                                    <span className="text-[10px] font-black text-sky-600 leading-none">${cardVal.toFixed(2)}</span>
                                  </div>
                                ) : (
                                  <div className="w-8"></div> // spacer to keep barcode centered
                                )}
                              </div>

                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-300">
                              <span className="text-[7.5px] font-black uppercase tracking-widest opacity-80">Libre / Vacía</span>
                              <span className="text-[6.5px] text-slate-400 font-semibold leading-none mt-0.5">Haz clic para saltear</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT SIDE: PRINT QUEUE DRAWER PANEL */}
        <div className="lg:col-span-1 border-t lg:border-t-0 bg-slate-50 p-5 flex flex-col justify-between h-[650px]">
          
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3 shrink-0">
              <h3 className="font-black text-slate-800 tracking-tight text-xs uppercase flex items-center gap-2">
                <Archive className="w-4 h-4 text-emerald-600" /> Print Queue
              </h3>
              {queue.length > 0 && (
                <button 
                  onClick={clearQueue}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 p-1 px-2 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Queue items list */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center h-full text-slate-400">
                  <div className="w-10 h-10 bg-slate-100/80 rounded-full flex items-center justify-center mb-2.5">
                    <Printer className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="font-bold text-xs">QUEUE IS EMPTY</p>
                  <p className="text-[10px] text-slate-400 mt-1">Select products and tap "Add to Queue"</p>
                </div>
              ) : (
                queue.map(item => {
                  const cardValue = getCardPrice(item.product.precio);
                  return (
                    <div key={item.product.id} className="bg-white border border-slate-250 p-3 rounded-lg flex flex-col justify-between shadow-xs relative gap-2">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-tight block truncate pr-5" title={item.product.nombre}>
                            {item.product.nombre}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-semibold text-slate-400">
                            <span>$ {item.product.precio.toFixed(2)} CASH</span>
                            <span>•</span>
                            <span>$ {cardValue.toFixed(2)} CARD</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => removeFromQueue(item.product.id)}
                          className="text-slate-400 hover:text-red-600 hover:bg-slate-50 p-1 rounded-md transition Absolute -top-0.5 -right-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Notes / ingredients field with auto-save */}
                      <div className="mt-1">
                        <textarea
                          placeholder="Ingredientes / Notas de la etiqueta..."
                          value={productNotes[item.product.id] || ''}
                          onChange={(e) => setProductNotes(prev => ({ ...prev, [item.product.id]: e.target.value }))}
                          rows={2}
                          className="w-full text-[10px] leading-tight p-2 bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none rounded-lg font-medium transition-all resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-mono text-slate-400">Labels qty:</span>
                        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 p-0.5 rounded-lg select-none">
                          <button 
                            onClick={() => updateQueueQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 hover:bg-white text-slate-500 rounded transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQueueQuantity(item.product.id, item.quantity + 1)}
                            className="p-1 hover:bg-white text-slate-500 rounded transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SHT Estimates and Print Button */}
          <div className="border-t border-slate-250 pt-3.5 space-y-3 shrink-0">
            <div className="bg-slate-200/60 p-3 rounded-xl border border-slate-350 flex justify-between items-center text-xs">
              <div className="flex flex-col">
                <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider leading-none">EST. PAGES ({labelsPerSheet}/SHT)</span>
                <span className="font-bold text-slate-800 mt-1">Total Stickers: {totalLabelsInQueue}</span>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-slate-900 bg-white border border-slate-150 rounded-lg p-1 px-3 shadow-inner">
                  {estimatedSheets}
                </span>
              </div>
            </div>

            <button 
              onClick={handlePrint}
              disabled={flattenedLabels.length === 0}
              className="w-full py-3 bg-emerald-500 border border-emerald-600 hover:bg-emerald-600 disabled:bg-slate-300 disabled:border-slate-300 disabled:cursor-not-allowed text-white hover:shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 rounded-xl font-black text-sm tracking-widest uppercase transition-all"
            >
              <Printer className="w-4 h-4" /> PRINT LABELS
            </button>
          </div>

        </div>

      </div>

       {/* HIDDEN OFFLINE PRINT PREVIEW SHEETS GRID CONTAINER FOR BROWSER native print */}
      {createPortal(
        <div id="print-labels-container-root" className="hidden">
          {Array.from({ length: estimatedSheets }).map((_, sheetIdx) => {
            const sheetLabels = flattenedLabelsWithSkips.slice(sheetIdx * labelsPerSheet, (sheetIdx + 1) * labelsPerSheet);
            return (
              <div 
                key={sheetIdx} 
                className="print-sheet"
                style={{
                  boxSizing: 'border-box',
                  paddingTop: `${activeTemplate.marginTop}in`,
                  paddingLeft: `${activeTemplate.marginLeft}in`,
                  paddingRight: `${activeTemplate.marginLeft}in`,
                  paddingBottom: `${activeTemplate.marginTop}in`,
                  backgroundColor: 'white'
                }}
              >
                <div 
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${activeTemplate.cols}, ${activeTemplate.width}in)`,
                    gridTemplateRows: `repeat(${activeTemplate.rows}, ${activeTemplate.height}in)`,
                    columnGap: `${activeTemplate.gapHorizontal}in`,
                    rowGap: `${activeTemplate.gapVertical}in`,
                    width: '105%', // minor overshoot safety for exact template sizes
                    height: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  {sheetLabels.map((item, labelIdx) => {
                    if (!item) {
                      return (
                        <div 
                          key={labelIdx}
                          style={{
                            boxSizing: 'border-box',
                            width: `${activeTemplate.width}in`,
                            height: `${activeTemplate.height}in`,
                            backgroundColor: 'transparent',
                            visibility: 'hidden'
                          }}
                        />
                      );
                    }

                    const cardVal = getCardPrice(item.precio);
                    const keyStr = item.upc || item.sku || '';
                    
                    return (
                      <div 
                        key={labelIdx}
                        style={{
                          boxSizing: 'border-box',
                          width: `${activeTemplate.width}in`,
                          height: `${activeTemplate.height}in`,
                          backgroundColor: 'white',
                          padding: '0.1in',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          fontSize: activeTemplate.height <= 1.2 ? '9px' : '11px',
                          lineHeight: '1.2'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                          {/* Heading */}
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '7.5px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {storeSettings.nombre || 'GOURMET GROCERS'}
                            </span>
                            <h4 style={{ fontSize: '9px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: '2px 0 0 0', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.nombre}
                            </h4>
                          </div>

                           {/* Print output dynamic ingredients / notes */}
                          {productNotes[item.id] && activeTemplate.height >= 0.95 && (
                            <div style={{
                              fontSize: '7px',
                              fontWeight: '700',
                              color: '#475569',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              padding: '2px 4.5px',
                              borderRadius: '4.5px',
                              textAlign: 'left',
                              margin: '2px 0',
                              maxHeight: '38px',
                              overflow: 'hidden',
                              wordBreak: 'break-word',
                              lineHeight: '1.1'
                            }}>
                              <span style={{ fontSize: '5.5px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '1px', letterSpacing: '0.05em' }}>INGREDIENTES:</span>
                              {productNotes[item.id]}
                            </div>
                          )}

                          {/* Bottom Footer row with prices and barcode next to it */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            width: '100%', 
                            marginTop: 'auto',
                            paddingTop: '3px',
                            borderTop: '1px solid #f1f5f9',
                            gap: '4px'
                          }}>
                            {/* CASH Price (left) */}
                            {pricingMode !== 'card' ? (
                              <div style={{ textAlign: 'left', flexShrink: 0, minWidth: '32px' }}>
                                <span style={{ fontSize: '5.5px', fontWeight: '900', color: '#10b981', display: 'block', lineHeight: '1', textTransform: 'uppercase' }}>CASH</span>
                                <span style={{ fontSize: '10px', fontWeight: '900', color: '#10b981', lineHeight: '1' }}>${item.precio.toFixed(2)}</span>
                              </div>
                            ) : (
                              <div style={{ width: '32px' }}></div>
                            )}

                            {/* Barcode in center */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, justifyContent: 'center' }}>
                              {keyStr ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                  <div style={{ transform: 'scaleX(0.8)', transformOrigin: 'center', display: 'flex', justifyContent: 'center', width: '130%' }}>
                                    <Barcode 
                                      value={keyStr.length > 20 ? keyStr.substring(0, 12) : keyStr} 
                                      width={activeTemplate.width < 2.5 ? 0.7 : activeTemplate.width < 3.5 ? 0.8 : 1.0} 
                                      height={activeTemplate.height < 1.3 ? 10 : 18} 
                                      margin={0} 
                                      fontSize={5} 
                                      displayValue={false} 
                                    />
                                  </div>
                                  <span style={{ fontSize: '5.5px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', display: 'block', textAlign: 'center' }}>{keyStr}</span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '5.5px', fontFamily: 'monospace', color: '#cbd5e1', textTransform: 'uppercase', display: 'block', textAlign: 'center', width: '100%' }}>Sin SKU</span>
                              )}
                            </div>

                            {/* CARD Price (right) */}
                            {pricingMode !== 'cash' ? (
                              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '32px' }}>
                                <span style={{ fontSize: '5.5px', fontWeight: '900', color: '#0284c7', display: 'block', lineHeight: '1', textTransform: 'uppercase' }}>CARD</span>
                                <span style={{ fontSize: '10px', fontWeight: '900', color: '#0284c7', lineHeight: '1' }}>${cardVal.toFixed(2)}</span>
                              </div>
                            ) : (
                              <div style={{ width: '32px' }}></div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>,
        document.body
      )}

    </div>
  );
};
