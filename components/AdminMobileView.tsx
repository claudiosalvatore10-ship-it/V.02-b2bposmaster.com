import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Home, Package, Tags, FileText, Camera, Plus, Search, X, 
  ChevronRight, ArrowLeft, Trash2, Edit, Save, BarChart3,
  TrendingUp, Layers, Check, RefreshCw, AlertTriangle
} from 'lucide-react';
import { collection, doc, setDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Category, Order } from '../types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface AdminMobileViewProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  orders: Order[];
  userStoreId: string | null;
  onBack: () => void;
}

type TabType = 'inicio' | 'productos' | 'categorias' | 'reportes';

export const AdminMobileView: React.FC<AdminMobileViewProps> = ({
  products,
  setProducts,
  categories,
  setCategories,
  orders,
  userStoreId,
  onBack
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('inicio');
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals / Detail actions
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // States for new/editing product forms
  const [productForm, setProductForm] = useState<Partial<Product>>({
    nombre: '',
    precio: 0,
    costo: 0,
    categoria: '',
    stock: 0,
    upc: '',
    boxBarcode: '',
    unitsPerBox: 1,
    sku: ''
  });

  // State for new/editing category forms
  const [categoryForm, setCategoryForm] = useState<Partial<Category>>({
    nombre: ''
  });

  // Scanner States
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  // Keyboard scanner simulation
  useEffect(() => {
    let rawBuffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        rawBuffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (rawBuffer.length >= 4) {
          handleScannedBarcode(rawBuffer);
          rawBuffer = '';
        }
      } else if (e.key !== 'Shift') {
        rawBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [products]);

  // Handle a barcode when scanned via camera or keyboard
  const handleScannedBarcode = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    
    // Find absolute match (exact or ignoring leading zeros e.g. EAN-13 vs UPC-A fallback)
    const cleanBar = (code: string) => code.replace(/^0+/, '').trim();
    const cleanSearched = cleanBar(trimmed);

    const found = products.find(p => {
      const pUpc = p.upc || '';
      const pBox = p.boxBarcode || '';
      return (
        pUpc === trimmed || 
        pBox === trimmed || 
        (pUpc && cleanBar(pUpc) === cleanSearched) || 
        (pBox && cleanBar(pBox) === cleanSearched)
      );
    });

    if (found) {
      toast.success(t('Product found: ', 'Producto encontrado: ') + found.nombre + ` (${trimmed})`);
      setEditingProduct(found);
      setProductForm(found);
      setIsScanning(false);
      stopCamera();
    } else {
      const lookupToastId = toast.loading(t('New barcode scanned! Searching name online...', '¡Código nuevo detectado! Buscando nombre en línea...'));
      
      let fetchedName = '';
      try {
        const res = await fetch('/api/barcode-lookup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ barcode: trimmed }),
        });
        if (res.ok) {
          const data = await res.json();
          fetchedName = data.name || '';
        }
      } catch (err) {
        console.error('Error looking up barcode online:', err);
      }

      toast.dismiss(lookupToastId);

      if (fetchedName) {
        toast.success(t('Product identified: ', 'Producto identificado: ') + fetchedName, { duration: 4500 });
      } else {
        toast.info(t('New product registered! (No online name found)', '¡Nuevo producto registrado! (No se encontró nombre en línea)'), {
          duration: 4000
        });
      }

      // Open add product modal with this barcode and prefilled name
      const isBox = trimmed.startsWith('B-') || trimmed.length > 12; // heuristic
      setProductForm({
        id: `PROD-${Date.now()}`,
        nombre: fetchedName || '',
        precio: 0,
        costo: 0,
        categoria: categories[0]?.nombre || '',
        stock: 0,
        upc: isBox ? '' : trimmed,
        boxBarcode: isBox ? trimmed : '',
        unitsPerBox: 12,
        sku: `SKU-${Math.floor(Math.random() * 900000 + 100000)}`
      });
      setIsAddingProduct(true);
      setIsScanning(false);
      stopCamera();
    }
  };

  // Web camera activation with real-time barcode decoding engine
  const startCamera = async () => {
    setIsScanning(true);
    setScanResult(null);
    setHasCameraPermission(true);

    // Give a slightly longer tick for #scanner-reader-element to fully mount in DOM and style transitions
    setTimeout(async () => {
      try {
        const elementId = "scanner-reader-element";
        const element = document.getElementById(elementId);
        if (!element) {
          console.error("Scanner DOM wrapper not found");
          return;
        }

        // Clean up any existing scanner reference first to prevent locking drivers
        if (html5QrcodeRef.current) {
          try {
            if (html5QrcodeRef.current.isScanning) {
              await html5QrcodeRef.current.stop();
            }
          } catch (stopErr) {
            console.warn("Error stopping existing scanner:", stopErr);
          }
          html5QrcodeRef.current = null;
        }

        // Initialize with standard retail 1D and QR code formats plus native browser decoder mapping
        const html5Qrcode = new Html5Qrcode(elementId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ],
          useBarCodeDetectorIfSupported: true
        });
        html5QrcodeRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 20, // Slightly higher framerate for faster snapping
            qrbox: (width, height) => {
              // Wide aspect ratio is much more intuitive for retail barcodes
              return {
                width: Math.floor(width * 0.85),
                height: Math.floor(height * 0.50)
              };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (decodedText) {
              const scanned = decodedText.trim();
              stopCamera();
              handleScannedBarcode(scanned);
            }
          },
          () => {} // Mute frame parsing errors to prevent flooding developer console
        );
      } catch (err) {
        console.warn('Rear camera activation failed, trying generic fallback:', err);
        try {
          // If first start failed, let's recreate block reference for user-facing camera fallback
          const elementId = "scanner-reader-element";
          if (html5QrcodeRef.current) {
            try {
              if (html5QrcodeRef.current.isScanning) {
                await html5QrcodeRef.current.stop();
              }
            } catch (e) {}
            html5QrcodeRef.current = null;
          }

          const html5QrcodeFallback = new Html5Qrcode(elementId, {
            verbose: false,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.ITF
            ],
            useBarCodeDetectorIfSupported: true
          });
          html5QrcodeRef.current = html5QrcodeFallback;

          await html5QrcodeFallback.start(
            { facingMode: 'user' },
            {
              fps: 15,
              qrbox: (width, height) => ({
                width: Math.floor(width * 0.85),
                height: Math.floor(height * 0.50)
              })
            },
            (decodedText) => {
              if (decodedText) {
                const scanned = decodedText.trim();
                stopCamera();
                handleScannedBarcode(scanned);
              }
            },
            () => {}
          );
        } catch (innerErr: any) {
          console.error('All camera drivers failed:', innerErr);
          setHasCameraPermission(false);
          const errorMessage = innerErr?.message || String(innerErr);
          toast.error(`${t('No camera stream found.', 'No se pudo acceder a la cámara o permisos denegados.')} Error: ${errorMessage}`, {
            duration: 6000
          });
        }
      }
    }, 400); // 400ms ensures modal is fully active and #scanner-reader-element is ready in the DOM
  };

  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      const instance = html5QrcodeRef.current;
      html5QrcodeRef.current = null; // Unset immediately to prevent concurrent stop attempts
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
      } catch (err) {
        console.warn('Error stopping scanner instance:', err);
      }
    }
    if (cameraStream) {
      try {
        cameraStream.getTracks().forEach(track => track.stop());
      } catch (err) {}
      setCameraStream(null);
    }
  };

  // Close scanner completely
  const closeScanner = () => {
    stopCamera();
    setIsScanning(false);
  };

  // Statistics calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysOrders = useMemo(() => {
    return orders.filter(o => {
      const orderDate = new Date(o.fecha);
      return orderDate >= today && o.estado !== 'Cancelado';
    });
  }, [orders]);

  const salesTotal = useMemo(() => {
    return todaysOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [todaysOrders]);

  const orderCount = todaysOrders.length;

  // Filter products for search
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      (p.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.upc || '').includes(searchQuery) ||
      (p.boxBarcode || '').includes(searchQuery) ||
      (p.categoria || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  // Count products in each category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.categoria || 'Unassigned';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Filter categories for search
  const filteredCategories = useMemo(() => {
    return categories.filter(c => 
      (c.nombre || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  // Save product details
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.nombre || !productForm.precio) {
      toast.error(t('Field is empty', 'Campo vacío'));
      return;
    }

    if (!userStoreId) {
      toast.error(t('No active store detected', 'No se detectó un comercio activo'));
      return;
    }

    const payload: Product = {
      id: productForm.id || `PROD-${Date.now()}`,
      storeId: userStoreId,
      nombre: productForm.nombre,
      precio: Number(productForm.precio),
      costo: Number(productForm.costo || 0),
      categoria: productForm.categoria || categories[0]?.nombre || 'Otros',
      sku: productForm.sku || `SKU-${Date.now()}`,
      stock: Number(productForm.stock || 0),
      unitsPerBox: Number(productForm.unitsPerBox || 1),
      upc: productForm.upc || '',
      boxBarcode: productForm.boxBarcode || '',
      imagenUrl: productForm.imagenUrl || '',
      descuento: Number(productForm.descuento || 0)
    };

    try {
      await setDoc(doc(db, 'products', payload.id), payload, { merge: true });
      toast.success(t('Product saved successfully', 'Producto guardado con éxito'));
      
      // Update local state if needed
      setProducts(prev => {
        const idx = prev.findIndex(p => p.id === payload.id);
        if (idx >= 0) {
          const c = [...prev];
          c[idx] = payload;
          return c;
        }
        return [...prev, payload];
      });

      setEditingProduct(null);
      setIsAddingProduct(false);
    } catch (err) {
      console.error('Error saving product:', err);
      toast.error(t('Database write error', 'Error al escribir en la base de datos'));
    }
  };

  // Delete product
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm(t('Are you sure you want to delete this product?', '¿Estás seguro de que deseas eliminar este producto?'))) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success(t('Product deleted', 'Producto eliminado'));
      setProducts(prev => prev.filter(p => p.id !== id));
      setEditingProduct(null);
    } catch (err) {
      toast.error(t('Error deleting product', 'Error al eliminar producto'));
    }
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.nombre) return;

    const payload: Category = {
      id: categoryForm.id || `CAT-${Date.now()}`,
      storeId: userStoreId || 'SYSTEM',
      nombre: categoryForm.nombre,
      moduleType: 'grocery'
    };

    try {
      await setDoc(doc(db, 'categories', payload.id), payload, { merge: true });
      toast.success(t('Category saved', 'Categoría guardada'));

      setCategories(prev => {
        const idx = prev.findIndex(c => c.id === payload.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = payload;
          return clone;
        }
        return [...prev, payload];
      });

      setEditingCategory(null);
      setIsAddingCategory(false);
    } catch (err) {
      toast.error(t('Error writing category', 'Error al crear categoría'));
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 relative overflow-hidden font-sans border-x border-slate-200 shadow-2xl">
      {/* Top Header */}
      <header className="bg-[#0f172a] text-white px-5 py-4 shrink-0 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
            $
          </div>
          <span className="font-black text-lg tracking-wider uppercase">POS ADMIN</span>
        </div>
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Pane */}
      <main className="flex-1 overflow-y-auto pb-24 p-4 scrollbar-hide">
        <AnimatePresence mode="wait">
          {activeTab === 'inicio' && (
            <motion.div
              key="inicio"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Today's Sales Hero Card */}
              <div className="bg-emerald-600 outline-none text-white p-6 rounded-3xl shadow-xl shadow-emerald-500/10 flex flex-col justify-between relative overflow-hidden">
                <div className="space-y-1 z-10">
                  <span className="text-[11px] font-black tracking-widest text-emerald-100 uppercase">VENTAS DE HOY</span>
                  <h2 className="text-4xl font-extrabold tracking-tight">${salesTotal.toFixed(2)}</h2>
                </div>
                <div className="mt-4 flex items-center justify-between z-10">
                  <span className="text-xs bg-emerald-500/40 text-emerald-50 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {orderCount} {orderCount === 1 ? 'transacción' : 'transacciones'}
                  </span>
                  <TrendingUp className="w-7 h-7 text-emerald-150 animate-pulse" />
                </div>
                <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500 rounded-full -mr-12 -mt-12 opacity-30 transform scale-150 blur-2xl" />
              </div>

              {/* Home Shortcuts Dashboard Widgets */}
              <div className="grid grid-cols-2 gap-4">
                {/* Products Counter Card */}
                <button
                  onClick={() => setActiveTab('productos')}
                  className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-slate-200 shadow-sm text-left relative overflow-hidden group flex flex-col justify-between h-40 active:scale-95 transition-all duration-200"
                >
                  <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Package className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <span className="block text-3xl font-extrabold text-slate-800">{products.length}</span>
                    <span className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Productos</span>
                  </div>
                </button>

                {/* Categories Counter Card */}
                <button
                  onClick={() => setActiveTab('reportes')}
                  className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-slate-200 shadow-sm text-left relative overflow-hidden group flex flex-col justify-between h-40 active:scale-95 transition-all duration-200"
                >
                  <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-lg font-black text-slate-800">{t('Z-Report', 'Reportes')}</span>
                    <span className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Ver Z-Report</span>
                  </div>
                </button>
              </div>

              {/* Floor pricing instructions */}
              <div className="bg-slate-900 text-white p-5 rounded-3xl flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-slate-850 text-amber-400">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[13px] uppercase tracking-wider text-slate-300">MODO ESCÁNER DE PISO</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Utilice el botón central de cámara para escanear cualquier producto o caja en el piso del supermercado. Podrá cambiar sus precios o stock al instante sin ir a la oficina.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'productos' && (
            <motion.div
              key="productos"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Search / Filter box */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-2 pl-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder={t('Buscar productos...', 'Buscar productos...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-bold text-slate-700 placeholder-slate-400"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Green '+' float action button for mobile product adding */}
                <button
                  onClick={() => {
                    setProductForm({
                      id: `PROD-${Date.now()}`,
                      nombre: '',
                      precio: 0,
                      costo: 0,
                      categoria: categories[0]?.nombre || '',
                      stock: 100,
                      unitsPerBox: 12,
                      upc: '',
                      boxBarcode: '',
                      sku: `SKU-${Math.floor(Math.random() * 900000 + 100000)}`
                    });
                    setIsAddingProduct(true);
                  }}
                  className="w-12 h-12 bg-emerald-500 rounded-2xl text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-90 transition-all font-bold text-xl"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              {/* Product cards list */}
              <div className="space-y-2">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProductForm(p);
                      setEditingProduct(p);
                    }}
                    className="w-full bg-white p-3 rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm flex items-center justify-between text-left active:bg-slate-50 transition-all"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {/* Product Thumbnail image */}
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {p.imagenUrl ? (
                          <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="text-xl font-bold text-slate-400 uppercase">{p.nombre.charAt(0) || 'P'}</div>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-extrabold text-[#0f172a] text-sm truncate uppercase tracking-tight">{p.nombre}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase">
                            {p.upc || p.sku}
                          </span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${p.stock <= (p.threshold || 5) ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700'}`}>
                            Stock: {p.stock}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-black text-emerald-600 leading-none">${p.precio.toFixed(2)}</span>
                    </div>
                  </button>
                ))}

                {filteredProducts.length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200">
                    {t('No products found', 'No se encontraron productos')}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'categorias' && (
            <motion.div
              key="categorias"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-2 pl-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder={t('Buscar categorías...', 'Buscar categorías...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-bold text-slate-700 placeholder-slate-400"
                  />
                </div>
                <button
                  onClick={() => {
                    setCategoryForm({ nombre: '' });
                    setIsAddingCategory(true);
                  }}
                  className="w-12 h-12 bg-emerald-500 rounded-2xl text-white flex items-center justify-center shadow-lg active:scale-90 transition-all font-bold text-xl"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              {/* Categorías List */}
              <div className="space-y-2">
                {filteredCategories.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-lg">
                        🏷️
                      </div>
                      <div>
                        <h4 className="font-extrabold text-[#0f172a] text-[15px]">{c.nombre}</h4>
                        <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">
                          {categoryCounts[c.nombre] || 0} {categoryCounts[c.nombre] === 1 ? 'producto' : 'productos'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setCategoryForm(c);
                          setEditingCategory(c);
                        }}
                        className="p-2 bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'reportes' && (
            <motion.div
              key="reportes"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Report Header Title */}
              <div>
                <h3 className="text-xl font-black text-slate-850 uppercase tracking-tight">REPORTE Z</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Resumen financiero detallado diario</p>
              </div>

              {/* Daily sales report numbers card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-105 shadow-sm space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">RESUMEN DEL DÍA</span>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-sm font-bold text-slate-650">Ventas Totales</span>
                  <span className="text-2xl font-black text-emerald-600">${salesTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-sm font-bold text-slate-650">Transacciones</span>
                  <span className="text-base font-black text-slate-800">{orderCount}</span>
                </div>
              </div>

              {/* Recent Orders log */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">ÚLTIMAS TRANSACCIONES</h4>
                {todaysOrders.length === 0 ? (
                  <div className="text-center py-6 bg-white border border-slate-100 text-slate-400 text-xs font-bold rounded-2xl">
                    No hay transacciones registradas hoy.
                  </div>
                ) : (
                  todaysOrders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                            {o.factura || o.id.slice(0, 8)}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold uppercase">
                            {o.metodoPago || 'Cash'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">
                          {new Date(o.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {o.articulos?.length || 0} items
                        </p>
                      </div>
                      <span className="font-extrabold text-sm text-[#0f172a]">${o.total.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Barcode scanner overlay fullscreen view */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex flex-col justify-between p-6 overflow-hidden"
          >
            {/* Scanner header */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-white text-lg font-black uppercase tracking-wider">ESCÁNER DE CÁMÁRA</h3>
                <p className="text-slate-400 text-xs">Apunta el lente al código de barras o caja</p>
              </div>
              <button
                onClick={closeScanner}
                className="w-11 h-11 bg-white/15 rounded-full flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video center screen viewbox frame with laser scanning pulse */}
            <div className="flex-1 my-6 rounded-[2rem] border-4 border-slate-800 bg-slate-900 overflow-hidden relative flex flex-col items-center justify-center">
              {hasCameraPermission !== false ? (
                <div 
                  id="scanner-reader-element" 
                  className="w-full h-full min-h-[320px] rounded-[1.8rem] overflow-hidden bg-slate-950" 
                />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                  <p className="text-white text-sm font-bold">Lente de cámara bloqueado o inactivo</p>
                  <p className="text-slate-500 text-xs max-w-xs">Puedes ingresar el código manualmente abajo o simular usando la lista de pruebas.</p>
                </div>
              )}

              {/* Scanning red laser line */}
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-1 bg-rose-500 shadow-lg shadow-rose-500/50 animate-pulse z-10 pointer-events-none" />
            </div>

            {/* Simulated mock barcode scan selectors & manual entry input for high availability */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">PRUEBAS RÁPIDAS O MANUAL</span>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ingrese código de barra ej. 100015"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-sm text-white font-bold p-3 rounded-xl outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => {
                    if (manualBarcode.trim()) {
                      handleScannedBarcode(manualBarcode);
                      setManualBarcode('');
                    }
                  }}
                  className="bg-emerald-500 px-4 rounded-xl text-white font-extrabold active:scale-95 transition-all text-sm uppercase"
                >
                  Procesar
                </button>
              </div>

              {/* Click to simulate product mock scan quick actions */}
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-500 text-center uppercase tracking-widest">O SIMULAR ESCANEO RAPIDO (PRESIONAR):</p>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button 
                    onClick={() => handleScannedBarcode('100015')} 
                    className="p-2 border border-slate-800 hover:border-slate-700 bg-slate-850 rounded-lg text-emerald-400 font-bold text-[11px] uppercase tracking-wide truncate text-center"
                  >
                    Scanner Jamaica (100015)
                  </button>
                  <button 
                    onClick={() => handleScannedBarcode('100018')} 
                    className="p-2 border border-slate-800 hover:border-slate-700 bg-slate-850 rounded-lg text-emerald-400 font-bold text-[11px] uppercase tracking-wide truncate text-center"
                  >
                    Scanner Jarritos (100018)
                  </button>
                  <button 
                    onClick={() => handleScannedBarcode('100017')} 
                    className="p-2 border border-slate-800 hover:border-slate-700 bg-slate-850 rounded-lg text-emerald-400 font-bold text-[11px] uppercase tracking-wide truncate text-center"
                  >
                    Scanner Coca Cola (100017)
                  </button>
                  <button 
                    onClick={() => handleScannedBarcode('7501055300074')} 
                    className="p-2 border border-slate-800 hover:border-slate-700 bg-slate-850 rounded-lg text-blue-400 font-bold text-[11px] uppercase tracking-wide truncate text-center"
                  >
                    Scanner Código Nuevo (Demo)
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE ADD / EDIT PRODUCT MODAL SHEET (Slide up panel overlay) */}
      <AnimatePresence>
        {(editingProduct || isAddingProduct) && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed inset-x-0 bottom-0 top-16 bg-white z-40 rounded-t-[2.5rem] border-t-2 border-slate-200/50 shadow-2xl flex flex-col max-w-md mx-auto"
          >
            {/* Modal Heading */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black text-slate-850 uppercase tracking-tight">
                {isAddingProduct ? t('Add Mobile Product', 'Agregar Producto') : t('Edit Mobile Product', 'Editar Producto')}
              </h3>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsAddingProduct(false);
                }}
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form parameters fields */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Producto *</label>
                <input 
                  required
                  type="text" 
                  value={productForm.nombre || ''}
                  onChange={(e) => setProductForm({ ...productForm, nombre: e.target.value })}
                  placeholder="Ej. JARRITOS"
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-sm text-[#0f172a] focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio Venta ($) *</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={productForm.precio || ''}
                    onChange={(e) => setProductForm({ ...productForm, precio: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-sm text-[#0f172a] focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Compra ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={productForm.costo || ''}
                    onChange={(e) => setProductForm({ ...productForm, costo: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-sm text-[#0f172a] focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</label>
                <select
                  value={productForm.categoria || ''}
                  onChange={(e) => setProductForm({ ...productForm, categoria: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-sm text-[#0f172a] focus:bg-white focus:border-emerald-500 outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Stock breakdown in Boxes and Pieces */}
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/60 space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CONTROL INTERNO DE CAJAS & STOCK</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Piezas totales sueltas</label>
                    <input 
                      type="number" 
                      value={productForm.stock || 0}
                      onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-xl font-bold text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Piezas por caja</label>
                    <input 
                      type="number" 
                      value={productForm.unitsPerBox || 1}
                      onChange={(e) => setProductForm({ ...productForm, unitsPerBox: parseInt(e.target.value) || 1 })}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-xl font-bold text-xs"
                    />
                  </div>
                </div>

                {/* Intelligent units conversion explanation feedback */}
                {productForm.unitsPerBox && productForm.unitsPerBox > 1 && (
                  <div className="bg-emerald-50 text-emerald-800 text-[11px] p-2 rounded-xl font-bold flex items-center justify-between">
                    <span>Equivale a:</span>
                    <span>
                      {Math.floor((productForm.stock || 0) / productForm.unitsPerBox)} cajas, {(productForm.stock || 0) % productForm.unitsPerBox} piezas sueltas
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código Unidad (UPC)</label>
                  <input 
                    type="text" 
                    value={productForm.upc || ''}
                    onChange={(e) => setProductForm({ ...productForm, upc: e.target.value })}
                    placeholder="Ej. 100015"
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-xs text-[#0f172a] outline-none-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código Caja (Box Barcode)</label>
                  <input 
                    type="text" 
                    value={productForm.boxBarcode || ''}
                    onChange={(e) => setProductForm({ ...productForm, boxBarcode: e.target.value })}
                    placeholder="Ej. B-553"
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-xs text-[#0f172a] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">URL Imagen Ilustrativa (Opcional)</label>
                <input 
                  type="text" 
                  value={productForm.imagenUrl || ''}
                  onChange={(e) => setProductForm({ ...productForm, imagenUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-xs text-[#0f172a] outline-none"
                />
              </div>

              {/* Botones de acción final */}
              <div className="pt-4 flex gap-3 shrink-0">
                {!isAddingProduct && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(productForm.id!)}
                    className="w-12 h-12 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 text-white rounded-2xl h-12 font-black text-sm uppercase tracking-wide shadow-lg hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE ADD / EDIT CATEGORY MODAL SHEET */}
      <AnimatePresence>
        {(editingCategory || isAddingCategory) && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed inset-x-0 bottom-0 bg-white z-40 rounded-t-[2.5rem] border-t-2 border-slate-200/50 shadow-2xl p-6 space-y-4 max-w-md mx-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-850 uppercase tracking-tight">
                {isAddingCategory ? t('Nueva Categoría', 'Nueva Categoría') : t('Editar Categoría', 'Editar Categoría')}
              </h3>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setIsAddingCategory(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 pb-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre de la Categoría *</label>
                <input 
                  required
                  type="text" 
                  value={categoryForm.nombre || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nombre: e.target.value })}
                  placeholder="Ej. Frutas, Higiene..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-sm text-[#0f172a] focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 text-white rounded-2xl h-12 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar Categoría
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Navigation Tab bar with CAMERA Scanner FAB in middle */}
      <div className="absolute bottom-0 inset-x-0 bg-white border-t border-slate-100 h-20 px-4 flex items-center justify-between z-30 shadow-2xl">
        {/* Inicio Tab */}
        <button
          onClick={() => setActiveTab('inicio')}
          className={`flex-1 flex flex-col items-center justify-center text-center py-2 h-full ${activeTab === 'inicio' ? 'text-emerald-600 font-extrabold scale-102' : 'text-slate-400 font-bold'}`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'inicio' ? 'border-2 border-emerald-500/80 bg-emerald-50/50' : 'border-2 border-transparent'}`}>
            <Home className="w-5 h-5 flex-shrink-0" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold mt-1">Inicio</span>
        </button>

        {/* Productos Tab */}
        <button
          onClick={() => setActiveTab('productos')}
          className={`flex-1 flex flex-col items-center justify-center text-center py-2 h-full ${activeTab === 'productos' ? 'text-emerald-600 font-extrabold scale-102' : 'text-slate-400 font-bold'}`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'productos' ? 'border-2 border-emerald-500/80 bg-emerald-50/50' : 'border-2 border-transparent'}`}>
            <Package className="w-5 h-5 flex-shrink-0" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold mt-1">PRODUCTOS</span>
        </button>

        {/* Floating Scanner Action Center Item (FAB) */}
        <div className="flex-1 flex items-center justify-center -mt-8 shrink-0 relative">
          <button
            onClick={startCamera}
            className="w-16 h-16 rounded-full bg-[#0f172a] hover:bg-slate-800 text-white flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all outline-none border-4 border-slate-50 z-40 shrink-0"
          >
            <Camera className="w-6 h-6 shrink-0" />
          </button>
        </div>

        {/* Categorías Tab */}
        <button
          onClick={() => setActiveTab('categorias')}
          className={`flex-1 flex flex-col items-center justify-center text-center py-2 h-full ${activeTab === 'categorias' ? 'text-emerald-600 font-extrabold scale-102' : 'text-slate-400 font-bold'}`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'categorias' ? 'border-2 border-emerald-500/80 bg-emerald-50/50' : 'border-2 border-transparent'}`}>
            <Tags className="w-5 h-5 flex-shrink-0" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold mt-1">CATEGORÍAS</span>
        </button>

        {/* Reportes Tab */}
        <button
          onClick={() => setActiveTab('reportes')}
          className={`flex-1 flex flex-col items-center justify-center text-center py-2 h-full ${activeTab === 'reportes' ? 'text-emerald-600 font-extrabold scale-102' : 'text-slate-400 font-bold'}`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'reportes' ? 'border-2 border-emerald-500/80 bg-emerald-50/50' : 'border-2 border-transparent'}`}>
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold mt-1">REPORTES</span>
        </button>
      </div>
    </div>
  );
};
