import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Product, CartItem, Order, Client, Salesman, Category, Tax, Device, Inventory, StoreSettings, Vendor, PurchaseOrder, BusinessCategory, SelectedModifier, KitchenTicket } from './types';
import { INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_SALESMEN, INITIAL_CATEGORIES, INITIAL_TAXES, INITIAL_DEVICES, INITIAL_STORE_SETTINGS, INITIAL_VENDORS, INITIAL_PURCHASE_ORDERS, DEFAULT_BUSINESS_CATEGORIES } from './constants';
import Catalog from './components/Catalog';
import InvoiceModal from './components/InvoiceModal';
import ReceiveInventoryModal from './src/components/ReceiveInventoryModal';
import AdminDashboard from './components/AdminDashboard';
import { StoreSetup } from './components/StoreSetup';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import KitchenDisplay from './components/KitchenDisplay';
import { CustomerDisplay } from './components/CustomerDisplay';
import { KioskView } from './components/KioskView';
import { GroceryView } from './components/GroceryView';
import PinPad from './components/PinPad';
import InvoiceDisplay from './src/components/InvoiceDisplay';
import { LandingPage } from './components/LandingPage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, ShieldAlert, ShieldCheck, LogIn, LogOut, User as UserIcon, 
  Package, FileText, UserPlus, X, RefreshCw, Sparkles, Ticket, Phone, Pause, 
  Printer, ChefHat, Trash2, Plus, Minus, ChevronDown, ChevronUp, Monitor, 
  LayoutGrid, Building2, Link, Menu, History, Clock, FileBarChart, Settings, List, Grid, Delete, Tags, Tag, Archive
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, serverTimestamp, getDocFromServer, writeBatch, query, where, getDoc, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser, signInAnonymously } from 'firebase/auth';
import { CreateClientModal } from './components/CreateClientModal';
import { OrderListModal } from './components/OrderListModal';
import { FloatingOrderSummary } from './components/FloatingOrderSummary';
import { TicketPreview, InvoicePreview, KitchenTicketPreview } from './components/PrintPreviews';
import { CreditCard, DollarSign, Eye, EyeOff, Calculator } from 'lucide-react';
import { ZReportModal } from './components/ZReportModal';

const MainPOS: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<'catalog' | 'admin' | 'kitchen'>('catalog');
  const [showInvoice, setShowInvoice] = useState(false);
  const [showZReport, setShowZReport] = useState(false);
  const [printType, setPrintType] = useState<'customer' | 'kitchen' | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeSalesman, setActiveSalesman] = useState<Salesman | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [salesmen, setSalesmen] = useState<Salesman[]>(INITIAL_SALESMEN);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [taxes, setTaxes] = useState<Tax[]>(INITIAL_TAXES);
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_VENDORS);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receiveCart, setReceiveCart] = useState<CartItem[]>([]);
  const [pendingTipAmount, setPendingTipAmount] = useState<number>(0);
  const [isReceiveMode, setIsReceiveMode] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(INITIAL_PURCHASE_ORDERS);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isViewingOrders, setIsViewingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory | null>(null);
  const [showIntegratedTicket, setShowIntegratedTicket] = useState(true);
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<'Cash' | 'Credit' | 'Check' | 'Split' | ''>('');
  const [currentSeatId, setCurrentSeatId] = useState('1');
  const [seats, setSeats] = useState<string[]>(['1']);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [featuredProduct, setFeaturedProduct] = useState<Product | null>(null);

  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const [userStoreId, setUserStoreId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showStoreSetup, setShowStoreSetup] = useState(false);
  const [globalConfig, setGlobalConfig] = useState<{ announcement: string; maintenance: boolean }>({ announcement: '', maintenance: false });
  const [lastOrderData, setLastOrderData] = useState<Partial<Order> | null>(null);

  useEffect(() => {
    const unsubGlobal = onSnapshot(doc(db, 'system', 'config'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalConfig(snapshot.data() as any);
      }
    });
    return () => unsubGlobal();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (user) {
        try {
          const superAdminEmails = ['claudio.salvatore10@gmail.com', 'aristatell@gmail.com'];
          const isSuper = superAdminEmails.includes(user.email?.toLowerCase() || '');
          setIsSuperAdmin(isSuper);

          // Fetch or create user profile
          const userDocRef = doc(db, 'users', user.uid);
          let userDocSnap = await getDoc(userDocRef);
          
          if (!userDocSnap.exists() && user.email) {
            // Fallback: Check if Super Admin created a profile using email
            const emailQuery = query(collection(db, 'users'), where('email', '==', user.email));
            const emailDocsSnap = await getDocs(emailQuery);
            
            if (!emailDocsSnap.empty) {
              const emailDocData = emailDocsSnap.docs[0].data();
              const emailDocId = emailDocsSnap.docs[0].id;
              // Claim this profile: copy to UID doc
              await setDoc(userDocRef, {
                ...emailDocData,
                id: user.uid, // Update ID to UID
                claimedFrom: emailDocId,
                claimedAt: Date.now()
              });
              // Refresh the snap
              userDocSnap = await getDoc(userDocRef);
            }
          }
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (isSuper) {
              // Force Super Admin to SYSTEM store
              setUserStoreId('SYSTEM');
              setUserRole('admin');
              setShowStoreSetup(false);
            } else if (userData.storeId) {
              setUserStoreId(userData.storeId);
              setUserRole(userData.role || 'user');
              setShowStoreSetup(false);
            } else {
              setShowStoreSetup(true);
            }
          } else {
            // First time login
            if (isSuper) {
              const newUserData = {
                id: user.uid,
                email: user.email,
                nombre: user.displayName || 'Super Admin',
                storeId: 'SYSTEM',
                role: 'admin',
                activo: true,
                createdAt: Date.now()
              };
              await setDoc(userDocRef, newUserData);
              setUserStoreId('SYSTEM');
              setUserRole('admin');
              setShowStoreSetup(false);
            } else {
              setShowStoreSetup(true);
            }
          }
        } catch (error: any) {
          console.error("Auth state logic error:", error);
          toast.error(`Error loading profile: ${error.message}`);
          
          // Fallback if they are definitely superadmin but db failed
          const isSuperFallback = ['claudio.salvatore10@gmail.com', 'aristatell@gmail.com'].includes(user.email?.toLowerCase() || '');
          if (isSuperFallback) {
             console.log("Applying superadmin fallback to bypass DB error");
             setUserStoreId('SYSTEM');
             setUserRole('admin');
             setIsSuperAdmin(true);
             setShowStoreSetup(false);
          }
        }
      } else {
        setActiveSalesman(null);
        setView('catalog');
        setUserStoreId(null);
        setUserRole(null);
        setIsSuperAdmin(false);
        setShowStoreSetup(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Clear cart when store changes
  useEffect(() => {
    setCart([]);
    setReceiveCart([]);
  }, [userStoreId]);

  useEffect(() => {
    if (!isAuthReady || !user || !userStoreId) return;

    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'settings', userStoreId));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
          toast.error("Firebase connection failed. Check configuration.");
        }
      }
    };
    testConnection();

    // Sync Products
    const qProducts = query(collection(db, 'products'), where('storeId', '==', userStoreId));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(allProducts);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    // Sync Clients
    const qClients = query(collection(db, 'clients'), where('storeId', '==', userStoreId));
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      const allClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(allClients);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'clients'));

    // Sync Orders
    const qOrders = query(collection(db, 'orders'), where('storeId', '==', userStoreId));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        let parsedArticulos = [];
        if (typeof data.articulos === 'string') {
          try {
            parsedArticulos = JSON.parse(data.articulos);
          } catch (e) {
            console.error("Failed to parse articulos", e);
          }
        } else if (Array.isArray(data.articulos)) {
          parsedArticulos = data.articulos;
        }
        return { id: doc.id, ...data, articulos: parsedArticulos } as Order;
      });
      setOrders(allOrders);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

    let initializingSettings = false;

    // Sync Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', userStoreId), (docSnap) => {
      if (docSnap.exists()) {
        setStoreSettings(docSnap.data() as StoreSettings);
      } else {
        if (userStoreId === 'SYSTEM') {
          if (!initializingSettings) {
            initializingSettings = true;
            const newSettings = { ...INITIAL_STORE_SETTINGS, id: 'SYSTEM', nombre: 'System Admin' };
            setDoc(doc(db, 'settings', 'SYSTEM'), newSettings).catch(error => {
              console.error("Error creating system settings:", error);
            });
            setStoreSettings(newSettings);
          }
        } else {
          console.error("Store settings not found for:", userStoreId);
          // If a regular store is deleted, we flag it via settings so the UI can handle it
          setStoreSettings({ ...INITIAL_STORE_SETTINGS, isActive: false, name: 'Deleted Store' });
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `settings/${userStoreId}`));

    // Sync Inventory (Admins only)
    let unsubInventory: () => void = () => {};
    if (userRole === 'admin' || isSuperAdmin) {
      const qInventory = query(collection(db, 'inventory'), where('storeId', '==', userStoreId));
      unsubInventory = onSnapshot(qInventory, (snapshot) => {
        const allInventory = snapshot.docs.map(doc => {
          const data = doc.data();
          let parsedItems = [];
          if (typeof data.items === 'string') {
            try {
              parsedItems = JSON.parse(data.items);
            } catch (e) {
              console.error("Failed to parse items", e);
            }
          } else if (Array.isArray(data.items)) {
            parsedItems = data.items;
          }
          return { id: doc.id, ...data, items: parsedItems } as Inventory;
        });
        setInventory(allInventory);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'inventory'));
    }

    // Sync Purchase Orders (Admins only)
    let unsubPurchaseOrders: () => void = () => {};
    if (userRole === 'admin' || isSuperAdmin) {
      const qPO = query(collection(db, 'purchaseOrders'), where('storeId', '==', userStoreId));
      unsubPurchaseOrders = onSnapshot(qPO, (snapshot) => {
        const allPO = snapshot.docs.map(doc => {
          const data = doc.data();
          let parsedArticulos = [];
          if (typeof data.articulos === 'string') {
            try {
              parsedArticulos = JSON.parse(data.articulos);
            } catch (e) {
              console.error("Failed to parse articulos", e);
            }
          } else if (Array.isArray(data.articulos)) {
            parsedArticulos = data.articulos;
          }
          return { id: doc.id, ...data, articulos: parsedArticulos } as PurchaseOrder;
        });
        setPurchaseOrders(allPO);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'purchaseOrders'));
    }

    // Sync Salesmen
    const qSalesmen = query(collection(db, 'salesmen'), where('storeId', '==', userStoreId));
    const unsubSalesmen = onSnapshot(qSalesmen, (snapshot) => {
      const salesmenData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Salesman));
      console.log(`Synced ${salesmenData.length} salesmen for store ${userStoreId}`);
      setSalesmen(salesmenData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'salesmen'));

    // Sync Vendors
    const qVendors = query(collection(db, 'vendors'), where('storeId', '==', userStoreId));
    const unsubVendors = onSnapshot(qVendors, (snapshot) => {
      const allVendors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
      setVendors(allVendors);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'vendors'));

    // Sync Categories
    const qCategories = query(collection(db, 'categories'), where('storeId', '==', userStoreId));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      const allCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(allCategories);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'categories'));

    // Sync Taxes
    const qTaxes = query(collection(db, 'taxes'), where('storeId', '==', userStoreId));
    const unsubTaxes = onSnapshot(qTaxes, (snapshot) => {
      const allTaxes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tax));
      setTaxes(allTaxes);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'taxes'));

    // Sync Devices
    const qDevices = query(collection(db, 'devices'), where('storeId', '==', userStoreId));
    const unsubDevices = onSnapshot(qDevices, (snapshot) => {
      const allDevices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device));
      setDevices(allDevices);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'devices'));

    // Sync Business Category
    let unsubRubro: () => void = () => {};
    if (storeSettings.businessCategory) {
      unsubRubro = onSnapshot(doc(db, 'system', 'config', 'rubros', storeSettings.businessCategory), (snapshot) => {
        if (snapshot.exists()) {
          setBusinessCategory(snapshot.data() as BusinessCategory);
        } else {
          // Fallback to static if not found in db
          const fallback = DEFAULT_BUSINESS_CATEGORIES.find(c => c.id === storeSettings.businessCategory);
          setBusinessCategory(fallback as BusinessCategory || null);
        }
      }, (error) => {
        console.error("Error syncing rubro:", error);
        const fallback = DEFAULT_BUSINESS_CATEGORIES.find(c => c.id === storeSettings.businessCategory);
        setBusinessCategory(fallback as BusinessCategory || null);
      });
    } else {
      setBusinessCategory(null);
    }

    return () => {
      unsubProducts();
      unsubClients();
      unsubOrders();
      unsubSettings();
      unsubInventory();
      unsubPurchaseOrders();
      unsubSalesmen();
      unsubVendors();
      unsubCategories();
      unsubTaxes();
      unsubDevices();
      unsubRubro();
    };
  }, [isAuthReady, user, userStoreId, storeSettings.businessCategory]);

  useEffect(() => {
    if (userStoreId) {
      localStorage.setItem('last_store_id', userStoreId);
    }
  }, [userStoreId]);

  // Sync data to customer display
  useEffect(() => {
    if (!userStoreId) return;
    
    const currentCart = isReceiveMode ? receiveCart : cart;
    const subtotal = currentCart.reduce((acc, item) => {
      const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
      const itemPrice = isReceiveMode ? (item.costo || 0) : (item.precio || 0);
      if (!isReceiveMode && item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
        const q = item.cantidad || 1;
        const sets = Math.floor(q / item.promo.quantity);
        const remainder = q % item.promo.quantity;
        return acc + (sets * item.promo.price) + (remainder * (itemPrice + modifierTotal));
      }
      return acc + ((itemPrice + modifierTotal) * (item.cantidad || 1));
    }, 0);

    const taxesAppliedMap = new Map<string, { name: string, amount: number, rate: number }>();
    currentCart.forEach(item => {
      const itemPrice = isReceiveMode ? (item.costo || 0) : (item.precio || 0);
      const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
      let itemTotal = 0;
      if (!isReceiveMode && item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
        const q = item.cantidad || 1;
        const sets = Math.floor(q / item.promo.quantity);
        const remainderTotal = ((q % item.promo.quantity) * (itemPrice + modifierTotal)) * (1 - (item.descuento || 0) / 100);
        itemTotal = (sets * item.promo.price) + remainderTotal;
      } else {
        itemTotal = ((itemPrice) + modifierTotal) * (1 - (item.descuento || 0) / 100) * (item.cantidad || 1);
      }
      const category = categories.find(c => c.nombre === item.categoria);
      const appliedTaxes = (category && category.taxIds && category.taxIds.length > 0) 
        ? category.taxIds.map(tid => taxes.find(t => t.id === tid)).filter(Boolean) as Tax[]
        : taxes;
      appliedTaxes.forEach(tax => {
        const amount = itemTotal * ((tax.porcentaje || 0) / 100);
        if (taxesAppliedMap.has(tax.id)) {
          taxesAppliedMap.get(tax.id)!.amount += amount;
        } else {
          taxesAppliedMap.set(tax.id, { name: tax.nombre, amount, rate: tax.porcentaje || 0 });
        }
      });
    });

    const taxAmount = Array.from(taxesAppliedMap.values()).reduce((sum, t) => sum + t.amount, 0);
    const discount = currentCart.reduce((acc, item) => {
      const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
      const itemPrice = isReceiveMode ? (item.costo || 0) : (item.precio || 0);
      if (!isReceiveMode && item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
        const q = item.cantidad || 1;
        return acc + (((itemPrice + modifierTotal) * ((item.descuento || 0) / 100)) * (q % item.promo.quantity));
      }
      return acc + (((itemPrice + modifierTotal) * ((item.descuento || 0) / 100)) * (item.cantidad || 1));
    }, 0);

    const displayData = {
      cart: currentCart,
      subtotal,
      taxes: Array.from(taxesAppliedMap.values()),
      total: subtotal - discount + taxAmount,
      featuredProduct,
      storeSettings
    };
    localStorage.setItem('customer_display_data', JSON.stringify(displayData));
  }, [cart, receiveCart, featuredProduct, storeSettings, isReceiveMode, userStoreId, categories, taxes]);

  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showOrdersHistory, setShowOrdersHistory] = useState(false);
  const [showCustomerDisplay, setShowCustomerDisplay] = useState(false);
  const [showKitchen, setShowKitchen] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);

  const handleAddToCart = (product: Product, quantity: number = 1, selectedModifiers?: SelectedModifier[]) => {
    const currentCart = isReceiveMode ? receiveCart : cart;
    const setCurrentCart = isReceiveMode ? setReceiveCart : setCart;
    
    // Check if an item with the exact same modifiers and seatId already exists
    const existingItem = currentCart.find(item => 
      item.id === product.id && 
      item.seatId === currentSeatId &&
      JSON.stringify(item.selectedModifiers || []) === JSON.stringify(selectedModifiers || [])
    );

    if (existingItem) {
      setCurrentCart(currentCart.map(item => 
        item.cartId === existingItem.cartId ? { ...item, cantidad: item.cantidad + quantity } : item
      ));
    } else {
      setCurrentCart([...currentCart, { 
        ...product, 
        cartId: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
        cantidad: quantity,
        selectedModifiers,
        seatId: currentSeatId
      }]);
    }
    toast.success(`${product.nombre} added to ${isReceiveMode ? 'Receive Cart' : 'Cart'}`);
  };

  const handleUpdateQuantity = (cartId: string, cantidad: number) => {
    const currentCart = isReceiveMode ? receiveCart : cart;
    const setCurrentCart = isReceiveMode ? setReceiveCart : setCart;

    if (cantidad <= 0) {
      setCurrentCart(currentCart.filter(item => item.cartId !== cartId));
    } else {
      setCurrentCart(currentCart.map(item => 
        item.cartId === cartId ? { ...item, cantidad } : item
      ));
    }
  };

  const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeForFirestore(item));
    }
    if (typeof obj === 'object' && !(obj instanceof Date)) {
      const sanitized: any = {};
      Object.keys(obj).forEach(key => {
        if (!key || key.trim() === "") return;
        if (obj[key] !== undefined) {
          sanitized[key] = sanitizeForFirestore(obj[key]);
        }
      });
      return sanitized;
    }
    return obj;
  };

  const executePrint = (callback?: () => void) => {
    try {
      window.print();
    } catch (e) {
      console.error('Print failed:', e);
    } finally {
      if (callback) {
        setTimeout(callback, 500);
      }
    }
  };

  const handleCompleteOrder = async (orderData: Partial<Order>) => {
    if (storeSettings.trainingMode) {
      setCart([]);
      setShowInvoice(false);
      toast.info('Training Mode: Transaction not saved to database.');
      return;
    }

    // Trigger Print Flow IMMEDIATELY (Browser requires user-gesture context)
    flushSync(() => {
      setLastOrderData(orderData);
      setShowInvoice(false);
      setCart([]);
      setSeats(['1']);
      setCurrentSeatId('1');
      setSelectedClient(null);
      setPrintType('customer');
    });
    
    executePrint(() => {
      setPrintType(null);
      toast.success('Order completed successfully!');
    });

    // Run Firebase saves in the background
    try {
      const orderId = orderData.id || `ORD-${Date.now()}`;
      
      // Optimize articulos to reduce document size
      const optimizedArticulos = (orderData.articulos || []).map(item => ({
        id: item.id,
        nombre: item.nombre,
        precio: item.precio,
        costo: item.costo,
        cantidad: item.cantidad,
        lote: item.lote,
        vencimiento: item.vencimiento,
        sku: item.sku,
        upc: item.upc
      }));

      const newOrder: any = {
        ...orderData,
        id: orderId,
        storeId: storeSettings.id,
        fecha: Date.now(),
        articulos: JSON.stringify(optimizedArticulos) // Serialize optimized objects
      };
      
      const cleanOrder = sanitizeForFirestore(newOrder);
      const path = `orders/${orderId}`;
      
      try {
        await setDoc(doc(db, 'orders', orderId), cleanOrder);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }

      // Update stock for each item in the order
      const articulos = orderData.articulos || [];
      const productUpdates = articulos.flatMap((item) => {
        const product = products.find(p => p.id === item.id);
        if (!product) return [];
        
        if (product.promo?.type === 'combo' && product.promo.items) {
          return product.promo.items.map(async (comboItem) => {
            const subProduct = products.find(p => p.id === comboItem.productId);
            if (subProduct) {
              const newStock = subProduct.stock - (comboItem.cantidad * item.cantidad);
              return setDoc(doc(db, 'products', subProduct.id), { stock: newStock }, { merge: true }).catch(e => console.error(e));
            }
          });
        } else {
          const newStock = product.stock - item.cantidad;
          const pPath = `products/${product.id}`;
          return [setDoc(doc(db, 'products', product.id), { stock: newStock }, { merge: true }).catch(error => handleFirestoreError(error, OperationType.WRITE, pPath))];
        }
      });
      await Promise.all(productUpdates);
      
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error("Failed to save order updates in background.");
    }
  };

  const handleCompleteReceive = async (newInventory: Inventory) => {
    try {
      // Update products stock
      const productUpdates = (newInventory.items || []).map(async (item: any) => {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDocFromServer(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stock || 0;
          await setDoc(productRef, sanitizeForFirestore({ 
            stock: currentStock + item.cantidad,
            costo: item.costo
          }), { merge: true });
        }
      });
      
      await Promise.all(productUpdates);

      // Save inventory record
      const inventoryRecord = {
        ...newInventory,
        storeId: storeSettings.id,
        fecha: Date.now()
      };
      await setDoc(doc(db, 'inventory', newInventory.id), sanitizeForFirestore(inventoryRecord));
      
      setReceiveCart([]);
      setShowInvoice(false);
      setIsReceiveMode(false);
      toast.success('Inventory received successfully!');
    } catch (error) {
      console.error("Error receiving inventory:", error);
      toast.error("Failed to receive inventory.");
    }
  };

  const handleSaveClient = async (client: Client) => {
    try {
      const clientWithStore = { ...client, storeId: storeSettings.id };
      await setDoc(doc(db, 'clients', client.id), sanitizeForFirestore(clientWithStore));
      setClients([...clients, clientWithStore]);
      setIsCreatingClient(false);
      toast.success('Client added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `clients/${client.id}`);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'orders', id));
      setOrders(prev => prev.filter(o => o.id !== id));
      toast.success('Order deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${id}`);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      await setDoc(doc(db, 'orders', id), { estado: 'Pagado' }, { merge: true });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, estado: 'Pagado' } : o));
      toast.success('Order marked as paid');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const handleAutoRegister = async () => {
    try {
      await signInAnonymously(auth);
      toast.success('¡Registro de 48h exitoso! Configurando demo...');
    } catch (error: any) {
      console.error("Auto-registration failed:", error);
      if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
        toast.error('Auth anónima bloqueada. Actívala en Firebase > Authentication > Sign-in method > Anonymous.');
      } else {
        toast.error(`Error de registro automático: ${error.message}`);
      }
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully!');
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('Dominio no autorizado. Añade esta URL a Firebase Auth > Settings > Authorized domains.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('El popup fue cerrado. Si estás en el preview de AI Studio, intenta abrir la app en una nueva pestaña.');
      } else {
        toast.error(`Error al iniciar sesión: ${error.message || 'Error desconocido'}. Si estás en el preview, intenta usar el botón de arriba a la derecha para abrir en una nueva pestaña.`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveSalesman(null);
      setView('catalog');
      toast.info('Logged out.');
      // Update URL to force landing page view even if in iframe
      window.location.href = window.location.pathname + '?mode=landing';
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleRemoveItem = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
    setReceiveCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const handleSendToKitchen = async () => {
    const unsentItems = cart.filter(item => item.status !== 'Sent');
    if (unsentItems.length === 0) {
      toast.info('All items already sent to kitchen');
      return;
    }

    try {
      const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newTicket: KitchenTicket = {
        id: ticketId,
        storeId: userStoreId!,
        timestamp: Date.now(),
        items: unsentItems,
        status: 'pending',
        tableName: currentSeatId !== '1' ? currentSeatId : undefined,
        customerName: customerInfo.name || undefined
      };

      await setDoc(doc(db, 'kitchenTickets', ticketId), sanitizeForFirestore(newTicket));
      
      // Mark items as sent locally
      setCart(prev => prev.map(item => ({ ...item, status: 'Sent' })));
      
      toast.success('Order sent to kitchen!');

      // Trigger kitchen print
      flushSync(() => {
        setPrintType('kitchen');
      });
      executePrint(() => {
        setPrintType(null);
      });

    } catch (error) {
      console.error("Error sending to kitchen:", error);
      toast.error('Failed to send to kitchen');
    }
  };

  const handlePrintDraft = () => {
    toast.info('Printing order draft...');
    
    flushSync(() => {
      setPrintType('customer');
    });
    
    executePrint(() => {
      setPrintType(null);
    });
  };

  const handlePauseOrder = () => {
    toast.warning('Order paused.');
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isIframe = window !== window.parent;
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');

  if (!user) {
    if (mode !== 'login') {
      return <LandingPage onDemoSignup={handleAutoRegister} />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6 font-sans">
        {/* Abstract Background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
        </div>

        <div className="w-full max-w-[440px] relative">
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-12">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-8 transform hover:scale-105 transition-transform duration-500">
                <ShoppingCart className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-black tracking-tight mb-3">Enterprise POS</h1>
              <p className="text-slate-400 font-medium tracking-wide text-sm uppercase">Global SaaS Enterprise Portal</p>
            </div>

            {/* Content Slot */}
            <div className="space-y-8">
              {isIframe ? (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-8 text-center space-y-6">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Building2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">Central de Gestión Profesional</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Para acceder al panel de administración global con seguridad encriptada, abre Enterprise POS en una ventana completa.
                    </p>
                  </div>
                  <a 
                    href={window.location.href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 group"
                  >
                    Abrir Portal Profesional
                    <Link className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </a>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <button 
                      onClick={handleLogin}
                      className="flex items-center justify-center gap-4 w-full py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-xl active:scale-95 group border-none"
                    >
                      <svg className="w-6 h-6 transform group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Acceder con Google
                    </button>
                    
                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-slate-500">
                        <span className="bg-[#151c2f] px-4 font-bold">Secure Access Gateway</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-10 text-center">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
              V.01 Enterprise System • 2026 Admin Panel
            </p>
          </div>
        </div>
      </div>
    );
  }

              
  const isSuper = user?.email?.toLowerCase() === 'claudio.salvatore10@gmail.com' || user?.email?.toLowerCase() === 'aristatell@gmail.com';
  const effectiveIsSuperAdmin = isSuperAdmin || isSuper;

  if (effectiveIsSuperAdmin && userStoreId === 'SYSTEM') {
    return <SuperAdminDashboard onLogout={handleLogout} onSelectStore={(id) => setUserStoreId(id)} />;
  }

  if (globalConfig.maintenance && !effectiveIsSuperAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 p-8 text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-amber-500/20">
            <RefreshCw className="w-10 h-10 animate-spin-slow" />
          </div>
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight">System Maintenance</h1>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            We are currently performing scheduled updates to improve your experience. 
            Please check back in a few minutes.
          </p>
          <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
            <p className="text-amber-500 font-bold uppercase tracking-widest text-xs mb-2">Message from Admin</p>
            <p className="text-slate-300 italic">"{globalConfig.announcement || 'No additional details provided.'}"</p>
          </div>
        </div>
      </div>
    );
  }

  if (showStoreSetup) {
    return <StoreSetup user={user} onComplete={(id) => {
      setUserStoreId(id);
      setUserRole('admin');
      setShowStoreSetup(false);
    }} />;
  }

  if (view !== 'admin' && storeSettings?.isActive === false) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl text-center border border-red-100">
          <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-100 mx-auto mb-6">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">License Required</h1>
          <p className="text-gray-500 mb-8 font-medium">This application is not activated. Please contact support to obtain a valid license key.</p>
          <div className="p-4 bg-gray-50 rounded-xl mb-6 text-left">
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Store ID</p>
            <p className="font-mono text-sm text-gray-700">{storeSettings.id || 'N/A'}</p>
          </div>
          {(userRole === 'admin' || effectiveIsSuperAdmin) && (
            <button 
              onClick={() => setView('admin')}
              className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-3 mb-3"
            >
              Go to Admin Settings
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="w-full py-4 bg-white text-gray-500 font-bold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>
    );
  }

  if (!activeSalesman) {
    const salesmenToDisplay = salesmen.filter(s => {
      if (s.id === 'admin' && userRole === 'user' && !effectiveIsSuperAdmin) return false;
      return true;
    });
    if (effectiveIsSuperAdmin && !salesmenToDisplay.find(s => s.id === 'super-admin')) {
      salesmenToDisplay.push({
        id: 'super-admin',
        nombre: 'Super',
        apellido: 'Admin',
        codigo: 'SUPER-001',
        email: user?.email || '',
        telefono: '',
        direccion: '',
        ciudad: '',
        estado: '',
        cp: '',
        taxId: '',
        role: 'admin',
        activo: true,
        pin: '8888',
        storeId: userStoreId || 'SYSTEM'
      } as Salesman);
    }

    return (
      <PinPad 
        salesmen={salesmenToDisplay} 
        onLogin={(s) => {
          setActiveSalesman(s);
          toast.success(`Welcome, ${s.nombre}!`);
        }} 
      />
    );
  }

  if (view === 'kitchen') {
    return (
      <div className="h-screen flex flex-col">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView('catalog')}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-white font-black text-xl tracking-tight">Return to POS</h2>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <KitchenDisplay storeId={userStoreId || ''} isWholesale={businessCategory?.id === 'wholesale'} />
        </div>
      </div>
    );
  }

  if (view === 'admin') {
    return (
      <AdminDashboard 
        onBack={() => setView('catalog')}
        storeSettings={storeSettings}
        setStoreSettings={setStoreSettings}
        products={products}
        setProducts={setProducts}
        clients={clients}
        setClients={setClients}
        salesmen={salesmen}
        setSalesmen={setSalesmen}
        orders={orders}
        setOrders={setOrders}
        inventory={inventory}
        setInventory={setInventory}
        categories={categories}
        setCategories={setCategories}
        taxes={taxes}
        setTaxes={setTaxes}
        devices={devices}
        setDevices={setDevices}
        vendors={vendors}
        setVendors={setVendors}
        purchaseOrders={purchaseOrders}
        setPurchaseOrders={setPurchaseOrders}
        isSuperAdmin={isSuperAdmin}
        onBackToSuperAdmin={() => setUserStoreId('SYSTEM')}
      />
    );
  }

  const totalItems = (isReceiveMode ? receiveCart : cart).reduce((acc, item) => acc + item.cantidad, 0);
  
  const subtotal = (isReceiveMode ? receiveCart : cart).reduce((acc, item) => {
    const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
    const itemPrice = isReceiveMode ? (item.costo || 0) : (item.precio || 0);
    
    if (!isReceiveMode && item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
      const q = item.cantidad || 1;
      const sets = Math.floor(q / item.promo.quantity);
      const remainder = q % item.promo.quantity;
      return acc + (sets * item.promo.price) + (remainder * (itemPrice + modifierTotal));
    }
    
    return acc + ((itemPrice + modifierTotal) * (item.cantidad || 1));
  }, 0);
  const discount = (isReceiveMode ? receiveCart : cart).reduce((acc, item) => {
    const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
    const itemPrice = isReceiveMode ? (item.costo || 0) : (item.precio || 0);
    if (!isReceiveMode && item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
       // Typically promos don't combine with standard % discount, but let's apply discount on the remainder at least.
       const q = item.cantidad || 1;
       const remainder = q % item.promo.quantity;
       return acc + (((itemPrice + modifierTotal) * ((item.descuento || 0) / 100)) * remainder);
    }
    return acc + (((itemPrice + modifierTotal) * ((item.descuento || 0) / 100)) * (item.cantidad || 1));
  }, 0);

  let taxAmount = 0;
  const taxesAppliedMap = new Map<string, { name: string, amount: number, rate: number }>();

  (isReceiveMode ? receiveCart : cart).forEach(item => {
    const itemPrice = isReceiveMode ? (item.costo || 0) : (item.precio || 0);
    const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.precio || 0), 0);
    
    let itemTotal = 0;
    if (!isReceiveMode && item.promo?.type === 'quantity' && item.promo.quantity && item.promo.price) {
      const q = item.cantidad || 1;
      const sets = Math.floor(q / item.promo.quantity);
      const remainder = q % item.promo.quantity;
      const remainderTotal = (remainder * (itemPrice + modifierTotal)) * (1 - (item.descuento || 0) / 100);
      itemTotal = (sets * item.promo.price) + remainderTotal;
    } else {
      itemTotal = ((itemPrice) + modifierTotal) * (1 - (item.descuento || 0) / 100) * (item.cantidad || 1);
    }
    
    const category = categories.find(c => c.nombre === item.categoria);
    
    if (category && category.taxIds && category.taxIds.length > 0) {
      category.taxIds.forEach(taxId => {
        const tax = taxes.find(t => t.id === taxId);
        if (tax) {
          const amount = itemTotal * ((tax.porcentaje || 0) / 100);
          taxAmount += amount;
          
          if (taxesAppliedMap.has(tax.id)) {
            const existing = taxesAppliedMap.get(tax.id)!;
            existing.amount += amount;
          } else {
            taxesAppliedMap.set(tax.id, { name: tax.nombre, amount, rate: tax.porcentaje || 0 });
          }
        }
      });
    } else {
      taxes.forEach(tax => {
        const amount = itemTotal * ((tax.porcentaje || 0) / 100);
        taxAmount += amount;
        
        if (taxesAppliedMap.has(tax.id)) {
          const existing = taxesAppliedMap.get(tax.id)!;
          existing.amount += amount;
        } else {
          taxesAppliedMap.set(tax.id, { name: tax.nombre, amount, rate: tax.porcentaje || 0 });
        }
      });
    }
  });

  const taxesApplied = Array.from(taxesAppliedMap.values()).filter(t => t.rate > 0 || t.amount > 0);
  const taxRate = taxes.reduce((acc, tax) => acc + (tax.porcentaje || 0), 0);
  const totalCash = subtotal - discount + taxAmount;
  const creditSurcharge = storeSettings.creditSurcharge || 4;
  const totalCredit = totalCash * (1 + creditSurcharge / 100);

  const isWholesale = (selectedClient && selectedClient.terminosCredito && selectedClient.terminosCredito !== 'CASH/TODAY') ||
                      (businessCategory?.enabledFields?.printA4) ||
                      (businessCategory?.name?.toLowerCase().includes('wholesale')) ||
                      (storeSettings.nombre?.toLowerCase().includes('wholesale'));

  const displayFormat = (businessCategory?.id === 'restaurant' && !isWholesale) ? 'ticket' :
                        (businessCategory?.enabledFields?.printA4 ? 'invoice' : 
                        (businessCategory?.enabledFields?.thermal80mm ? 'ticket' : 
                        (isWholesale ? 'invoice' : (storeSettings.printFormat || 'ticket'))));

  return (
    <div className="flex flex-col h-screen bg-slate-100 relative overflow-hidden font-sans">
      <Toaster position="top-center" richColors />

      {/* Side Navigation Menu */}
      <AnimatePresence>
        {showSideMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSideMenu(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] print:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-[#0f172a] shadow-2xl z-[101] flex flex-col p-6 print:hidden"
            >
               <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                     <ShoppingCart className="w-5 h-5 flex-shrink-0" />
                   </div>
                   <div>
                      <h1 className="text-xl font-black text-white tracking-tight leading-none">{storeSettings.nombre || 'TakiPOS'}</h1>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Terminal Active</p>
                   </div>
                 </div>
                 <button onClick={() => setShowSideMenu(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                   <X className="w-6 h-6" />
                 </button>
               </div>

               <div className="flex-1 space-y-4 overflow-y-auto scrollbar-hide py-4">
                 <div className="space-y-2">
                   <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 ml-4">{t('Main Actions', 'Acciones Principales')}</p>
                   <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => { setIsViewingOrders(true); setShowSideMenu(false); }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white group transition-all"
                      >
                         <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileText className="w-5 h-5" />
                         </div>
                         <div className="flex-1 text-left">
                           <span className="block text-sm font-bold">{t('Orders', 'Pedidos')}</span>
                           <span className="block text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('Order History', 'Historial de Órdenes')}</span>
                         </div>
                      </button>

                      <button 
                        onClick={() => { setIsCreatingClient(true); setShowSideMenu(false); }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white group transition-all"
                      >
                         <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UserPlus className="w-5 h-5" />
                         </div>
                         <div className="flex-1 text-left">
                           <span className="block text-sm font-bold">{t('New Client', 'Nuevo Cliente')}</span>
                           <span className="block text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('Account Registry', 'Registro')}</span>
                         </div>
                      </button>

                      <button 
                        onClick={() => { window.open(window.location.origin + '#customer', '_blank'); setShowSideMenu(false); }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white group transition-all"
                      >
                         <div className="w-10 h-10 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Monitor className="w-5 h-5" />
                         </div>
                         <div className="flex-1 text-left">
                           <span className="block text-sm font-bold">{t('Customer Display', 'Pantalla Cliente')}</span>
                           <span className="block text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('Customer View', 'Vista del Cliente')}</span>
                         </div>
                      </button>

                      <button 
                        onClick={() => { window.open(window.location.origin + '#kiosk', '_blank'); setShowSideMenu(false); }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white group transition-all"
                      >
                         <div className="w-10 h-10 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <LayoutGrid className="w-5 h-5" />
                         </div>
                         <div className="flex-1 text-left">
                           <span className="block text-sm font-bold">{t('Kiosk Mode', 'Modo Kiosko')}</span>
                           <span className="block text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('Self Service', 'Autoservicio')}</span>
                         </div>
                      </button>
                      
                      <button 
                        onClick={() => { setIsReceiveMode(!isReceiveMode); setShowSideMenu(false); }}
                        className={`flex items-center gap-4 p-4 rounded-2xl group transition-all ${isReceiveMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                      >
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${isReceiveMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-sky-500/20 text-sky-400'}`}>
                            <Archive className="w-5 h-5" />
                         </div>
                         <div className="flex-1 text-left">
                           <span className="block text-sm font-bold">{isReceiveMode ? t('Exit Receive Mode', 'Salir de Recibir') : t('Receive Inventory', 'Recibir Inventario')}</span>
                           <span className="block text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('Vendor Invoices', 'Facturas de Proveedores')}</span>
                         </div>
                      </button>
                   </div>
                 </div>

                 <div className="pt-8 space-y-2">
                   <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 ml-4">{t('Management', 'Gestión')}</p>
                   {(userRole === 'admin' || effectiveIsSuperAdmin) && (
                     <div className="grid grid-cols-1 gap-3">
                        <button 
                          onClick={() => { setShowZReport(true); setShowSideMenu(false); }}
                          className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/10"
                        >
                           <Calculator className="w-5 h-5" />
                           <span className="text-sm font-bold">{t('Z-Report', 'Reporte Z')}</span>
                        </button>
                        <button 
                          onClick={() => { setView('admin'); setShowSideMenu(false); }}
                          className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all"
                        >
                           <ShieldAlert className="w-5 h-5" />
                           <span className="text-sm font-bold">{t('Admin Dashboard', 'Dashboard Admin')}</span>
                        </button>
                     </div>
                   )}
                 </div>
               </div>

               <div className="mt-auto pt-6 border-t border-white/5">
                 <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">
                       {activeSalesman?.nombre?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                       <p className="font-bold text-white text-sm truncate">{activeSalesman?.nombre} {activeSalesman?.apellido}</p>
                       <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest truncate">{activeSalesman?.codigo}</p>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-rose-400 transition-colors">
                       <LogOut className="w-5 h-5" />
                    </button>
                 </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Container */}
          {/* Main Top Header (Simplified for Retail/Wholesale/Grocery) */}
          {['grocery', 'retail', 'bodega', 'hardware'].includes(businessCategory?.id || '') ? (
            <div className="h-16 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between px-6 z-50 print:hidden shrink-0">
               <div className="flex items-center gap-6">
                 <button 
                  onClick={() => setShowSideMenu(true)}
                  className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-95 group"
                 >
                   <div className="flex flex-col gap-1 items-center">
                     <div className="w-5 h-0.5 bg-white rounded-full" />
                     <div className="w-4 h-0.5 bg-white rounded-full" />
                     <div className="w-5 h-0.5 bg-white rounded-full" />
                   </div>
                 </button>
                 
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4" />
                   </div>
                   <h1 className="text-lg font-black text-white tracking-tight">{storeSettings.nombre || 'TakiPOS'}</h1>
                 </div>
               </div>

               <div className="flex items-center gap-4">
                  {effectiveIsSuperAdmin && userStoreId !== 'SYSTEM' && (
                    <button 
                      onClick={() => setUserStoreId('SYSTEM')}
                      className="hidden sm:flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-xl transition-all border border-blue-500/20 font-black text-[10px] uppercase tracking-widest"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      SYSTEM ADMIN
                    </button>
                  )}
                  <div className="flex items-center gap-4 pl-4 border-l border-slate-800">
                     <div className="text-right">
                        <p className="text-[9px] font-black uppercase text-emerald-500 tracking-widest leading-none mb-1">Terminal Online</p>
                        <p className="text-white font-black tracking-tight leading-none">
                           {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                     </div>
                  </div>
               </div>
            </div>
          ) : (
            /* Standard Header for non-grocery (can refine later if needed) */
            <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 z-50 print:hidden shrink-0">
               {/* Simplified/Existing non-grocery header content */}
               <div className="flex items-center gap-4">
                  <button onClick={() => setShowSideMenu(true)} className="p-2 text-slate-400 hover:text-blue-600"><Menu className="w-6 h-6" /></button>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">{storeSettings.nombre}</h1>
               </div>
               <div className="flex items-center gap-4">
                  <button 
                     onClick={() => setShowIntegratedTicket(!showIntegratedTicket)}
                     className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 uppercase tracking-widest"
                  >
                     {showIntegratedTicket ? t('Hide Ticket', 'Ocultar Ticket') : t('Show Ticket', 'Ver Ticket')}
                  </button>
                  <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500"><LogOut className="w-5 h-5" /></button>
               </div>
            </div>
          )}

          <div className="flex-1 flex overflow-hidden print:hidden">
            {['grocery', 'retail', 'bodega', 'hardware'].includes(businessCategory?.id || '') ? (
              <GroceryView 
                products={products}
                categories={categories}
                cart={isReceiveMode ? receiveCart : cart}
                onAddToCart={handleAddToCart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onCheckout={(details) => {
                  if (isReceiveMode && details) {
                    if (receiveCart.length === 0) {
                      toast.error('The cart is empty. Add products first.');
                      return;
                    }
                    const newInventory: Inventory = {
                      id: `inv-${Date.now()}`,
                      storeId: userStoreId!,
                      proveedor: details.vendorId,
                      fecha: Date.now(),
                      factura: details.invoiceNumber,
                      articulos: receiveCart.reduce((acc, i) => acc + i.cantidad, 0),
                      total: receiveCart.reduce((acc, i) => acc + (i.costo * i.cantidad), 0),
                      estado: 'received',
                      items: receiveCart.map(item => ({
                        productId: item.id,
                        nombre: item.nombre,
                        cantidad: item.cantidad,
                        costo: item.costo,
                        unitsPerBox: item.unitsPerBox || 1
                      })),
                      checkNumber: details.checkRef,
                      metodoPago: details.checkRef ? 'Check' : '',
                    };
                    handleCompleteReceive(newInventory);
                    toast.success('Inventory received successfully');
                    setReceiveCart([]);
                  } else {
                    setShowInvoice(true);
                  }
                }}
                storeSettings={storeSettings}
                businessCategory={businessCategory}
                activeSalesman={activeSalesman}
                isReceiveMode={isReceiveMode}
                vendors={vendors}
              />
            ) : (
          <>
            <div className="flex-1 overflow-hidden">
              <Catalog 
                products={products} 
                cart={isReceiveMode ? receiveCart : cart}
                onAddToCart={handleAddToCart} 
                onUpdateQuantity={handleUpdateQuantity}
                isReceiveMode={isReceiveMode}
                clients={clients}
                selectedClient={selectedClient}
                onSelectClient={setSelectedClient}
                onToggleFeatured={(p) => setFeaturedProduct(featuredProduct?.id === p.id ? null : p)}
                featuredProductId={featuredProduct?.id}
                businessCategory={businessCategory}
                storeSettings={storeSettings}
              />
            </div>

            {showIntegratedTicket && !isReceiveMode && (
              <div className="w-[450px] border-l border-gray-200 bg-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4 bg-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-gray-900" />
                  <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg">{t('Current Order', 'Orden Actual')}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowCustomerForm(!showCustomerForm)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${showCustomerForm ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  >
                    <Phone className="w-3 h-3" />
                    {t('Call', 'Llamada')}
                  </button>
                  <button 
                    onClick={handlePauseOrder}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 font-black text-[10px] uppercase tracking-widest border border-gray-200 transition-all"
                  >
                    <Pause className="w-3 h-3" />
                    {t('Pause', 'Pausa')}
                  </button>
                </div>
              </div>

              {showCustomerForm && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-orange-50/50 rounded-2xl border border-orange-100 animate-in fade-in slide-in-from-top duration-300">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">{t('Name', 'Nombre')}</label>
                    <input 
                      type="text" 
                      placeholder={t('Client', 'Cliente')}
                      value={customerInfo.name}
                      onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      className="w-full bg-white border border-orange-100 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">{t('Phone', 'Teléfono')}</label>
                    <input 
                      type="text" 
                      placeholder="(000) 000-0000"
                      value={customerInfo.phone}
                      onChange={e => setCustomerInfo({ ...customerInfo, phone: formatPhoneNumber(e.target.value) })}
                      className="w-full bg-white border border-orange-100 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Seats / Boxes List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/30">
              {seats.map((seatId, index) => {
                const seatItems = cart.filter(item => item.seatId === seatId);
                const seatTotal = seatItems.reduce((acc, item) => {
                  const modifierTotal = (item.selectedModifiers || []).reduce((sum, mod) => sum + mod.precio, 0);
                  return acc + ((item.precio + modifierTotal) * item.cantidad);
                }, 0);
                const colors = ['bg-blue-600', 'bg-green-600', 'bg-orange-600', 'bg-purple-600', 'bg-pink-600'];
                const color = colors[index % colors.length];

                return (
                  <div key={seatId} className={`rounded-3xl border-2 overflow-hidden bg-white shadow-sm transition-all ${currentSeatId === seatId ? 'border-blue-500 ring-4 ring-blue-50' : 'border-gray-100'}`}>
                    <button 
                      onClick={() => setCurrentSeatId(seatId)}
                      className={`w-full px-5 py-3 flex justify-between items-center text-white font-black uppercase tracking-widest text-[10px] ${color}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border-2 border-white/50 flex items-center justify-center">
                          {currentSeatId === seatId && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        BOX {seatId}
                      </div>
                      <span className="text-sm">${seatTotal.toFixed(2)}</span>
                    </button>

                    <div className="p-2 space-y-2">
                      {seatItems.length > 0 ? (
                        seatItems.map((item) => (
                          <div key={item.cartId} className="bg-gray-50/50 rounded-2xl p-4 flex items-start justify-between group hover:bg-gray-100 transition-all">
                            <div className="flex gap-4 flex-1">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-gray-400 border border-gray-100 shadow-sm">
                                {item.cantidad}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-black text-gray-900 text-sm leading-tight uppercase">{item.nombre}</h4>
                                {item.descripcion && (
                                  <p className="text-[10px] text-gray-500 font-medium line-clamp-1">{item.descripcion}</p>
                                )}
                                {item.promo?.type === 'combo' && item.promo.items && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {item.promo.items.map((comboItem, cidx) => (
                                      <span key={cidx} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight">
                                        {comboItem.cantidad}x {comboItem.nombre}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {(item.selectedModifiers || []).map((mod, midx) => (
                                  <p key={midx} className="text-[10px] text-gray-400 font-bold italic">
                                    {mod.modifierName}
                                  </p>
                                ))}
                                <div className="mt-2 flex items-center gap-2 transition-all">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(item.cartId, item.cantidad - 1); }}
                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 shadow-sm transition-all"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(item.cartId, item.cantidad + 1); }}
                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 shadow-sm transition-all"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.cartId); }}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 shadow-sm transition-all"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <span className="font-black text-gray-900 text-sm">${((item.precio + (item.selectedModifiers || []).reduce((s, m) => s + m.precio, 0)) * item.cantidad).toFixed(2)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{t('No products', 'Sin productos')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button 
                onClick={() => {
                  const nextId = (seats.length + 1).toString();
                  setSeats([...seats, nextId]);
                  setCurrentSeatId(nextId);
                }}
                className="w-full py-4 rounded-3xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px]"
              >
                <Plus className="w-4 h-4" />
                {t('Add BOX', 'Añadir BOX')}
              </button>
            </div>

            {/* Totals & Actions */}
            <div className="p-3 pb-2 bg-white border-t border-gray-100 space-y-2">
              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  <span>{t('Subtotal', 'Subtotal')}</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <span>{t('TAX', 'Impuestos')} ({taxRate}%)</span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-lg font-black text-gray-900 uppercase tracking-tight">{t('Total', 'Total')}</span>
                  <span className="text-xl font-black text-gray-900">${totalCash.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button 
                  onClick={() => {
                    setCart([]);
                    setSelectedClient(null);
                    setCustomerInfo({ name: '', phone: '' });
                    setSeats(['1']);
                    setCurrentSeatId('1');
                    setReceiveCart([]);
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-700 transition shadow-lg shadow-red-100"
                  title={t('Clear Cart', 'Limpiar Carrito')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={handlePrintDraft}
                  className="flex flex-col items-center justify-center gap-1 py-2 bg-white border-2 border-gray-100 text-gray-900 rounded-xl font-black text-[9px] uppercase tracking-widest hover:border-gray-300 transition shadow-sm"
                  title={t('Print Ticket', 'Imprimir Ticket')}
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={handleSendToKitchen}
                  className="flex flex-col items-center justify-center gap-1 py-2 bg-orange-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-orange-700 transition shadow-lg shadow-orange-100"
                >
                  {businessCategory?.id === 'wholesale' ? <Package className="w-3.5 h-3.5" /> : <ChefHat className="w-3.5 h-3.5" />}
                  {businessCategory?.id === 'wholesale' ? t('Warehouse', 'Almacén') : t('Kitchen', 'Cocina')}
                </button>
              </div>

              <button 
                onClick={() => setShowInvoice(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl font-black text-base uppercase tracking-widest hover:bg-blue-700 transition shadow-xl shadow-blue-100 active:scale-95"
              >
                <CreditCard className="w-5 h-5" />
                {t('Checkout', 'Cobrar')} ${totalCash.toFixed(2)}
              </button>
            </div>
          </div>
        )}
      </>
    )}
  </div>

    {/* Floating Order Summary */}
    {!showIntegratedTicket && (
      <FloatingOrderSummary 
          cart={isReceiveMode ? receiveCart : cart}
          storeSettings={storeSettings}
          taxes={taxes}
          categories={categories}
          salesman={activeSalesman}
          client={selectedClient}
          businessCategory={businessCategory}
          isSuperAdmin={effectiveIsSuperAdmin}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onCheckout={(tipAmount) => {
            setPendingTipAmount(tipAmount || 0);
            setShowInvoice(true);
          }}
          onSendToKitchen={handleSendToKitchen}
          onPrint={handlePrintDraft}
          onPause={handlePauseOrder}
        />
      )}

      {showInvoice && !isReceiveMode && (
        <InvoiceModal 
          storeSettings={storeSettings}
          businessCategory={businessCategory}
          cart={cart}
          clients={clients}
          salesmen={salesmen}
          taxes={taxes}
          categories={categories}
          activeSalesmanId={activeSalesman?.id}
          isSuperAdmin={effectiveIsSuperAdmin}
          onClose={() => {
            setShowInvoice(false);
            setInitialPaymentMethod('');
            setPendingTipAmount(0);
          }}
          onComplete={handleCompleteOrder}
          onUpdateQuantity={handleUpdateQuantity}
          initialSelectedClient={selectedClient}
          onSelectClient={setSelectedClient}
          initialPaymentMethod={initialPaymentMethod}
          initialTipAmount={pendingTipAmount}
        />
      )}

      {showInvoice && isReceiveMode && (
        <ReceiveInventoryModal 
          vendors={vendors}
          products={products}
          onClose={() => setShowInvoice(false)}
          storeSettings={storeSettings}
          initialItems={receiveCart.map(item => ({
            productId: item.id,
            nombre: item.nombre,
            cantidad: item.cantidad,
            costo: item.costo,
            unitsPerBox: item.unitsPerBox || 1
          }))}
          onSave={handleCompleteReceive}
        />
      )}

      {showZReport && (
        <ZReportModal
          orders={orders}
          storeSettings={storeSettings}
          onClose={() => setShowZReport(false)}
        />
      )}

      {isCreatingClient && (
        <CreateClientModal 
          onClose={() => setIsCreatingClient(false)} 
          onSave={handleSaveClient} 
          salesmen={salesmen}
          activeSalesman={activeSalesman}
          isSuperAdmin={effectiveIsSuperAdmin}
        />
      )}

      {isViewingOrders && (
        <OrderListModal 
          orders={orders}
          salesmen={salesmen}
          clients={clients}
          activeSalesman={activeSalesman}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setIsViewingOrders(false)}
          onViewOrder={(o) => setSelectedOrder(o)}
          onDeleteOrder={handleDeleteOrder}
          onMarkAsPaid={handleMarkAsPaid}
        />
      )}

      {selectedOrder && (
        <InvoiceDisplay 
          order={selectedOrder}
          client={clients.find(c => c.id === selectedOrder.clienteId)}
          salesman={salesmen.find(s => s.id === selectedOrder.vendedorId)}
          storeSettings={storeSettings}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* Print-only Previews */}
      <div className="hidden print:block">
        {printType === 'kitchen' && (
          <KitchenTicketPreview 
            cart={(lastOrderData?.articulos as any[]) || cart}
            storeSettings={storeSettings}
            tableName={currentSeatId !== '1' ? currentSeatId : undefined}
            customerName={customerInfo.name || undefined}
          />
        )}
        {printType === 'customer' && (
          displayFormat === 'invoice' ? (
            <InvoicePreview 
              cart={(lastOrderData?.articulos as any[]) || cart}
              storeSettings={storeSettings}
              salesman={activeSalesman}
              client={selectedClient}
              subtotal={lastOrderData?.subtotal ?? subtotal}
              taxAmount={lastOrderData?.tax ?? taxAmount}
              taxesApplied={lastOrderData?.taxesApplied ?? taxesApplied}
              tipAmount={lastOrderData?.tip ?? 0}
              totalCash={lastOrderData?.total ?? totalCash}
              totalCredit={lastOrderData?.total ?? totalCredit}
              creditSurcharge={creditSurcharge}
              paymentMethod={lastOrderData?.metodoPago}
              splits={lastOrderData?.splits}
            />
          ) : (
            <TicketPreview 
              cart={(lastOrderData?.articulos as any[]) || cart}
              storeSettings={storeSettings}
              salesman={activeSalesman}
              client={selectedClient}
              subtotal={lastOrderData?.subtotal ?? subtotal}
              taxAmount={lastOrderData?.tax ?? taxAmount}
              taxesApplied={lastOrderData?.taxesApplied ?? taxesApplied}
              tipAmount={lastOrderData?.tip ?? 0}
              totalCash={lastOrderData?.total ?? totalCash}
              totalCredit={lastOrderData?.total ?? totalCredit}
              creditSurcharge={creditSurcharge}
              paymentMethod={lastOrderData?.metodoPago}
              splits={lastOrderData?.splits}
            />
          )
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [mode, setMode] = useState<'pos' | 'customer' | 'kiosk' | 'landing' | 'login'>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode') === 'login') return 'login';
    if (window.location.hash === '#customer') return 'customer';
    if (window.location.hash === '#kiosk') return 'kiosk';
    if (window.location.hash === '#pos') return 'pos';
    if (window.location.hash === '#login') return 'login';
    return 'landing';
  });

  useEffect(() => {
    const handleNavigation = () => {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('mode') === 'login') {
        setMode('login');
        return;
      }
      if (window.location.hash === '#customer') setMode('customer');
      else if (window.location.hash === '#kiosk') setMode('kiosk');
      else if (window.location.hash === '#login') setMode('login');
      else if (window.location.hash === '#pos') setMode('pos');
      else setMode('landing');
    };
    window.addEventListener('hashchange', handleNavigation);
    window.addEventListener('popstate', handleNavigation);
    return () => {
      window.removeEventListener('hashchange', handleNavigation);
      window.removeEventListener('popstate', handleNavigation);
    };
  }, []);

  if (mode === 'customer') return <CustomerDisplay />;
  if (mode === 'kiosk') return <KioskView />;
  if (mode === 'landing') {
    const handleAutoRegister = async (formData?: any) => {
      try {
        if (formData) {
          localStorage.setItem('quick_demo_data', JSON.stringify(formData));
        }
        await signInAnonymously(auth);
        toast.success('¡Registro de 48h exitoso! Configurando demo...');
        window.location.hash = '#pos';
      } catch (error: any) {
        console.error("Auto-registration failed:", error);
        if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
          toast.error('Auth anónima bloqueada. Actívala en Firebase > Authentication > Sign-in method > Anonymous.');
        } else {
          toast.error(`Error de registro automático: ${error.message}`);
        }
      }
    };
    return (
      <>
        <Toaster position="top-center" richColors />
        <LandingPage onDemoSignup={handleAutoRegister} />
      </>
    );
  }
  return <MainPOS />;
};

export default App;
