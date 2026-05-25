import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Users, Package, Settings, Search, Trash2, ShieldCheck, Sparkles, LogOut, RefreshCw, CheckCircle, XCircle, Plus, Minus, X, Tag, ListFilter, Upload, Download, CreditCard, FileText, TrendingUp, TrendingDown, DollarSign, Briefcase, FolderOpen, Send, Filter, Link, Power, Globe, Cpu, Activity } from 'lucide-react';
import { collection, onSnapshot, query, doc, deleteDoc, updateDoc, setDoc, getDocs, writeBatch, addDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { StoreSettings, User, BusinessCategory, Salesman, SuperAdminItem, SuperAdminInvoice, GlobalModifierGroup, MerchantRegistration } from '../types';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_STORE_SETTINGS, DEFAULT_BUSINESS_CATEGORIES } from '../constants';
import { toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";
import Papa from 'papaparse';
import { read, utils, writeFile } from 'xlsx';
import { LandingCMS } from './LandingCMS';
import { formatPhoneNumber, formatTaxId, formatSsn, numberToWordsSpanish, numberToWordsEnglish } from '../utils';

interface SuperAdminDashboardProps {
  onLogout: () => void;
  onSelectStore: (storeId: string) => void;
}

const ALL_RUBRO_FIELDS = [
  'upc', 'boxBarcode', 'unitsPerBox', 'nombre', 'precio', 'costo',
  'categoria', 'sku', 'lote', 'vencimiento', 'stock',
  'componenteActivo', 'laboratorio', 'unidad', 'descuento',
  'threshold', 'imagenUrl', 'descripcion', 'thermal80mm', 'printA4', 'modifiers', 'serialNumber', 'kiosk'
];

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout, onSelectStore }) => {
  const [activeTab, setActiveTab] = useState<'stores' | 'users' | 'updates' | 'catalog' | 'catalog_images' | 'rubros' | 'billing' | 'demos' | 'landing_cms' | 'merchants'>('stores');
  const [stores, setStores] = useState<StoreSettings[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [businessCategories, setBusinessCategories] = useState<BusinessCategory[]>([]);
  const [superAdminItems, setSuperAdminItems] = useState<SuperAdminItem[]>([]);
  const [superAdminInvoices, setSuperAdminInvoices] = useState<SuperAdminInvoice[]>([]);
  const [globalConfig, setGlobalConfig] = useState<{ announcement: string; maintenance: boolean }>({ announcement: '', maintenance: false });
  const [globalCatalog, setGlobalCatalog] = useState<any[]>([]);
  const [globalImages, setGlobalImages] = useState<any[]>([]);
  const [demoRequests, setDemoRequests] = useState<any[]>([]);
  const [merchantRegistrations, setMerchantRegistrations] = useState<MerchantRegistration[]>([]);
  const [salesReps, setSalesReps] = useState<Salesman[]>([]);
  const [merchantSubTab, setMerchantSubTab] = useState<'applications' | 'salesreps'>('applications');
  const [isAddingSalesRep, setIsAddingSalesRep] = useState(false);
  const [editingSalesRep, setEditingSalesRep] = useState<Salesman | null>(null);
  const [newSalesRepData, setNewSalesRepData] = useState({
    nombre: '',
    apellido: '',
    codigo: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    estado: '',
    cp: '',
    taxId: '',
    activo: true,
    posPrice: 350,
    commissionRate: 150,
    commissionType: 'fixed' as 'fixed' | 'percentage',
    ssn: '',
    taxClassification: '1099' as 'W2' | '1099',
    settlementFrequency: 'weekly' as 'weekly' | 'biweekly' | 'monthly',
  });
  const [selectedReg, setSelectedReg] = useState<MerchantRegistration | null>(null);
  const [settlementRep, setSettlementRep] = useState<Salesman | null>(null);
  const [overridePosUnits, setOverridePosUnits] = useState<number>(0);
  const [tempCommRate, setTempCommRate] = useState<number>(150);
  const [tempCommType, setTempCommType] = useState<'fixed' | 'percentage'>('fixed');
  const [tempPosPrice, setTempPosPrice] = useState<number>(350);
  const [customMemo, setCustomMemo] = useState<string>('Liquidación de Comisiones B2B POS Master');
  const [checkNumber, setCheckNumber] = useState<number>(1045);
  const [checkDate, setCheckDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activePreviewTab, setActivePreviewTab] = useState<'check' | 'stub'>('check');
  const [taxFitRate, setTaxFitRate] = useState<number>(12);
  const [taxSitRate, setTaxSitRate] = useState<number>(4);
  const [testingReg, setTestingReg] = useState<MerchantRegistration | null>(null);
  const [simTerminal, setSimTerminal] = useState<'Pax A920' | 'Dejavoo QD4' | 'Clover Flex'>('Pax A920');
  const [simAmount, setSimAmount] = useState<string>('150.00');
  const [simCardType, setSimCardType] = useState<'visa' | 'mc' | 'amex' | 'discover'>('visa');
  const [simMethod, setSimMethod] = useState<'tap' | 'chip' | 'swipe'>('chip');
  const [simStatus, setSimStatus] = useState<'idle' | 'inserting' | 'processing' | 'approved' | 'declined'>('idle');
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simCommissionRate, setSimCommissionRate] = useState<number>(0.4);
  const [simInterchange, setSimInterchange] = useState<number>(1.8);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingKey, setIsGeneratingKey] = useState<string | null>(null);
  const [isAddingGlobalProduct, setIsAddingGlobalProduct] = useState(false);
  const [isAddingRubro, setIsAddingRubro] = useState(false);
  const [newRubroName, setNewRubroName] = useState('');
  const [catalogFilterRubro, setCatalogFilterRubro] = useState<string>('all');
  const [isPushingCatalog, setIsPushingCatalog] = useState(false);
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [newStoreData, setNewStoreData] = useState({ nombre: '', email: '', businessCategory: '', subscriptionAmount: 0 });
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [editingStoreData, setEditingStoreData] = useState<StoreSettings | null>(null);
  const [isEditingDemo, setIsEditingDemo] = useState(false);
  const [editingDemoData, setEditingDemoData] = useState<any | null>(null);
  const [isAddingBillingItem, setIsAddingBillingItem] = useState(false);
  const [newBillingItem, setNewBillingItem] = useState<Partial<SuperAdminItem>>({ nombre: '', tipo: 'Equipo', costo: 0, precio: 0 });
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [invoiceStoreId, setInvoiceStoreId] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<{ itemId: string; cantidad: number }[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [pushTargetRubro, setPushTargetRubro] = useState<string>('');
  const [pushSelectedStores, setPushSelectedStores] = useState<string[]>([]);
  const [isPushingImages, setIsPushingImages] = useState(false);
  const [pushImageTargetStore, setPushImageTargetStore] = useState('');
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isSmartImporting, setIsSmartImporting] = useState(false);
  const [smartImportTargetStore, setSmartImportTargetStore] = useState<string>('');
  const smartImportInputRef = useRef<HTMLInputElement>(null);
  const [imageBankFolder, setImageBankFolder] = useState<string>('General');
  const [newGlobalProduct, setNewGlobalProduct] = useState({ nombre: '', precio: 0, categoria: 'Global', imagen: '', rubroId: '' });
  const globalCatalogInputRef = useRef<HTMLInputElement>(null);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  const handleSimulateTransaction = (approved: boolean) => {
    setSimStatus('processing');
    setSimLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Iniciando procesamiento en terminal ${simTerminal}...`,
      `[${new Date().toLocaleTimeString()}] Conectando con red de adquirencia usando protocolo seguro TLS 1.3...`,
      `[${new Date().toLocaleTimeString()}] Tokenizando credenciales de tarjeta (${simCardType.toUpperCase()}) vía chip/EMV...`
    ]);

    setTimeout(() => {
      if (approved) {
        setSimStatus('approved');
        setSimLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Resonancia EMV exitosa. Transmisión de datos autorizada.`,
          `[${new Date().toLocaleTimeString()}] RESPUESTA RED: APROBADO - CÓDIGO DE AUTORIZACIÓN: ${Math.floor(100000 + Math.random() * 900000)}`,
          `[${new Date().toLocaleTimeString()}] Registro de prueba completado con éxito. Depósito de garantía verificado.`
        ]);
        toast.success(`Pago de prueba de $${parseFloat(simAmount).toFixed(2)} APROBADO con Éxito`);
      } else {
        setSimStatus('declined');
        setSimLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ERROR DE TRANSACCIÓN: FONDOS INSUFICIENTES (051) o TARJETA DENEGADA.`,
          `[${new Date().toLocaleTimeString()}] RESPUESTA RED: RECHAZADO por el banco emisor.`,
          `[${new Date().toLocaleTimeString()}] Prueba completada: Simulación de fallo en cobro exitoso.`
        ]);
        toast.error(`Pago de prueba de $${parseFloat(simAmount).toFixed(2)} RECHAZADO por el banco emisor`);
      }
    }, 1500);
  };

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

  const handleClearGlobalCatalog = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Global Catalog',
      message: 'Are you sure you want to delete ALL products from the global catalog? This action cannot be undone.',
      type: 'danger',
      confirmText: 'Clear Catalog',
      onConfirm: async () => {
        setIsLoading(true);
        try {
          const snapshot = await getDocs(collection(db, 'system', 'catalog', 'products'));
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          toast.success('Global catalog cleared successfully.');
        } catch (error) {
          console.error("Error clearing global catalog:", error);
          toast.error('Failed to clear global catalog.');
        } finally {
          setIsLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleGlobalCatalogImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processProductsFile(file);
  };

  const handleImportFromUrl = async () => {
    if (!importUrl) return;
    setIsLoading(true);
    setShowUrlModal(false);
    try {
      const response = await fetch(importUrl);
      if (!response.ok) throw new Error('Failed to fetch data from URL');
      const text = await response.text();
      const file = new File([text], "sheets_import.csv", { type: "text/csv" });
      
      if (activeTab === 'catalog') {
        await processProductsFile(file);
      } else if (activeTab === 'catalog_images') {
        await processImagesFile(file);
      }
    } catch (error) {
      console.error("Error importing from URL:", error);
      toast.error("Failed to import from URL. Make sure it's a valid public CSV link.");
    } finally {
      setIsLoading(false);
      setImportUrl('');
    }
  };

  const processImagesFile = async (file: File) => {
    return new Promise<number>((resolve) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          let data: any[] = [];
          if (file.name.endsWith('.csv')) {
            const text = evt.target?.result as string;
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });
            data = result.data;
          } else {
            const bstr = evt.target?.result;
            const wb = read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            data = utils.sheet_to_json(ws);
          }

          if (data.length === 0) {
            toast.error(`No data found in ${file.name}`);
            resolve(0);
            return;
          }

          let successCount = 0;
          const batch = writeBatch(db);
          let batchCount = 0;

          for (const row of data) {
            if (!row.nombre || !row.url) continue;

            const newImage = {
              nombre: String(row.nombre).trim(),
              url: String(row.url).trim(),
              folder: row.folder ? String(row.folder).trim() : 'General',
              createdAt: Date.now()
            };

            const docRef = doc(collection(db, 'system', 'catalog', 'images'));
            batch.set(docRef, sanitizeForFirestore(newImage));
            successCount++;
            batchCount++;

            if (batchCount === 500) {
              await batch.commit();
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
          }

          toast.success(`Successfully imported ${successCount} images from Sheets`);
          resolve(successCount);
        } catch (error) {
          console.error("Error processing images file:", error);
          toast.error("Error processing file");
          resolve(0);
        }
      };
      reader.readAsText(file);
    });
  };

  const processProductsFile = async (file: File) => {
    return new Promise<number>((resolve) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          let data: any[] = [];
          if (file.name.endsWith('.csv')) {
            const text = evt.target?.result as string;
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });
            data = result.data;
          } else {
            const bstr = evt.target?.result;
            const wb = read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            data = utils.sheet_to_json(ws);
          }

          if (data.length === 0) {
            toast.error(`No data found in ${file.name}`);
            resolve(0);
            return;
          }

          const headerMap: Record<string, string> = {
            'nombre': 'nombre', 'name': 'nombre', 'product': 'nombre', 'producto': 'nombre',
            'precio': 'precio', 'price': 'precio',
            'categoria': 'categoria', 'category': 'categoria',
            'imagen': 'imagen', 'image': 'imagen', 'url': 'imagen', 'imagen url': 'imagen',
            'rubroid': 'rubroId', 'rubro': 'rubroId', 'business type': 'rubroId'
          };

          const batch = writeBatch(db);
          let count = 0;

          for (const item of data) {
            let mappedItem: any = {};
            Object.keys(item).forEach(key => {
              const trimmedKey = key.trim();
              if (!trimmedKey) return;
              const normalizedKey = trimmedKey.toLowerCase();
              const mappedKey = headerMap[normalizedKey];
              if (mappedKey) {
                mappedItem[mappedKey] = item[key];
              } else {
                const fallbackKey = normalizedKey.replace(/\s+/g, '');
                if (fallbackKey) mappedItem[fallbackKey] = item[key];
              }
            });

            const nombre = mappedItem.nombre;
            if (!nombre) continue;

            const precio = parseFloat(String(mappedItem.precio || '0').replace(/[^0-9.-]/g, '')) || 0;
            const categoria = mappedItem.categoria || 'Global';
            const rubroId = mappedItem.rubroId || (catalogFilterRubro === 'all' ? '' : catalogFilterRubro);
            const imagen = mappedItem.imagen || `https://picsum.photos/seed/${nombre}/400/400`;

            const productId = mappedItem.id || `GPROD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const productRef = doc(db, 'system/catalog/products', productId);

            batch.set(productRef, sanitizeForFirestore({
              ...mappedItem,
              id: productId,
              nombre,
              precio,
              categoria,
              rubroId,
              imagenUrl: imagen,
              createdAt: Date.now()
            }));
            count++;
          }

          await batch.commit();
          toast.success(`Imported ${count} products from ${file.name}`);
          resolve(count);
        } catch (error) {
          console.error('Error importing products:', error);
          toast.error(`Failed to import ${file.name}`);
          resolve(0);
        }
      };

      if (file.name.endsWith('.csv')) reader.readAsText(file);
      else reader.readAsBinaryString(file);
    });
  };

  const processModifiersFile = async (file: File) => {
    return new Promise<number>((resolve) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          let data: any[] = [];
          if (file.name.endsWith('.csv')) {
            const text = evt.target?.result as string;
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });
            data = result.data;
          } else {
            const bstr = evt.target?.result;
            const wb = read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            data = utils.sheet_to_json(ws);
          }

          const groupsMap = new Map<string, GlobalModifierGroup>();
          data.forEach((row: any) => {
            const groupName = row['Group Name'] || row['Grupo'] || row['nombre_grupo'] || row['Group'];
            if (!groupName) return;

            if (!groupsMap.has(groupName)) {
              groupsMap.set(groupName, {
                id: `GMOD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                nombre: groupName,
                required: String(row['Required'] || row['Requerido']).toLowerCase() === 'true' || String(row['Required'] || row['Requerido']).toLowerCase() === 'si',
                allowMultiple: String(row['Multiple'] || row['Multiple']).toLowerCase() === 'true' || String(row['Multiple'] || row['Multiple']).toLowerCase() === 'si',
                modifiers: []
              });
            }

            const group = groupsMap.get(groupName)!;
            group.modifiers.push({
              id: `MOD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              nombre: row['Modifier Name'] || row['Nombre'] || row['opcion'] || row['Modifier'],
              precio: parseFloat(row['Price'] || row['Precio'] || '0') || 0
            });
          });

          const batch = writeBatch(db);
          groupsMap.forEach((group) => {
            const groupRef = doc(db, 'system/catalog/modifiers', group.id);
            batch.set(groupRef, sanitizeForFirestore(group));
          });

          await batch.commit();
          toast.success(`Imported ${groupsMap.size} modifier groups from ${file.name}`);
          resolve(groupsMap.size);
        } catch (error) {
          console.error('Error importing modifiers:', error);
          toast.error(`Failed to import ${file.name}`);
          resolve(0);
        }
      };

      if (file.name.endsWith('.csv')) reader.readAsText(file);
      else reader.readAsBinaryString(file);
    });
  };

  const processSalesmenFile = async (file: File) => {
    if (!smartImportTargetStore) {
      toast.error(`Please select a target store to import salesmen from ${file.name}`);
      return 0;
    }
    return new Promise<number>((resolve) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          let data: any[] = [];
          if (file.name.endsWith('.csv')) {
            const text = evt.target?.result as string;
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });
            data = result.data;
          } else {
            const bstr = evt.target?.result;
            const wb = read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            data = utils.sheet_to_json(ws);
          }

          const batch = writeBatch(db);
          data.forEach((item: any) => {
            const salesmanId = item.id || `SALES-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const salesmanRef = doc(db, 'salesmen', salesmanId);
            batch.set(salesmanRef, sanitizeForFirestore({
              id: salesmanId,
              storeId: smartImportTargetStore,
              nombre: item.Nombre || item.nombre || item.FirstName || '',
              apellido: item.Apellido || item.apellido || item.LastName || '',
              codigo: String(item.Codigo || item.codigo || item.Code || ''),
              email: item.Email || item.email || '',
              telefono: formatPhoneNumber(String(item.Telefono || item.telefono || item.Phone || '')),
              activo: true,
              pin: String(item.PIN || item.pin || '1111')
            }));
          });
          await batch.commit();
          toast.success(`Imported ${data.length} salesmen to store ${smartImportTargetStore}`);
          resolve(data.length);
        } catch (error) {
          console.error('Error importing salesmen:', error);
          resolve(0);
        }
      };
      if (file.name.endsWith('.csv')) reader.readAsText(file);
      else reader.readAsBinaryString(file);
    });
  };

  const processSuppliersFile = async (file: File) => {
    if (!smartImportTargetStore) {
      toast.error(`Please select a target store to import suppliers from ${file.name}`);
      return 0;
    }
    return new Promise<number>((resolve) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          let data: any[] = [];
          if (file.name.endsWith('.csv')) {
            const text = evt.target?.result as string;
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });
            data = result.data;
          } else {
            const bstr = evt.target?.result;
            const wb = read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            data = utils.sheet_to_json(ws);
          }

          const batch = writeBatch(db);
          data.forEach((item: any) => {
            const vendorId = item.id || `VEND-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const vendorRef = doc(db, 'vendors', vendorId);
            batch.set(vendorRef, sanitizeForFirestore({
              id: vendorId,
              storeId: smartImportTargetStore,
              nombre: item.Nombre || item.nombre || item.Name || '',
              contacto: item.Contacto || item.contacto || item.Contact || '',
              telefono: formatPhoneNumber(String(item.Telefono || item.telefono || item.Phone || '')),
              email: item.Email || item.email || '',
              direccion: item.Direccion || item.direccion || item.Address || '',
              terminos: item.Terminos || item.terminos || item.Terms || ''
            }));
          });
          await batch.commit();
          toast.success(`Imported ${data.length} suppliers to store ${smartImportTargetStore}`);
          resolve(data.length);
        } catch (error) {
          console.error('Error importing suppliers:', error);
          resolve(0);
        }
      };
      if (file.name.endsWith('.csv')) reader.readAsText(file);
      else reader.readAsBinaryString(file);
    });
  };

  const processClientsFile = async (file: File) => {
    if (!smartImportTargetStore) {
      toast.error(`Please select a target store to import clients from ${file.name}`);
      return 0;
    }
    return new Promise<number>((resolve) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          let data: any[] = [];
          if (file.name.endsWith('.csv')) {
            const text = evt.target?.result as string;
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });
            data = result.data;
          } else {
            const bstr = evt.target?.result;
            const wb = read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            data = utils.sheet_to_json(ws);
          }

          const batch = writeBatch(db);
          data.forEach((item: any) => {
            const clientId = item.id || `CLI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const clientRef = doc(db, 'clients', clientId);
            batch.set(clientRef, sanitizeForFirestore({
              id: clientId,
              storeId: smartImportTargetStore,
              nombre: item.Nombre || item.nombre || item.Name || '',
              telefono: formatPhoneNumber(String(item.Telefono || item.telefono || item.Phone || '')),
              direccion: item.Direccion || item.direccion || item.Address || '',
              ciudad: item.Ciudad || item.ciudad || item.City || '',
              estado: item.Estado || item.estado || item.State || '',
              cp: String(item.CP || item.cp || item.Zip || ''),
              email: item.Email || item.email || '',
              vendedorAsignado: item.Vendedor || item.vendedor || '',
              terminosCredito: item.Terminos || item.terminos || 'Contado'
            }));
          });
          await batch.commit();
          toast.success(`Imported ${data.length} clients to store ${smartImportTargetStore}`);
          resolve(data.length);
        } catch (error) {
          console.error('Error importing clients:', error);
          resolve(0);
        }
      };
      if (file.name.endsWith('.csv')) reader.readAsText(file);
      else reader.readAsBinaryString(file);
    });
  };

  const handleSmartImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsSmartImporting(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.toLowerCase();

      if (fileName.includes('producto')) {
        await processProductsFile(file);
      } else if (fileName.includes('modifier')) {
        await processModifiersFile(file);
      } else if (fileName.includes('salesmen')) {
        await processSalesmenFile(file);
      } else if (fileName.includes('supplier')) {
        await processSuppliersFile(file);
      } else if (fileName.includes('client')) {
        await processClientsFile(file);
      }
    }
    
    setIsSmartImporting(false);
    toast.success('Smart Import process finished');
    if (smartImportInputRef.current) smartImportInputRef.current.value = '';
  };

  const downloadGlobalCatalogTemplate = () => {
    const template = [
      { nombre: 'Producto Ejemplo', precio: 10.50, categoria: 'General', imagen: 'https://link-a-imagen.com/foto.jpg', rubroId: 'RUBRO-ID' }
    ];
    const ws = utils.json_to_sheet(template);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, "global_catalog_template.xlsx");
  };

  const handleCreateRubro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRubroName) return;
    try {
      const id = `RUBRO-${Date.now()}`;
      const newRubro: BusinessCategory = {
        id,
        name: newRubroName,
        enabledFields: {
          upc: true, boxBarcode: true, unitsPerBox: true, nombre: true, precio: true, costo: true,
          categoria: true, sku: true, lote: true, vencimiento: true, stock: true,
          componenteActivo: true, laboratorio: true, unidad: true, descuento: true,
          threshold: true, imagenUrl: true, descripcion: true,
          thermal80mm: true, printA4: true, modifiers: true
        }
      };
      await setDoc(doc(db, 'system', 'config', 'rubros', id), sanitizeForFirestore(newRubro));
      setIsAddingRubro(false);
      setNewRubroName('');
      toast.success('Business type created!');
    } catch (error) {
      console.error("Error creating rubro:", error);
      toast.error("Failed to create business type");
    }
  };

  const handleUpdateStoreBusinessType = async (storeId: string, newCategoryId: string) => {
    setIsLoading(true);
    try {
      // 1. Update settings
      await setDoc(doc(db, 'settings', storeId), { businessCategory: newCategoryId }, { merge: true });

      // 2. Fetch existing store products and delete them
      const productsQuery = query(collection(db, 'products'), where('storeId', '==', storeId));
      const existingProductsSnap = await getDocs(productsQuery);
      
      const MAX_BATCH_SIZE = 450;
      let batch = writeBatch(db);
      let count = 0;
      
      for (const docSnap of existingProductsSnap.docs) {
        batch.delete(docSnap.ref);
        count++;
        if (count % MAX_BATCH_SIZE === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      if (count % MAX_BATCH_SIZE !== 0) {
        await batch.commit();
      }

      // 3. Clone new products from global catalog
      const productsToPush = globalCatalog.filter(p => p.rubroId === newCategoryId);
      if (productsToPush.length > 0) {
        batch = writeBatch(db);
        count = 0;
        for (const product of productsToPush) {
          const newDocRef = doc(collection(db, 'products'));
          const { id: _, ...productData } = product;
          batch.set(newDocRef, {
            ...productData,
            storeId,
            id: newDocRef.id,
            createdAt: Date.now()
          });
          count++;
          if (count % MAX_BATCH_SIZE === 0) {
            await batch.commit();
            batch = writeBatch(db);
          }
        }
        if (count % MAX_BATCH_SIZE !== 0) {
          await batch.commit();
        }
      }

      toast.success(`Business type updated and ${productsToPush.length} products synced.`);
    } catch (error: any) {
      console.error("Error updating business type:", error);
      toast.error(`Error updating business type: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushImagesToStore = async () => {
    if (!pushImageTargetStore) {
      toast.error("Please select a target store");
      return;
    }
    const folderImages = globalImages.filter(img => (img.folder || 'General') === imageBankFolder);
    if (folderImages.length === 0) {
      toast.error("No images in this folder to push");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch store's products
      const productsSnap = await getDocs(query(collection(db, 'products'), where('storeId', '==', pushImageTargetStore)));
      const storeProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Try to match images to products by name
      let matchCount = 0;
      let batch = writeBatch(db);
      
      folderImages.forEach(img => {
        // Image name might be "Hamburguesa.png" -> "Hamburguesa"
        const cleanImgName = img.name.replace(/\.[^/.]+$/, "").trim().toLowerCase();
        
        // Find matching product
        const matchedProduct = storeProducts.find(p => (p as any).nombre?.toLowerCase().includes(cleanImgName) || cleanImgName.includes((p as any).nombre?.toLowerCase()));
        
        if (matchedProduct) {
          batch.update(doc(db, 'products', matchedProduct.id), { imagenUrl: img.url });
          matchCount++;
        }
      });

      if (matchCount > 0) {
        await batch.commit();
        toast.success(`Matched and synced ${matchCount} images to products!`);
      } else {
        toast.error("No products matched the image names in this folder.");
      }
      setIsPushingImages(false);
    } catch (error) {
      console.error("Error pushing images:", error);
      toast.error("Failed to push images to store");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushCatalog = async () => {
    if (!pushTargetRubro) {
      toast.error("Please select a business type to push");
      return;
    }
    if (pushSelectedStores.length === 0) {
      toast.error("Please select at least one store");
      return;
    }

    const productsToPush = globalCatalog.filter(p => p.rubroId === pushTargetRubro);
    if (productsToPush.length === 0) {
      toast.error("No products found for this business type in global catalog");
      return;
    }

    setIsLoading(true);
    try {
      for (const storeId of pushSelectedStores) {
        const batch = writeBatch(db);
        for (const product of productsToPush) {
          const newDocRef = doc(collection(db, 'products'));
          const { id: _, ...productData } = product; // Remove global catalog ID
          batch.set(newDocRef, {
            ...productData,
            storeId,
            id: newDocRef.id,
            createdAt: Date.now()
          });
        }
        await batch.commit();
      }
      toast.success(`Catalog pushed to ${pushSelectedStores.length} stores!`);
      setIsPushingCatalog(false);
      setPushSelectedStores([]);
    } catch (error) {
      console.error("Error pushing catalog:", error);
      toast.error("Failed to push catalog");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGlobalProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'system', 'catalog', 'products'), {
        ...newGlobalProduct,
        imagen: newGlobalProduct.imagen || `https://picsum.photos/seed/${newGlobalProduct.nombre}/400/400`,
        createdAt: Date.now()
      });
      setIsAddingGlobalProduct(false);
      setNewGlobalProduct({ nombre: '', precio: 0, categoria: 'Global', imagen: '', rubroId: '' });
      toast.success('Product added to global catalog');
    } catch (error) {
      console.error("Error adding global product:", error);
      toast.error('Failed to add product.');
    }
  };

  const imageUploadInputRef = useRef<HTMLInputElement>(null);

  const processImageFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploadingImages(true);
    let successCount = 0;
    let errorCount = 0;

    const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<File> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Canvas to Blob failed'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }, 'image/jpeg', quality);
          };
          img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
      });
    };

    const uploadFile = async (originalFile: File) => {
      if (originalFile.size > 100 * 1024 * 1024) {
        throw new Error(`Image ${originalFile.name} is too large (Max 100MB)`);
      }

      let fileToUpload = originalFile;
      
      // Compress if larger than 500KB to ensure fallback works
      if (originalFile.size > 500 * 1024) {
        try {
          fileToUpload = await compressImage(originalFile);
        } catch (err) {
          console.warn("Image compression failed, using original file", err);
        }
      }

      let url = '';
      let storagePath = '';

      try {
        const storageRef = ref(storage, `catalog/images/${imageBankFolder}/${Date.now()}_${fileToUpload.name}`);
        
        // Add a timeout to prevent hanging if Firebase Storage is not configured or unreachable
        const uploadPromise = async () => {
          await uploadBytes(storageRef, fileToUpload);
          return await getDownloadURL(storageRef);
        };
        
        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Storage upload timeout')), 8000)
        );

        url = await Promise.race([uploadPromise(), timeoutPromise]);
        storagePath = storageRef.fullPath;
      } catch (storageError: any) {
        console.warn("Firebase Storage upload failed, attempting Base64 fallback:", storageError);
        if (fileToUpload.size <= 1024 * 1024) {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(fileToUpload);
          });
          url = base64;
          storagePath = 'base64_fallback';
        } else {
          throw new Error(`Storage upload failed and file is too large for fallback (${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB).`);
        }
      }

      await addDoc(collection(db, 'system', 'catalog', 'images'), {
        name: fileToUpload.name,
        url,
        storagePath,
        folder: imageBankFolder,
        createdAt: Date.now()
      });
    };

    // Process in batches of 5 to avoid overwhelming the network
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(f => uploadFile(f)));
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          console.error("Error uploading image:", result.reason);
          errorCount++;
        }
      });
    }

    setIsUploadingImages(false);
    if (successCount > 0) toast.success(`Uploaded ${successCount} images to global bank`);
    if (errorCount > 0) toast.error(`Failed to upload ${errorCount} images`);
    if (imageUploadInputRef.current) imageUploadInputRef.current.value = '';
  };

  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    await processImageFiles(files);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      await processImageFiles(files);
    }
  };

  useEffect(() => {
    // Super Admin can see all settings (stores)
    const unsubStores = onSnapshot(collection(db, 'settings'), (snapshot) => {
      const allStores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreSettings));
      setStores(allStores);
      setIsLoading(false);
    });

    // Super Admin can see all users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(allUsers);
    });

    // Global Config
    const unsubGlobal = onSnapshot(doc(db, 'system', 'config'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalConfig(snapshot.data() as any);
      }
    });

    // Global Catalog
    const unsubCatalog = onSnapshot(collection(db, 'system', 'catalog', 'products'), (snapshot) => {
      setGlobalCatalog(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Global Images
    const unsubImages = onSnapshot(collection(db, 'system', 'catalog', 'images'), (snapshot) => {
      setGlobalImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Business Categories
    const unsubRubros = onSnapshot(collection(db, 'system', 'config', 'rubros'), (snapshot) => {
      let merged = [...DEFAULT_BUSINESS_CATEGORIES];
      if (!snapshot.empty) {
        const dbRubros = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessCategory));
        dbRubros.forEach(r => {
          const index = merged.findIndex(m => m.id === r.id);
          if (index >= 0) {
            // Keep default properties like name if they are missing in the db document
            merged[index] = { 
              ...merged[index], 
              ...r,
              enabledFields: {
                ...merged[index].enabledFields,
                ...(r.enabledFields || {})
              }
            };
          } else {
            merged.push(r);
          }
        });
      }
      setBusinessCategories(merged as BusinessCategory[]);
    });

    // Super Admin Items (Equipment/Services)
    const unsubSAItems = onSnapshot(collection(db, 'system', 'billing', 'items'), (snapshot) => {
      setSuperAdminItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SuperAdminItem)));
    });

    // Super Admin Invoices
    const unsubSAInvoices = onSnapshot(collection(db, 'system', 'billing', 'invoices'), (snapshot) => {
      setSuperAdminInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SuperAdminInvoice)));
    });

    // Demo Requests
    const unsubDemoRequests = onSnapshot(collection(db, 'demoRequests'), (snapshot) => {
      setDemoRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Merchant Onboarding Registrations
    const unsubMerchants = onSnapshot(collection(db, 'merchantRegistrations'), (snapshot) => {
      setMerchantRegistrations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MerchantRegistration)));
    });

    // Salesmen/Sales Reps for onboarding assignment
    const unsubSalesmen = onSnapshot(collection(db, 'salesreps'), (snapshot) => {
      setSalesReps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Salesman)));
    });

    return () => {
      unsubStores();
      unsubUsers();
      unsubGlobal();
      unsubCatalog();
      unsubImages();
      unsubRubros();
      unsubSAItems();
      unsubSAInvoices();
      unsubDemoRequests();
      unsubMerchants();
      unsubSalesmen();
    };
  }, []);

  const updateGlobalConfig = async (updates: Partial<typeof globalConfig>) => {
    try {
      await setDoc(doc(db, 'system', 'config'), sanitizeForFirestore(updates), { merge: true });
      toast.success('Global configuration updated!');
    } catch (error) {
      console.error("Error updating global config:", error);
      toast.error('Failed to update global configuration.');
    }
  };

  const handleDeleteStore = (storeId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Entidad',
      message: `¿Estás seguro de que deseas eliminar permanentemente la entidad ${storeId}? Se borrarán configuraciones básicos. Para un borrado completo de datos (productos, clientes), contacte a soporte técnico o use el módulo de limpieza.`,
      type: 'danger',
      confirmText: 'Eliminar permanentemente',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          
          // Delete store settings
          batch.delete(doc(db, 'settings', storeId));
          
          // Delete admin salesman
          batch.delete(doc(db, 'salesmen', `ADM-${storeId}`));
          
          // Try to delete primary sub-collections or at least logs?
          // Note: Full data wipe would require recursive deletion of all collection groups, 
          // which is best done via Cloud Functions or a more complex client loop.
          // For now, we clear the identification documents.
          
          await batch.commit();
          toast.success('Entidad eliminada de la red global exitosamente');
        } catch (error: any) {
          console.error("Deletion error:", error);
          if (error.code === 'permission-denied') {
            toast.error('Error de seguridad: Tu sesión no tiene permisos Master para esta operación. Reingresa si el problema persiste.');
          } else {
            toast.error(`Error al eliminar: ${error.message || 'Error desconocido'}`);
          }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const updateLicenseKey = async (storeId: string, newKey: string) => {
    try {
      await setDoc(doc(db, 'settings', storeId), { licenseKey: newKey }, { merge: true });
      toast.success('License key updated.');
    } catch (error) {
      console.error("Error updating license key:", error);
      toast.error('Failed to update license key.');
    }
  };

  const handleCreateBillingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBillingItem.nombre) return;
    try {
      const id = `ITEM-${Date.now()}`;
      await setDoc(doc(db, 'system', 'billing', 'items', id), sanitizeForFirestore({
        ...newBillingItem,
        id
      }));
      setIsAddingBillingItem(false);
      setNewBillingItem({ nombre: '', tipo: 'Equipo', costo: 0, precio: 0 });
      toast.success('Billing item created!');
    } catch (error) {
      console.error("Error creating billing item:", error);
      toast.error("Failed to create billing item");
    }
  };

  const handleCreateSuperAdminInvoice = async () => {
    if (!invoiceStoreId || invoiceItems.length === 0) {
      toast.error("Please select a store and at least one item");
      return;
    }

    try {
      const id = `SA-INV-${Date.now()}`;
      const articulos = invoiceItems.map(ii => {
        const item = superAdminItems.find(sai => sai.id === ii.itemId);
        return {
          itemId: ii.itemId,
          nombre: item?.nombre || 'Unknown',
          cantidad: ii.cantidad,
          costo: item?.costo || 0,
          precio: item?.precio || 0
        };
      });

      const total = articulos.reduce((acc, art) => acc + (art.precio * art.cantidad), 0);

      const invoice: SuperAdminInvoice = {
        id,
        storeId: invoiceStoreId,
        fecha: Date.now(),
        articulos,
        total,
        estado: 'Pendiente'
      };

      await setDoc(doc(db, 'system', 'billing', 'invoices', id), sanitizeForFirestore(invoice));
      setIsCreatingInvoice(false);
      setInvoiceStoreId('');
      setInvoiceItems([]);
      toast.success('Invoice generated successfully!');
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice");
    }
  };

  const updateStoreSubscription = async (storeId: string, amount: number) => {
    try {
      await setDoc(doc(db, 'settings', storeId), { subscriptionAmount: amount }, { merge: true });
      toast.success('Subscription amount updated');
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast.error('Failed to update subscription.');
    }
  };

  const handleCreateStore = async () => {
    if (!newStoreData.nombre) {
      toast.error("Store name is required");
      return;
    }

    try {
      // Calculate next consecutive ID
      const strIds = stores
        .map(s => s.id)
        .filter(id => id && id.startsWith('STR-'))
        .map(id => {
          const parts = id.split('-');
          return parts.length > 1 ? parseInt(parts[1]) : 0;
        })
        .filter(num => !isNaN(num));
      
      const nextNum = strIds.length > 0 ? Math.max(...strIds) + 1 : 1;
      const storeId = `STR-${String(nextNum).padStart(5, '0')}`;

      const storeSettings: StoreSettings = {
        id: storeId,
        nombre: newStoreData.nombre,
        email: newStoreData.email,
        direccion: '',
        telefono: '',
        logoUrl: '',
        trainingMode: false,
        isActive: true,
        licenseKey: `LIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        businessCategory: newStoreData.businessCategory || undefined,
        subscriptionAmount: newStoreData.subscriptionAmount || 0
      };

      const baseBatch = writeBatch(db);
      let opsCount = 0;
      let batches = [baseBatch];
      
      const getBatch = () => {
        if (opsCount >= 490) {
          const newBatch = writeBatch(db);
          batches.push(newBatch);
          opsCount = 0;
        }
        opsCount++;
        return batches[batches.length - 1];
      };

      getBatch().set(doc(db, 'settings', storeId), sanitizeForFirestore(storeSettings));
      
      // Create a default admin salesman for the store so it's not empty
      const adminSalesman: Salesman = {
        id: `ADM-${storeId}`,
        storeId: storeId,
        nombre: 'Admin',
        apellido: newStoreData.nombre,
        codigo: 'ADMIN',
        email: newStoreData.email || '',
        telefono: '',
        direccion: '',
        ciudad: '',
        estado: '',
        cp: '',
        taxId: '',
        activo: true,
        pin: '1111' // Default pin
      };

      getBatch().set(doc(db, 'salesmen', `ADM-${storeId}`), sanitizeForFirestore(adminSalesman));

      // Also create a user record for the admin if email is provided
      if (newStoreData.email) {
        const userRecord: User = {
          id: newStoreData.email.replace(/\./g, '_'),
          storeId: storeId,
          nombre: 'Admin ' + newStoreData.nombre,
          email: newStoreData.email,
          role: 'admin',
          activo: true,
          createdAt: Date.now()
        };
        getBatch().set(doc(db, 'users', userRecord.id), sanitizeForFirestore(userRecord));
      }
      
      // Seed Demo Data
      INITIAL_CATEGORIES.forEach(cat => {
        const ref = doc(db, 'categories', `CAT-${Math.random().toString(36).substr(2, 5)}`);
        getBatch().set(ref, { ...cat, id: ref.id, storeId });
      });
      
      if (newStoreData.businessCategory) {
        const productsToPush = globalCatalog.filter(p => p.rubroId === newStoreData.businessCategory);
        productsToPush.forEach(p => {
          const ref = doc(db, 'products', `PROD-${Math.random().toString(36).substr(2, 5)}`);
          const { id: _, ...productData } = p;
          getBatch().set(ref, { ...productData, id: ref.id, storeId });
        });
      } else {
        INITIAL_PRODUCTS.slice(0, 10).forEach(p => {
          const ref = doc(db, 'products', `PROD-${Math.random().toString(36).substr(2, 5)}`);
          getBatch().set(ref, { ...p, id: ref.id, storeId });
        });
      }
      
      for (const batch of batches) {
        await batch.commit();
      }
      
      toast.success(`Store "${newStoreData.nombre}" created successfully with ID ${storeId}!`);
      setIsAddingStore(false);
      setNewStoreData({ nombre: '', email: '', businessCategory: '' });
    } catch (error) {
      console.error("Error creating store:", error);
      toast.error("Failed to create store");
    }
  };

  const handleUpdateStore = async () => {
    if (!editingStoreData || !editingStoreData.nombre || !editingStoreData.id) {
      toast.error("Valid store name and ID are required");
      return;
    }

    try {
      // Find old store data to check if email changed
      const oldStore = stores.find(s => s.id === editingStoreData.id);
      
      await setDoc(doc(db, 'settings', editingStoreData.id), sanitizeForFirestore(editingStoreData), { merge: true });

      // If email changed, we should update the users collection
      if (oldStore &&  oldStore.email !== editingStoreData.email && editingStoreData.email) {
        // Create new user record
        const newUserRecord: User = {
          id: editingStoreData.email.replace(/\./g, '_'),
          storeId: editingStoreData.id,
          nombre: 'Admin ' + editingStoreData.nombre,
          email: editingStoreData.email,
          role: 'admin',
          activo: true,
          createdAt: Date.now()
        };
        await setDoc(doc(db, 'users', newUserRecord.id), sanitizeForFirestore(newUserRecord));
        
        // We COULD delete the old user record, but to be safe, we'll keep it or just let admin manage it. Let's delete it if we have old email:
        if (oldStore.email) {
          await deleteDoc(doc(db, 'users', oldStore.email.replace(/\./g, '_')));
        }
      }

      toast.success(`Store "${editingStoreData.nombre}" updated successfully!`);
      setIsEditingStore(false);
      setEditingStoreData(null);
    } catch (error) {
      console.error("Error updating store:", error);
      toast.error("Failed to update store");
    }
  };

  const handleUpdateDemo = async () => {
    if (!editingDemoData || !editingDemoData.id) return;
    try {
      await setDoc(doc(db, 'demoRequests', editingDemoData.id), sanitizeForFirestore(editingDemoData), { merge: true });
      toast.success("Demo request updated!");
      setIsEditingDemo(false);
      setEditingDemoData(null);
    } catch (error) {
      console.error("Error updating demo:", error);
      toast.error("Failed to update demo request");
    }
  };

  const generateAIKey = async (storeId: string) => {
    if (!process.env.GEMINI_API_KEY) {
      toast.error("Gemini API Key is not configured in environment.");
      return;
    }

    setIsGeneratingKey(storeId);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Generate a unique, professional, and secure license key for a POS SaaS application. The key should be in a format like XXXX-XXXX-XXXX-XXXX using uppercase letters and numbers. Return ONLY the key.",
      });

      const newKey = response.text?.trim();
      if (newKey) {
        await updateLicenseKey(storeId, newKey);
        toast.success("AI License key generated!");
      }
    } catch (error) {
      console.error("Error generating AI key:", error);
      toast.error("Failed to generate key with AI.");
    } finally {
      setIsGeneratingKey(null);
    }
  };

  const toggleStoreStatus = async (store: StoreSettings) => {
    try {
      await setDoc(doc(db, 'settings', store.id), { isActive: !store.isActive }, { merge: true });
      toast.success(`Store ${store.isActive ? 'deactivated' : 'activated'} successfully.`);
    } catch (error) {
      console.error("Error toggling store status:", error);
      toast.error('Failed to update store status.');
    }
  };

  const initializeTestStore = async () => {
    const testStoreId = 'TEST-STORE';
    const testStore: StoreSettings = {
      id: testStoreId,
      nombre: 'Test Environment POS',
      direccion: 'Super Admin Lab',
      telefono: '000-000-0000',
      email: 'claudio.salvatore10@gmail.com',
      logoUrl: 'https://picsum.photos/seed/test/200/200',
      isActive: true,
      licenseKey: 'TEST-KEY-0000-0000',
      trainingMode: false
    };

    try {
      await setDoc(doc(db, 'settings', testStoreId), sanitizeForFirestore(testStore));
      
      // Add a test product
      const testProduct = {
        id: 'TEST-PROD-1',
        storeId: testStoreId,
        nombre: 'Test Product Alpha',
        precio: 100,
        costo: 70,
        categoria: 'Testing',
        stock: 50,
        imagenUrl: 'https://picsum.photos/seed/testprod/400/400'
      };
      await setDoc(doc(db, 'products', testProduct.id), sanitizeForFirestore(testProduct));

      // Add a test salesman
      const testSalesman = {
        id: 'test-salesman',
        storeId: testStoreId,
        nombre: 'Test',
        apellido: 'Operator',
        codigo: 'TEST-001',
        email: 'test@example.com',
        telefono: '(555) 000-0000',
        direccion: 'Test St',
        ciudad: 'Test City',
        estado: 'Test State',
        cp: '00000',
        taxId: 'TEST-TAX',
        pin: '1111',
        activo: true
      };
      await setDoc(doc(db, 'salesmen', testSalesman.id), sanitizeForFirestore(testSalesman));

      toast.success('Test Environment initialized successfully!');
    } catch (error) {
      console.error("Error initializing test store:", error);
      toast.error('Failed to initialize test environment.');
    }
  };

  const filteredStores = stores.filter(s => 
    s.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex flex-col print:hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">B2B POS Master Super Admin</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">SaaS Management Console</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <nav className="flex items-center bg-slate-100 p-1 rounded-xl mr-4">
            <button
              onClick={() => setActiveTab('stores')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'stores' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Stores
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-2 rounded-lg transition font-bold text-sm flex items-center gap-2 ${activeTab === 'catalog' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Package className="w-4 h-4" /> Global Catalog
            </button>
            <button
              onClick={() => setActiveTab('catalog_images')}
              className={`px-4 py-2 rounded-lg transition font-bold text-sm flex items-center gap-2 ${activeTab === 'catalog_images' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Sparkles className="w-4 h-4" /> Image Bank
            </button>
            <button
              onClick={() => setActiveTab('rubros')}
              className={`px-4 py-2 rounded-lg transition font-bold text-sm flex items-center gap-2 ${activeTab === 'rubros' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Tag className="w-4 h-4" /> Business Types
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-4 py-2 rounded-lg transition font-bold text-sm flex items-center gap-2 ${activeTab === 'billing' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <CreditCard className="w-4 h-4" /> Billing & P&L
            </button>
            <button
              onClick={() => setActiveTab('updates')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'updates' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              System Updates
            </button>
            <button
              onClick={() => setActiveTab('demos')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'demos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Demos
              {demoRequests.filter(dr => dr.status === 'pending').length > 0 && (
                <span className="bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {demoRequests.filter(dr => dr.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('merchants')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'merchants' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <CreditCard className="w-4 h-4" /> Merchant Onboarding
              {merchantRegistrations.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-extrabold shadow-sm animate-pulse">
                  {merchantRegistrations.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('landing_cms')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'landing_cms' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Globe className="w-4 h-4" /> Editorial de Landing
            </button>
          </nav>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-blue-500 transition w-64"
            />
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition font-medium"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-8">
        {activeTab === 'stores' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">TOTAL STORES</span>
            </div>
            <h3 className="text-3xl font-bold text-slate-900">{stores.length}</h3>
            <p className="text-slate-500 text-sm mt-1">Active across the platform</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">TOTAL USERS</span>
            </div>
            <h3 className="text-3xl font-bold text-slate-900">{users.length}</h3>
            <p className="text-slate-500 text-sm mt-1">Registered accounts</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 rounded-xl">
                <Sparkles className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">PLATFORM STATUS</span>
            </div>
            <h3 className="text-3xl font-bold text-slate-900">Healthy</h3>
            <p className="text-slate-500 text-sm mt-1">All systems operational</p>
          </div>

          <div 
            onClick={() => setActiveTab('landing_cms')}
            className="bg-white p-6 rounded-2xl shadow-sm border border-dashed border-sky-300 hover:border-sky-500 hover:bg-sky-50/10 cursor-pointer transition-all duration-300 flex flex-col justify-between group h-full shadow-inner hover:shadow-cyan-100/30"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-sky-100 group-hover:text-sky-700 transition">
                <Globe className="w-6 h-6 animate-pulse animate-duration-2000" />
              </div>
              <span className="text-[10px] font-black text-sky-700 bg-sky-100/50 px-2 py-1 rounded-full uppercase tracking-wider">CMS Global</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 group-hover:text-sky-600 transition flex items-center gap-1.5">
                Editorial de Landing
              </h3>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">Personalizar encabezados, imágenes y características de la portada.</p>
            </div>
          </div>
        </div>

        {/* Stores Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">Managed Stores</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsAddingStore(true)}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl transition shadow-lg shadow-blue-100 text-sm font-black"
              >
                <Plus className="w-4 h-4" /> Add New Store
              </button>
              <button className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition text-sm font-bold">
                <RefreshCw className="w-4 h-4" /> Refresh Data
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Store Name</th>
                  <th className="px-6 py-4">Store ID</th>
                  <th className="px-6 py-4">Admin Email</th>
                  <th className="px-6 py-4">Business Type</th>
                  <th className="px-6 py-4">Subscription</th>
                  <th className="px-6 py-4">License Key</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                      Loading platform data...
                    </td>
                  </tr>
                ) : filteredStores.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      No stores found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredStores.map((store) => (
                    <tr key={store.id} className="hover:bg-slate-50/50 transition group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{store.nombre}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-mono font-bold bg-slate-100 px-2 py-1 rounded">{store.id}</span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(store.id);
                              toast.success('Store ID copied!');
                            }}
                            className="p-1 text-slate-300 hover:text-blue-500 transition"
                            title="Copy Store ID"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {store.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={store.businessCategory || ''}
                          onChange={async (e) => {
                            await handleUpdateStoreBusinessType(store.id, e.target.value);
                          }}
                          className="text-xs bg-slate-100 border-none rounded-lg px-2 py-1 font-bold text-slate-600 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Default</option>
                          {businessCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs font-bold">$</span>
                          <input
                            type="number"
                            defaultValue={store.subscriptionAmount || 0}
                            onBlur={(e) => updateStoreSubscription(store.id, parseFloat(e.target.value) || 0)}
                            className="w-20 text-xs bg-slate-100 border-none rounded-lg px-2 py-1 font-bold text-slate-600 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            defaultValue={store.licenseKey || ''}
                            onBlur={(e) => {
                              if (e.target.value !== store.licenseKey) {
                                updateLicenseKey(store.id, e.target.value);
                              }
                            }}
                            placeholder="Enter Key"
                            className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 border-none focus:ring-1 focus:ring-blue-500 w-32"
                          />
                          <button
                            onClick={() => generateAIKey(store.id)}
                            disabled={isGeneratingKey !== null}
                            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
                            title="Generate with AI"
                          >
                            {isGeneratingKey === store.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {store.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                            <XCircle className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 transition whitespace-nowrap">
                          {store.id !== 'SYSTEM' && (
                            <button
                              onClick={() => onSelectStore(store.id)}
                              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm"
                              title="Enter POS as this Store"
                            >
                              <Building2 className="w-4 h-4" /> Open POS
                            </button>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}`);
                              toast.success('Login link copied! Send it to ' + (store.email || 'the client') + ' and tell them to login with their Google account.');
                            }}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition border border-transparent hover:border-emerald-200"
                            title="Copy Login Link for Client"
                          >
                            <Link className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingStoreData(store);
                              setIsEditingStore(true);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-transparent hover:border-indigo-200"
                            title="Edit Store Info"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStoreStatus(store)}
                            className={`p-1.5 rounded-lg transition border border-transparent ${store.isActive ? 'text-amber-600 hover:bg-amber-50 hover:border-amber-200' : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'}`}
                            title={store.isActive ? 'Deactivate Store' : 'Activate Store'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          {store.id !== 'SYSTEM' && (
                            <button
                              onClick={() => handleDeleteStore(store.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200"
                              title="Delete Store"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}

        {activeTab === 'demos' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Demo Requests</h2>
                <p className="text-sm text-slate-500 font-medium">Manage pending 48h demo requests from the landing page</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4">Request Date</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {demoRequests.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">No demo requests yet.</td></tr>
                  ) : (
                    [...demoRequests].sort((a, b) => b.requestedAt?.toMillis?.() - a.requestedAt?.toMillis?.()).map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 text-sm font-medium text-slate-600">
                          {req.requestedAt ? new Date(req.requestedAt.toDate()).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">{req.nombre}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-900">{req.email}</p>
                          {req.phone && <p className="text-xs text-slate-500 mt-1">{req.phone}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider">
                            {req.businessType || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {req.status === 'pending' ? 'Pending' : 'Processed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {(() => {
                              const linkedStore = req.email ? stores.find(s => s.email?.toLowerCase() === req.email?.toLowerCase()) : null;
                              return linkedStore && linkedStore.id !== 'SYSTEM' ? (
                                <button
                                  onClick={() => onSelectStore(linkedStore.id)}
                                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm"
                                  title={`Open POS: ${linkedStore.nombre}`}
                                >
                                  <Building2 className="w-4 h-4" /> Open POS
                                </button>
                              ) : null;
                            })()}
                            {req.status === 'pending' && (
                              <button
                                onClick={async () => {
                                  try {
                                    setNewStoreData({ 
                                      nombre: "Demo " + req.nombre, 
                                      email: req.email, 
                                      businessCategory: req.businessType === 'wholesale' ? 'wholesale' : (req.businessType === 'restaurant' || req.businessType === 'retail' ? 'restaurant' : ''), 
                                      subscriptionAmount: 0 
                                    });
                                    setIsAddingStore(true);
                                    await setDoc(doc(db, 'demoRequests', req.id), { status: 'processed' }, { merge: true });
                                    toast.success('Ready to create store!');
                                  } catch (e) {
                                    toast.error('Error processing request');
                                  }
                                }}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition"
                              >
                                Process & Create Store
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingDemoData(req);
                                setIsEditingDemo(true);
                              }}
                              className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Edit Demo Request"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: 'Delete Request',
                                  message: 'Are you sure you want to delete this demo request?',
                                  type: 'danger',
                                  confirmText: 'Delete',
                                  onConfirm: async () => {
                                    try {
                                      await deleteDoc(doc(db, 'demoRequests', req.id));
                                      toast.success('Solicitud eliminada');
                                    } catch (err) {
                                      console.error("Error deleting demo request:", err);
                                      toast.error("No se pudo borrar la solicitud. Permisos insuficientes.");
                                    }
                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                  }
                                });
                              }}
                              className="p-1 text-slate-300 hover:text-red-500 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'merchants' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Registro & Onboarding de Comercios</h2>
                <p className="text-sm text-slate-500 font-medium">Administre las solicitudes de afiliación de tiendas y los asesores/vendedores de calle</p>
              </div>
              <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-300/40">
                <button
                  type="button"
                  onClick={() => setMerchantSubTab('applications')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                    merchantSubTab === 'applications'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  📝 Solicitudes ({merchantRegistrations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMerchantSubTab('salesreps')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                    merchantSubTab === 'salesreps'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  💼 Vendedores de Calle ({salesReps.length})
                </button>
              </div>
            </div>
            
            {merchantSubTab === 'applications' && (
              <>
                <div className="p-4 border-b border-slate-100 flex gap-4 bg-white">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter by DBA name, Owner, Sales rep, SSN or Bank routing..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="px-6 py-4">Submission Date</th>
                        <th className="px-6 py-4">Store DBA Name</th>
                        <th className="px-6 py-4">Legal Name</th>
                        <th className="px-6 py-4">Owner Name</th>
                        <th className="px-6 py-4">Sales Rep</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {merchantRegistrations.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-slate-400">No merchant registrations submitted yet.</td></tr>
                      ) : (
                        merchantRegistrations
                          .filter(reg => {
                            const q = searchQuery.toLowerCase().trim();
                            if (!q) return true;
                            return (
                              reg.busStoreNameDba?.toLowerCase().includes(q) ||
                              reg.busLegalName?.toLowerCase().includes(q) ||
                              `${reg.ownerFirstName} ${reg.ownerLastName}`.toLowerCase().includes(q) ||
                              reg.salesmanName?.toLowerCase().includes(q) ||
                              reg.ownerSsn?.includes(q) ||
                              reg.bankRoutingNumber?.includes(q)
                            );
                          })
                          .sort((a, b) => b.createdAt - a.createdAt)
                          .map((reg) => (
                            <tr key={reg.id} className="hover:bg-slate-50 transition">
                              <td className="px-6 py-4 text-sm font-medium text-slate-600">
                                {new Date(reg.createdAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-900">{reg.busStoreNameDba}</td>
                              <td className="px-6 py-4 text-sm text-slate-700 font-medium">{reg.busLegalName}</td>
                              <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                                {reg.ownerFirstName} {reg.ownerLastName}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                {reg.salesmanName}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                  reg.status === 'approved' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}>
                                  {reg.status || 'pending'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setSelectedReg(reg)}
                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition"
                                  >
                                    Review Details
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm('Are you sure you want to delete this application record?')) {
                                        try {
                                          await deleteDoc(doc(db, 'merchantRegistrations', reg.id));
                                          toast.success('Registration deleted successfully');
                                        } catch (err) {
                                          toast.error('Failed to delete registration');
                                        }
                                      }
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-slate-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {merchantSubTab === 'salesreps' && (
              <div className="p-6 bg-white space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="text-left">
                    <h3 className="text-base font-black text-slate-900">Agentes / Vendedores de Calle</h3>
                    <p className="text-xs text-slate-500 font-medium">Crea, edita y da de alta los códigos autorizados que usarán los vendedores para registrar comercios</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSalesRep(null);
                      setNewSalesRepData({
                        nombre: '',
                        apellido: '',
                        codigo: 'VEND-' + Math.floor(100 + Math.random() * 900),
                        email: '',
                        telefono: '',
                        direccion: '',
                        ciudad: '',
                        estado: '',
                        cp: '',
                        taxId: '',
                        activo: true,
                        posPrice: 350,
                        commissionRate: 150,
                        commissionType: 'fixed',
                        ssn: '',
                        taxClassification: '1099',
                        settlementFrequency: 'weekly'
                      });
                      setIsAddingSalesRep(true);
                    }}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-md shadow-blue-100 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" /> Agregar Vendedor de Calle
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border border-slate-150 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-wider border-b border-slate-150">
                        <th className="px-6 py-4">Nombre Completo</th>
                        <th className="px-6 py-4">Código Autorizado</th>
                        <th className="px-6 py-4">Información de Contacto</th>
                        <th className="px-6 py-4">Aplicaciones Realizadas</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {salesReps.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                            No hay vendedores de calle registrados aún. Haga clic en "+ Agregar Vendedor" para registrar el primero.
                          </td>
                        </tr>
                      ) : (
                        salesReps.map((rep) => {
                          const applicationsCount = merchantRegistrations.filter(
                            m => m.salesmanId === rep.id || 
                            m.customSalesmanCode?.toUpperCase() === rep.codigo?.toUpperCase() ||
                            m.salesmanName?.toLowerCase().includes((rep.nombre + ' ' + rep.apellido).toLowerCase())
                          ).length;

                          return (
                            <tr key={rep.id} className="hover:bg-slate-50/60 transition">
                              <td className="px-6 py-4 text-left">
                                <div className="font-bold text-slate-900">{rep.nombre} {rep.apellido}</div>
                                <div className="flex gap-1.5 mt-1">
                                  <span className="px-1.5 py-0.5 text-[9px] font-black bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 uppercase tracking-wider">
                                    {rep.taxClassification || '1099'}
                                  </span>
                                  <span className="px-1.5 py-0.5 text-[9px] font-black bg-slate-50 text-slate-600 rounded-md border border-slate-150 uppercase tracking-wider">
                                    🕒 {rep.settlementFrequency === 'weekly' ? 'Semanal' : rep.settlementFrequency === 'biweekly' ? 'Quincenal' : rep.settlementFrequency === 'monthly' ? 'Mensual' : 'Semanal'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-left">
                                <span className="font-mono font-extrabold text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 px-1 text-xs select-all inline-block mb-1">
                                  {rep.codigo || 'DIRECTO'}
                                </span>
                                <div className="text-[10px] text-slate-500 font-bold space-y-0.5">
                                  <div>Precio POS: <span className="text-slate-800">${rep.posPrice ?? 350}</span></div>
                                  <div>Comisión: <span className="text-blue-700">{rep.commissionType === 'percentage' ? `${rep.commissionRate ?? 150}%` : `$${rep.commissionRate ?? 150}`}</span></div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-600 font-medium space-y-1 text-left">
                                {rep.email && <div>✉ {rep.email}</div>}
                                {rep.telefono && <div>📞 {rep.telefono}</div>}
                                {rep.ssn && <div className="text-[10px] text-slate-500 font-bold">SSN: <span className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{rep.ssn}</span></div>}
                                {rep.taxId && <div className="text-[10px] text-slate-500 font-bold">TAX ID: <span className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{rep.taxId}</span></div>}
                              </td>
                              <td className="px-6 py-4 font-extrabold text-slate-800 text-xs">
                                <span className={`px-2.5 py-1 rounded-full ${
                                  applicationsCount > 0 
                                    ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-100' 
                                    : 'bg-slate-50 text-slate-400 border border-slate-100'
                                }`}>
                                  {applicationsCount} Solicitudes
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                  rep.activo !== false 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {rep.activo !== false ? 'Activo' : 'Inactivo'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSalesRep(rep);
                                      setNewSalesRepData({
                                        nombre: rep.nombre || '',
                                        apellido: rep.apellido || '',
                                        codigo: rep.codigo || '',
                                        email: rep.email || '',
                                        telefono: rep.telefono || '',
                                        direccion: rep.direccion || '',
                                        ciudad: rep.ciudad || '',
                                        estado: rep.estado || '',
                                        cp: rep.cp || '',
                                        taxId: rep.taxId || '',
                                        activo: rep.activo !== false,
                                        posPrice: rep.posPrice ?? 350,
                                        commissionRate: rep.commissionRate ?? 150,
                                        commissionType: rep.commissionType || 'fixed',
                                        ssn: rep.ssn || '',
                                        taxClassification: rep.taxClassification || '1099',
                                        settlementFrequency: rep.settlementFrequency || 'weekly'
                                      });
                                      setIsAddingSalesRep(true);
                                    }}
                                    className="px-3 py-1.5 bg-slate-50/50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg transition border border-slate-200"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSettlementRep(rep);
                                      setOverridePosUnits(applicationsCount);
                                      setTempPosPrice(rep.posPrice ?? 350);
                                      setTempCommRate(rep.commissionRate ?? 150);
                                      setTempCommType(rep.commissionType || 'fixed');
                                      setCustomMemo(`Comisiones POS - ${rep.nombre} ${rep.apellido}`);
                                      setCheckDate(new Date().toISOString().split('T')[0]);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg transition shadow-sm shadow-emerald-100 flex items-center gap-1"
                                  >
                                    <DollarSign className="w-3.5 h-3.5" />
                                    Liquidar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm(`¿Está seguro de que desea eliminar al vendedor ${rep.nombre} ${rep.apellido}? Sus códigos ingresados anteriormente podrían dejar de ser válidos para nuevas solicitudes.`)) {
                                        try {
                                          await deleteDoc(doc(db, 'salesreps', rep.id));
                                          toast.success('Vendedor eliminado con éxito de la plataforma.');
                                        } catch (err) {
                                          toast.error('No se pudo borrar al vendedor.');
                                        }
                                      }
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-slate-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sales Representative Creation / Editing Modal */}
            {isAddingSalesRep && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col text-slate-800">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                      <h3 className="text-lg font-black text-slate-950 text-left">
                        {editingSalesRep ? 'Editar Vendedor de Calle' : 'Registrar Vendedor de Calle'}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium text-left">Ingrese los datos para autorizar el código del vendedor en el Onboarding de la calle</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsAddingSalesRep(false)}
                      className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newSalesRepData.nombre.trim() || !newSalesRepData.apellido.trim() || !newSalesRepData.codigo.trim()) {
                        toast.error('Nombre, Apellido y Código de Vendedor son campos estrictamente obligatorios.');
                        return;
                      }

                      try {
                        const repId = editingSalesRep?.id ?? `SALES-GLOBAL-${Date.now()}`;
                        const docData = {
                          id: repId,
                          storeId: 'SYSTEM', // Representante global de la plataforma
                          nombre: newSalesRepData.nombre.trim(),
                          apellido: newSalesRepData.apellido.trim(),
                          codigo: newSalesRepData.codigo.trim().toUpperCase(),
                          email: newSalesRepData.email.trim(),
                          telefono: newSalesRepData.telefono.trim(),
                          direccion: newSalesRepData.direccion.trim(),
                          ciudad: newSalesRepData.ciudad.trim(),
                          estado: newSalesRepData.estado.trim(),
                          cp: newSalesRepData.cp.trim(),
                          taxId: newSalesRepData.taxId.trim(),
                          activo: newSalesRepData.activo,
                          pin: '1111',
                          posPrice: Number(newSalesRepData.posPrice) || 0,
                          commissionRate: Number(newSalesRepData.commissionRate) || 0,
                          commissionType: newSalesRepData.commissionType,
                          ssn: newSalesRepData.ssn,
                          taxClassification: newSalesRepData.taxClassification,
                          settlementFrequency: newSalesRepData.settlementFrequency
                        };

                        await setDoc(doc(db, 'salesreps', repId), sanitizeForFirestore(docData), { merge: true });
                        toast.success(editingSalesRep ? 'Datos del vendedor actualizados exitosamente.' : '¡Vendedor de Calle registrado y código autorizado con éxito!');
                        setIsAddingSalesRep(false);
                      } catch (err) {
                        toast.error('Error al guardar datos del vendedor.');
                        console.error(err);
                      }
                    }}
                    className="p-6 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-left">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Nombre *</label>
                        <input
                          type="text"
                          required
                          value={newSalesRepData.nombre}
                          onChange={(e) => setNewSalesRepData(prev => ({ ...prev, nombre: e.target.value }))}
                          placeholder="Ej: Pedro"
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="text-left">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Apellido *</label>
                        <input
                          type="text"
                          required
                          value={newSalesRepData.apellido}
                          onChange={(e) => setNewSalesRepData(prev => ({ ...prev, apellido: e.target.value }))}
                          placeholder="Ej: Martínez"
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Código de Promoción / Vendedor (Debe ser único) *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={newSalesRepData.codigo}
                          onChange={(e) => setNewSalesRepData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                          placeholder="Ej: AGENTE-007"
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-mono tracking-wider font-extrabold text-blue-600 uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => setNewSalesRepData(prev => ({ ...prev, codigo: 'VEND-' + Math.floor(100 + Math.random() * 900) }))}
                          className="px-3 border border-slate-300 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600"
                        >
                          Generar
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium block mt-1">Este código lo escribirá su vendedor en la página de afiliación para validar su identidad y procesar su comisión.</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-left">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Email (Opcional)</label>
                        <input
                          type="email"
                          value={newSalesRepData.email}
                          onChange={(e) => setNewSalesRepData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="pedro@suempresa.com"
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="text-left">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Teléfono (Opcional)</label>
                        <input
                          type="text"
                          value={newSalesRepData.telefono}
                          onChange={(e) => setNewSalesRepData(prev => ({ ...prev, telefono: formatPhoneNumber(e.target.value) }))}
                          placeholder="(555) 000-0000"
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    {/* Finanzas y Comisiones */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                        💳 Finanzas y Comisiones
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Precio POS ($) *</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={newSalesRepData.posPrice}
                            onChange={(e) => setNewSalesRepData(prev => ({ ...prev, posPrice: Number(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Comisión *</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={newSalesRepData.commissionRate}
                            onChange={(e) => setNewSalesRepData(prev => ({ ...prev, commissionRate: Number(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Tipo Comisión *</label>
                          <select
                            value={newSalesRepData.commissionType}
                            onChange={(e) => setNewSalesRepData(prev => ({ ...prev, commissionType: e.target.value as 'fixed' | 'percentage' }))}
                            className="w-full px-2 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-bold"
                          >
                            <option value="fixed">Fijo ($ por POS)</option>
                            <option value="percentage">Porcentaje (% del POS)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Datos Fiscales y Liquidación */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                        🏛️ Datos Fiscales y Liquidación
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Seguro Social (SSN)</label>
                          <input
                            type="text"
                            value={newSalesRepData.ssn}
                            onChange={(e) => setNewSalesRepData(prev => ({ ...prev, ssn: formatSsn(e.target.value) }))}
                            placeholder="000-00-0000"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Federal TAX ID / EIN</label>
                          <input
                            type="text"
                            value={newSalesRepData.taxId}
                            onChange={(e) => setNewSalesRepData(prev => ({ ...prev, taxId: formatTaxId(e.target.value) }))}
                            placeholder="00-0000000"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Clasificación Fiscal *</label>
                          <select
                            value={newSalesRepData.taxClassification}
                            onChange={(e) => setNewSalesRepData(prev => ({ ...prev, taxClassification: e.target.value as 'W2' | '1099' }))}
                            className="w-full px-2 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-bold"
                          >
                            <option value="1099">Contratista (1099)</option>
                            <option value="W2">Empleado (W2)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Frecuencia Liquidación *</label>
                          <select
                            value={newSalesRepData.settlementFrequency}
                            onChange={(e) => setNewSalesRepData(prev => ({ ...prev, settlementFrequency: e.target.value as 'weekly' | 'biweekly' | 'monthly' }))}
                            className="w-full px-2 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-bold"
                          >
                            <option value="weekly">Semanal</option>
                            <option value="biweekly">Quincenal</option>
                            <option value="monthly">Mensual</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 text-left">
                      <input
                        type="checkbox"
                        id="salesrep-activo-toggle"
                        checked={newSalesRepData.activo}
                        onChange={(e) => setNewSalesRepData(prev => ({ ...prev, activo: e.target.checked }))}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="salesrep-activo-toggle" className="text-xs font-bold text-slate-700 select-none">
                        Vendedor activo para autorizar y firmar afiliaciones
                      </label>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsAddingSalesRep(false)}
                        className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition"
                      >
                        {editingSalesRep ? 'Actualizar' : 'Guardar Autorización'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal de Liquidación de Comisiones y Emisión de Cheque */}
            {settlementRep && (() => {
              const totalVentasCalculadas = overridePosUnits * tempPosPrice;
              const comisionCalculada = tempCommType === 'percentage'
                ? (totalVentasCalculadas * (tempCommRate / 100))
                : (overridePosUnits * tempCommRate);

              const isW2 = (settlementRep.taxClassification || '1099') === 'W2';

              // Impuestos y deducciones reales de EE. UU. (FICA y retenciones de renta federal/estatal)
              const fitRateVal = isW2 ? (taxFitRate / 100) : 0;
              const sitRateVal = isW2 ? (taxSitRate / 100) : 0;
              const ssRateVal = isW2 ? 0.062 : 0;          // Seguro Social 6.2%
              const medRateVal = isW2 ? 0.0145 : 0;        // Medicare 1.45%
              const suiRateVal = isW2 ? 0.005 : 0;         // SUI / SDI estatal 0.5%

              const fitDeduction = comisionCalculada * fitRateVal;
              const sitDeduction = comisionCalculada * sitRateVal;
              const ssDeduction = comisionCalculada * ssRateVal;
              const medicareDeduction = comisionCalculada * medRateVal;
              const suiDeduction = comisionCalculada * suiRateVal;

              const totalDeductions = fitDeduction + sitDeduction + ssDeduction + medicareDeduction + suiDeduction;
              const netPay = comisionCalculada - totalDeductions;

              // Estimaciones de Acumulado de Año (YTD) para realismo profesional (ADP style alignment)
              const ytdMultiplier = 8.5;
              const ytdGross = comisionCalculada * ytdMultiplier;
              const ytdFit = fitDeduction * ytdMultiplier;
              const ytdSit = sitDeduction * ytdMultiplier;
              const ytdSs = ssDeduction * ytdMultiplier;
              const ytdMedicare = medicareDeduction * ytdMultiplier;
              const ytdSui = suiDeduction * ytdMultiplier;
              const ytdTotalDeductions = totalDeductions * ytdMultiplier;
              const ytdNetPay = netPay * ytdMultiplier;

              // Rango del período de liquidación
              const getPeriodDates = () => {
                try {
                  const end = new Date(checkDate);
                  const start = new Date(checkDate);
                  const freq = settlementRep.settlementFrequency || 'weekly';
                  const days = freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : 30;
                  start.setDate(end.getDate() - days);
                  return {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0]
                  };
                } catch {
                  return { start: 'N/A', end: checkDate };
                }
              };
              const period = getPeriodDates();

              return (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  {/* CSS de impresión específico para el cheque y talonario US */}
                  <style>{`
                    @media print {
                      #root {
                        display: none !important;
                      }
                      body > div:not(#printable-payroll-document) {
                        display: none !important;
                      }
                      html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      #printable-payroll-document {
                        display: block !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        box-sizing: border-box !important;
                        background: #ffffff !important;
                        z-index: 9999999 !important;
                      }
                      @page {
                        size: letter portrait;
                        margin: 0.5in !important;
                      }
                    }
                  `}</style>

                  <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col text-slate-800 max-h-[92vh] overflow-y-auto">
                    
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="text-left font-sans">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                          💸 Liquidación de Nómina y Emisión de Cheque US
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">Calcule la liquidación del comisionista, configure impuestos gubernamentales y emita el cheque junto con su colilla/talonario (pay stub) corporativo oficial.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setSettlementRep(null)}
                        className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      
                      {/* Grid de 2 Columnas Principal */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Columna Izquierda: Calculadora y Ajustes Impositivos (5 cols) */}
                        <div className="lg:col-span-12 xl:col-span-5 bg-slate-50 p-5 rounded-2xl border border-slate-200/60 text-left space-y-4">
                          <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider border-b border-slate-250 pb-2 flex items-center gap-1.5 font-sans">
                            <Briefcase className="w-4 h-4 text-slate-500" /> Perfil y Configuración
                          </h4>

                          <div className="space-y-3 font-sans">
                            <div>
                              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">Vendedor</span>
                              <div className="font-bold text-slate-800 text-sm">{settlementRep.nombre} {settlementRep.apellido}</div>
                              <div className="text-[11px] text-slate-500 font-medium">{settlementRep.email || 'Sin correo electrónico'}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/65">
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                                <span className="text-[9px] uppercase font-black text-slate-400 block">Estatus Fiscal (W2 / 1099)</span>
                                <span className={`text-xs font-black px-2 py-0.5 rounded-md inline-block mt-0.5 ${isW2 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                  {isW2 ? 'W-2 (Employee)' : '1099 (Contractor)'}
                                </span>
                              </div>
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                                <span className="text-[9px] uppercase font-black text-slate-400 block">Frecuencia Liquidación</span>
                                <span className="text-xs font-black text-slate-800 uppercase block mt-1">
                                  {settlementRep.settlementFrequency === 'weekly' ? 'Semanal' : settlementRep.settlementFrequency === 'biweekly' ? 'Quincenal' : settlementRep.settlementFrequency === 'monthly' ? 'Mensual' : 'Semanal'}
                                </span>
                              </div>
                            </div>

                            {/* SSN y Tax ID */}
                            <div className="grid grid-cols-2 gap-2">
                              {settlementRep.ssn ? (
                                <div className="bg-white p-2 text-slate-800 rounded-lg border border-slate-200 text-[11px]">
                                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Social Security (SSN)</span>
                                  <span className="font-mono font-bold text-slate-800">{settlementRep.ssn}</span>
                                </div>
                              ) : (
                                <div className="bg-rose-50 border border-rose-200 p-2 rounded-lg text-[10px] text-rose-700 font-sans">
                                  <span className="font-bold block">SSN Requerido para W-2</span>
                                  <p className="mt-0.5 leading-tight text-[9.5px]">Registre el SSN en su perfil de vendedor.</p>
                                </div>
                              )}

                              <div className="bg-white p-2 text-slate-800 rounded-lg border border-slate-200 text-[11px]">
                                <span className="text-[9px] uppercase font-bold text-slate-400 block">TAX ID / EIN Corporation</span>
                                <span className="font-mono font-bold text-slate-800">{settlementRep.taxId || 'N/A'}</span>
                              </div>
                            </div>

                            <hr className="border-slate-200" />

                            {/* Inputs de comisiones */}
                            <div className="space-y-3 font-sans">
                              <h5 className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-2">Comisiones sobre Ventas POS</h5>
                              
                              <div>
                                <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-wider mb-1 font-sans">Unidades POS Vendidas / Activadas</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={overridePosUnits}
                                  onChange={(e) => setOverridePosUnits(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-black text-slate-800"
                                />
                                <span className="text-[9px] text-slate-400 block mt-0.5 font-sans font-medium">Ventas aprobadas registradas con el código {settlementRep.codigo || 'DIRECTO'}.</span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 font-sans">
                                <div className="col-span-1">
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Precio Unitario ($)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={tempPosPrice}
                                    onChange={(e) => setTempPosPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-bold"
                                  />
                                </div>
                                <div className="col-span-1">
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Ratio Comisión</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={tempCommRate}
                                    onChange={(e) => setTempCommRate(Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-blue-700 font-black font-sans"
                                  />
                                </div>
                                <div className="col-span-1">
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1 font-sans">Modo Ratio</label>
                                  <select
                                    value={tempCommType}
                                    onChange={(e) => setTempCommType(e.target.value as 'fixed' | 'percentage')}
                                    className="w-full px-1.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-bold"
                                  >
                                    <option value="fixed">Fijo ($/POS)</option>
                                    <option value="percentage">Porcentaje (%)</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Panel Fiscal W-2 */}
                            {isW2 ? (
                              <div className="bg-indigo-50/50 border border-indigo-100 p-3.5 rounded-xl space-y-3 mt-4 font-sans">
                                <h5 className="text-[10px] uppercase font-black text-indigo-800 tracking-wider flex items-center gap-1 font-sans">
                                  🏢 Retenciones Federales & Estatales (W-2 Only)
                                </h5>
                                <p className="text-[10px] text-indigo-600 font-medium leading-tight font-sans">Deducciones fiscales oficiales. El super admin puede alterar los porcentajes para coincidir con las regulaciones estatales.</p>
                                
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-bold text-indigo-700 uppercase mb-0.5">Impuesto Federal (FIT %)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="40"
                                      value={taxFitRate}
                                      onChange={(e) => setTaxFitRate(Math.max(0, parseFloat(e.target.value) || 0))}
                                      className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-900"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-indigo-700 uppercase mb-0.5">Impuesto Estatal (SIT %)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      value={taxSitRate}
                                      onChange={(e) => setTaxSitRate(Math.max(0, parseFloat(e.target.value) || 0))}
                                      className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-900"
                                    />
                                  </div>
                                </div>

                                <div className="bg-white/75 border border-indigo-100 p-2 rounded-lg text-[10px] space-y-1 text-indigo-900 font-mono">
                                  <div className="flex justify-between font-medium">
                                    <span className="font-sans">Federal Tax (FIT):</span>
                                    <span className="font-bold">${fitDeduction.toFixed(2)} ({taxFitRate}%)</span>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span className="font-sans">State Tax (SIT):</span>
                                    <span className="font-bold">${sitDeduction.toFixed(2)} ({taxSitRate}%)</span>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span className="font-sans">Social Security (FICA):</span>
                                    <span className="font-medium">${ssDeduction.toFixed(2)} (6.2%)</span>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span className="font-sans font-sans">Medicare (FICA):</span>
                                    <span className="font-medium">${medicareDeduction.toFixed(2)} (1.45%)</span>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span className="font-sans">Disability / SUI:</span>
                                    <span className="font-bold">${suiDeduction.toFixed(2)} (0.5%)</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-amber-50/50 border border-amber-200/50 p-3.5 rounded-xl space-y-2 text-amber-900 text-[11px] font-medium leading-relaxed font-sans mt-4">
                                <span className="font-black text-amber-800 uppercase text-[9px] block tracking-wide">⚠️ Régimen 1099 Contractor</span>
                                <p className="mb-1 text-slate-605 text-slate-600 font-sans font-medium text-left">Este comisionista actúa como contratista independiente. Su pago bruto no congrega retenciones de seguros federales (FICA), desempleo o renta.</p>
                                <span className="text-[10px] text-amber-700 font-bold bg-white/70 py-1 px-2 rounded border border-amber-100 flex items-center justify-between">
                                  <span>Impuestos Retenidos:</span>
                                  <span>$0.00 (Exento)</span>
                                </span>
                              </div>
                            )}

                            {/* Resumen Final del Cálculo Financiero */}
                            <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 space-y-2 font-sans font-semibold">
                              <div className="flex justify-between text-[11px] text-slate-500">
                                <span>Ganancia Bruta (Gross Pay):</span>
                                <span className="font-mono text-slate-800 font-black">${comisionCalculada.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              {isW2 && (
                                <div className="flex justify-between text-[11px] text-rose-500 font-sans">
                                  <span>Total Deducciones:</span>
                                  <span className="font-mono text-rose-600 font-black">-${totalDeductions.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-xs border-t border-slate-200 pt-2 font-black font-sans">
                                <span>Net Pay (Valor del Cheque):</span>
                                <span className="font-mono text-emerald-700 text-sm font-black">${netPay.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Columna Derecha: Vista del Cheque / Config Voucher (7 cols) */}
                        <div className="lg:col-span-12 xl:col-span-7 flex flex-col space-y-4 text-left">
                          
                          {/* Datos del Cheque a Generar */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex flex-wrap gap-4 font-sans">
                            <div className="flex-1 min-w-[120px]">
                              <label className="block text-[10px] font-extrabold text-slate-505 text-slate-500 uppercase mb-1">Número de Cheque</label>
                              <input
                                type="number"
                                value={checkNumber}
                                onChange={(e) => setCheckNumber(parseInt(e.target.value) || 1001)}
                                className="w-full px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                              />
                            </div>
                            <div className="flex-1 min-w-[120px]">
                              <label className="block text-[10px] font-extrabold text-slate-505 text-slate-500 uppercase mb-1">Fecha Emisión</label>
                              <input
                                type="date"
                                value={checkDate}
                                onChange={(e) => setCheckDate(e.target.value)}
                                className="w-full px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                              />
                            </div>
                            <div className="w-full">
                              <label className="block text-[10px] font-extrabold text-slate-550 mr-1 text-slate-500 uppercase mb-1">Descripción / Memo del Cheque</label>
                              <input
                                type="text"
                                value={customMemo}
                                onChange={(e) => setCustomMemo(e.target.value)}
                                placeholder="Ej: Liquidación comisiones correspondientes a semana 24"
                                className="w-full px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                              />
                            </div>
                          </div>

                          {/* Selector de Pestañas de Vista Previa */}
                          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 font-sans">
                            <button
                              type="button"
                              onClick={() => setActivePreviewTab('check')}
                              className={`flex-1 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider rounded-lg transition ${
                                activePreviewTab === 'check'
                                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              💵 Vista de Cheque
                            </button>
                            <button
                              type="button"
                              onClick={() => setActivePreviewTab('stub')}
                              className={`flex-1 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider rounded-lg transition relative ${
                                activePreviewTab === 'stub'
                                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              📄 Colilla de Nómina US (Pay Stub) {isW2 && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>}
                            </button>
                          </div>

                          {/* CONTENEDOR FÍSICO DEL CHEQUE */}
                          <div 
                            id="printable-check-area"
                            className="w-full aspect-[2.1/1] border-2 border-slate-300 bg-[#fafcf7] rounded-2xl shadow-xl p-5 md:p-6 flex flex-col justify-between relative overflow-hidden select-none border-dashed border-slate-400"
                            style={{
                              backgroundImage: "radial-gradient(#e5edd7 0.75px, transparent 0.75px), radial-gradient(#e5edd7 0.75px, #fafcf7 0.75px)",
                              backgroundSize: "20px 20px",
                              backgroundPosition: "0 0, 10px 10px"
                            }}
                          >
                            {/* Vista en pantalla interactiva según la pestaña activa */}
                            {activePreviewTab === 'check' ? (
                              <>
                                {/* Líneas Decorativas de Seguridad y Fondo */}
                                <div className="absolute inset-0 border border-slate-300/40 m-2.5 rounded-lg pointer-events-none md:m-3"></div>

                                {/* Fila 1: Cabecera Corporativa y Check Number */}
                                <div className="flex justify-between items-start z-10">
                                  <div className="text-left mt-1 ml-1 font-sans">
                                    <h2 className="text-xs font-black text-slate-900 tracking-wide uppercase">B2B POS MASTER CORP.</h2>
                                    <p className="text-[8px] text-slate-500 font-bold leading-tight uppercase">Corporate Sales Clearance</p>
                                    <p className="text-[8px] text-slate-400 font-medium">100 Wall Street, New York, NY 10005</p>
                                  </div>
                                  
                                  <div className="text-right mt-1 mr-1 font-serif font-black text-slate-800 text-xs md:text-sm">
                                    No. <span className="text-sm md:text-base tracking-wider font-extrabold">{checkNumber}</span>
                                  </div>
                                </div>

                                {/* Fila 2: Fecha y Cuadro de Monto Numérico */}
                                <div className="flex justify-between items-center z-10 px-1 mt-1 font-sans">
                                  <div className="text-left flex items-center gap-1.5 font-sans">
                                    <span className="text-[9px] font-serif italic text-slate-500">Date:</span>
                                    <span className="font-mono text-xs md:text-sm font-extrabold border-b border-slate-400 px-3 tracking-widest text-slate-800">
                                      {checkDate}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 bg-white border border-slate-405 px-2.5 py-1.5 rounded-md shadow-inner">
                                    <span className="font-serif italic font-bold text-xs text-slate-400">$</span>
                                    <span className="font-mono text-xs md:text-sm font-black tracking-tight text-slate-900 select-all">
                                      {netPay.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>

                                {/* Fila 3: Payee line */}
                                <div className="flex items-end gap-1.5 z-10 px-1 font-sans">
                                  <span className="text-[8px] uppercase font-black tracking-wider text-slate-500 whitespace-nowrap leading-none select-none italic font-serif">Pay to the Order of:</span>
                                  <div className="flex-1 border-b border-dotted border-slate-400 pb-0.5 text-left font-serif font-black text-xs md:text-sm tracking-wide text-slate-900 px-2 uppercase italic leading-none">
                                    {settlementRep.nombre} {settlementRep.apellido}
                                  </div>
                                </div>

                                {/* Fila 4: Spelled out check value */}
                                <div className="flex items-end gap-1.5 z-10 px-1 font-sans">
                                  <div className="flex-1 border-b border-dotted border-slate-400 pb-0.5 text-left font-serif text-[9px] md:text-xs font-black text-slate-800 uppercase italic px-1 leading-none">
                                    {numberToWordsEnglish(netPay)} DOLLARS
                                  </div>
                                </div>

                                {/* Fila 5: MEMO & FIRMA */}
                                <div className="flex justify-between items-end gap-6 z-10 px-1 pb-1 font-sans">
                                  <div className="flex-1 flex items-end gap-1 text-left min-w-0 font-sans">
                                    <span className="text-[9px] italic font-serif text-slate-500 leading-none">Memo:</span>
                                    <div className="flex-1 border-b border-slate-300 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] font-medium text-slate-600 px-1 uppercase">
                                      {customMemo}
                                    </div>
                                  </div>
                                  
                                  <div className="w-1/3 text-center pb-0 pl-4 relative shrink-0">
                                    <div className="font-serif italic font-extrabold text-[10px] text-blue-700 mb-0.5 absolute bottom-4 left-1/2 -translate-x-1/2 rotate-[-4deg] z-0 select-none opacity-85 pointer-events-none">
                                      B2B POS Master Admin
                                    </div>
                                    <div className="border-t border-slate-400 w-full pt-1 text-[7px] uppercase tracking-widest font-black text-slate-400 font-sans z-10 relative">
                                      Authorized Signature
                                    </div>
                                  </div>
                                </div>

                                {/* Fila 6: Banda MICR */}
                                <div className="w-full text-center font-mono font-bold tracking-widest text-[#152e0c] select-all select-none pt-0 bg-[#fbfdf7]/40 z-10 text-[9px] md:text-xs">
                                  ⑆021000021⑆ 0244670267⑈ {checkNumber}
                                </div>
                              </>
                            ) : (
                              <div className="hidden">
                                {/* En pantalla, el talonario se renderiza fuera de este contenedor de aspecto fijo, para evitar deformaciones */}
                              </div>
                            )}

                          </div>

                          {/* Renderizado de la Colilla (Pay Stub) interactiva solo en modo 'stub' */}
                          {activePreviewTab === 'stub' && (
                            <div className="w-full border border-slate-200 rounded-xl bg-white p-5 space-y-4 shadow-xl text-xs font-sans text-slate-800 animate-fadeIn">
                              {/* Cabecera Empleador / Empleado */}
                              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-200">
                                <div>
                                  <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5 font-bold">Employer / Empleador</span>
                                  <span className="font-black text-slate-800 block text-xs">B2B POS MASTER CORP.</span>
                                  <span className="text-[10px] text-slate-500 block leading-tight">100 Wall Street, New York, NY 10005</span>
                                </div>
                                <div className="font-sans">
                                  <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5 font-bold font-sans">Employee / Vendedor</span>
                                  <span className="font-black text-slate-800 block text-xs">{settlementRep.nombre} {settlementRep.apellido}</span>
                                  <span className="text-[10px] text-slate-500 block leading-tight">Tipo: {isW2 ? 'W-2 Regular Employee' : '1099 Contractor'}</span>
                                  <span className="font-mono text-[10px] text-indigo-700 font-bold block mt-0.5">SSN/Tax ID: {settlementRep.ssn || settlementRep.taxId || 'XXX-XX-XXXX'}</span>
                                </div>
                              </div>

                              {/* Tiempos y Períodos */}
                              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center font-semibold text-[10px]">
                                <div>
                                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Pay Period Start</span>
                                  <span className="font-mono text-slate-700">{period.start}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Pay Period End</span>
                                  <span className="font-mono text-slate-700">{period.end}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Check / Pay Date</span>
                                  <span className="font-mono text-slate-700">{checkDate}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Check Number</span>
                                  <span className="font-mono text-slate-700">#{checkNumber}</span>
                                </div>
                              </div>

                              {/* Tabla de Ganancias */}
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-1">Detailed Gross Earnings / Ingresos Brutos</span>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-left text-xs bg-white">
                                    <thead>
                                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                                        <th className="p-2">Description</th>
                                        <th className="p-2 text-center">Units (Qty)</th>
                                        <th className="p-2 text-right">Rate / Commission</th>
                                        <th className="p-2 text-right font-sans">Current gross</th>
                                        <th className="p-2 text-right">YTD Gross</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr className="border-b border-slate-100 font-medium font-sans">
                                        <td className="p-2 font-bold text-slate-800">Comisiones de POS Vendidos</td>
                                        <td className="p-2 text-center font-mono font-bold">{overridePosUnits} u</td>
                                        <td className="p-2 text-right font-mono text-slate-600">
                                          {tempCommType === 'percentage' ? `${tempCommRate}%` : `$${tempCommRate.toFixed(2)}/u`}
                                        </td>
                                        <td className="p-2 text-right font-mono font-bold text-slate-800">${comisionCalculada.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="p-2 text-right font-mono text-slate-500">${ytdGross.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      </tr>
                                      <tr className="bg-slate-50/50 font-black border-t border-slate-200">
                                        <td className="p-2 uppercase text-[10px] text-slate-500 font-sans font-bold">Total Earnings</td>
                                        <td className="p-2 text-center font-mono text-slate-500 font-bold">{overridePosUnits} u</td>
                                        <td className="p-2 text-right font-mono font-sans">-</td>
                                        <td className="p-2 text-right font-mono text-slate-900">${comisionCalculada.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="p-2 text-right font-mono text-slate-600">${ytdGross.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Tabla de Deducciones Fiscales */}
                              <div className="space-y-1 font-sans">
                                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-1">Deductions and Tax Withholdings / Retenciones e Impuestos</span>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-left text-xs text-slate-800 font-sans bg-white">
                                    <thead>
                                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                                        <th className="p-2">Description</th>
                                        <th className="p-2 text-center">IRS Reference</th>
                                        <th className="p-2 text-right">Applicable %</th>
                                        <th className="p-2 text-right">Current Period</th>
                                        <th className="p-2 text-right">YTD Cumulative</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {isW2 ? (
                                        <>
                                          <tr className="border-b border-slate-100 font-medium font-sans">
                                            <td className="p-2 font-bold text-slate-800">FIT - Federal Income Tax</td>
                                            <td className="p-2 text-center text-slate-500">IRS Section 3402</td>
                                            <td className="p-2 text-right font-bold text-indigo-700">{taxFitRate}%</td>
                                            <td className="p-2 text-right text-rose-600 font-bold">-${fitDeduction.toFixed(2)}</td>
                                            <td className="p-2 text-right text-slate-505">-${ytdFit.toFixed(2)}</td>
                                          </tr>
                                          <tr className="border-b border-slate-100 font-medium font-sans">
                                            <td className="p-2 font-bold text-slate-800">SIT - State Income Tax</td>
                                            <td className="p-2 text-center text-slate-500">State Revenue Code</td>
                                            <td className="p-2 text-right font-bold text-indigo-700">{taxSitRate}%</td>
                                            <td className="p-2 text-right text-rose-600 font-bold">-${sitDeduction.toFixed(2)}</td>
                                            <td className="p-2 text-right text-slate-505">-${ytdSit.toFixed(2)}</td>
                                          </tr>
                                          <tr className="border-b border-slate-100 font-medium font-sans">
                                            <td className="p-2 font-bold text-slate-800">FICA Social Security</td>
                                            <td className="p-2 text-center text-slate-500">OASDI Act</td>
                                            <td className="p-2 text-right">6.20%</td>
                                            <td className="p-2 text-right text-rose-600">-${ssDeduction.toFixed(2)}</td>
                                            <td className="p-2 text-right text-slate-505">-${ytdSs.toFixed(2)}</td>
                                          </tr>
                                          <tr className="border-b border-slate-100 font-medium font-sans">
                                            <td className="p-2 font-sans font-bold text-slate-800">FICA Medicare</td>
                                            <td className="p-2 text-center text-slate-500">Hospital Ins.</td>
                                            <td className="p-2 text-right">1.45%</td>
                                            <td className="p-2 text-right text-rose-600">-${medicareDeduction.toFixed(2)}</td>
                                            <td className="p-2 text-right text-slate-505">-${ytdMedicare.toFixed(2)}</td>
                                          </tr>
                                          <tr className="border-b border-slate-100 font-medium font-sans">
                                            <td className="p-2 font-bold text-slate-800">Disability / SUI SDI</td>
                                            <td className="p-2 text-center text-slate-500">SUI Unemployment</td>
                                            <td className="p-2 text-right">0.50%</td>
                                            <td className="p-2 text-right text-rose-600">-${suiDeduction.toFixed(2)}</td>
                                            <td className="p-2 text-right text-slate-505">-${ytdSui.toFixed(2)}</td>
                                          </tr>
                                          <tr className="bg-slate-50/50 font-black border-t border-slate-205">
                                            <td className="p-2 uppercase text-[10px] text-slate-500 font-bold font-sans">Total Deductions</td>
                                            <td className="p-2 text-center text-slate-500 font-sans">Withholding Sum</td>
                                            <td className="p-2 text-right">15.85%</td>
                                            <td className="p-2 text-right font-mono text-rose-600 font-bold">-${totalDeductions.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="p-2 text-right font-mono text-slate-600">-${ytdTotalDeductions.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                          </tr>
                                        </>
                                      ) : (
                                        <tr className="font-medium text-slate-500 font-sans">
                                          <td colSpan={5} className="p-6 text-center italic bg-slate-50 font-sans">
                                            Este comisionista es Contractor 1099 independiente. No aplica retenciones de taxes o seguros federales/estatales.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Resumen Inferior ADP */}
                              <div className="grid grid-cols-3 gap-4 border-t-2 border-slate-300 border-double pt-4 text-center font-black">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-205">
                                  <span className="text-[10px] text-slate-400 block uppercase font-sans">Gross commissions</span>
                                  <span className="font-mono text-slate-800 text-sm">${comisionCalculada.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="font-mono text-[9px] text-slate-400 block mt-1">YTD Gross: ${ytdGross.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-205 col-span-1">
                                  <span className="text-[10px] text-slate-400 block uppercase">Taxes Withheld</span>
                                  <span className="font-mono text-rose-600 text-sm">-${totalDeductions.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="font-mono text-[9px] text-slate-400 block mt-1">YTD Taxes: ${ytdTotalDeductions.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 font-sans">
                                  <span className="text-[10px] text-emerald-800 block uppercase">Net pays value</span>
                                  <span className="font-mono text-emerald-700 text-base font-black">${netPay.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="font-mono text-[9px] text-emerald-600 block mt-1 leading-none font-sans">YTD Net: ${ytdNetPay.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </div>

                            </div>
                          )}

                        </div>

                        {/* ========================================================= */}
                        {/* ELEMENTO IMPRIMIBLE OFICIAL (Stack vertical: Check + Stub) */}
                        {/* ========================================================= */}
                        {createPortal(
                          <div id="printable-payroll-document" className="hidden print:block font-sans p-2 text-black bg-white w-full max-w-4xl mx-auto space-y-6">
                          
                          {/* PARTE DE ARRIBA: EL CHEQUE BANCARIO */}
                          <div className="w-full aspect-[2.1/1] border border-black bg-white p-6 flex flex-col justify-between relative overflow-hidden box-border font-sans">
                            
                            <div className="absolute inset-0 border border-slate-300 m-2 rounded pointer-events-none"></div>

                            <div className="flex justify-between items-start">
                              <div className="text-left font-sans">
                                <h2 className="text-sm font-black text-slate-900 tracking-wide uppercase">B2B POS MASTER CORP.</h2>
                                <p className="text-[9px] text-slate-500 font-bold leading-tight uppercase">Corporate Sales Clearance</p>
                                <p className="text-[8px] text-slate-400 font-medium">100 Wall Street, New York, NY 10005</p>
                              </div>
                              <div className="text-right font-serif font-black text-slate-800 text-sm">
                                No. <span className="text-lg tracking-wider font-extrabold">{checkNumber}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center px-1 mt-1">
                              <div className="text-left flex items-center gap-1.5 font-sans">
                                <span className="text-[10px] font-serif italic text-slate-500 font-bold">Date:</span>
                                <span className="font-mono text-xs font-extrabold border-b border-black px-4 tracking-widest text-black">
                                  {checkDate}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 bg-white border border-black px-3 py-1 rounded">
                                <span className="font-serif italic font-bold text-xs">$</span>
                                <span className="font-mono text-sm font-black text-black">
                                  {netPay.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-end gap-1.5 px-1 font-sans">
                              <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 whitespace-nowrap leading-none italic font-serif">Pay to the Order of:</span>
                              <div className="flex-1 border-b border-dashed border-black pb-0.5 text-left font-serif font-black text-sm tracking-wide text-black px-2 uppercase italic leading-none">
                                {settlementRep.nombre} {settlementRep.apellido}
                              </div>
                            </div>

                            <div className="flex items-end gap-1.5 px-1 font-sans font-serif">
                              <div className="flex-1 border-b border-dashed border-black pb-0.5 text-left font-serif text-[10px] md:text-sm font-black text-black uppercase italic px-1 leading-none select-all font-serif">
                                {numberToWordsEnglish(netPay)} DOLLARS
                              </div>
                            </div>

                            <div className="flex justify-between items-end gap-6 px-1 pb-1 font-sans">
                              <div className="flex-1 flex items-end gap-1 text-left min-w-0 font-sans">
                                <span className="text-[10px] italic font-serif text-slate-500 leading-none">Memo:</span>
                                <div className="flex-1 border-b border-black overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] font-medium text-slate-650 px-1 uppercase leading-none font-mono">
                                  {customMemo}
                                </div>
                              </div>
                              <div className="w-1/3 text-center pb-0 pl-4 relative shrink-0">
                                <div className="font-serif italic font-extrabold text-[10px] text-slate-800 mb-0.5 absolute bottom-4 left-1/2 -translate-x-1/2 rotate-[-4deg] z-0 select-none opacity-85 pointer-events-none font-serif">
                                  B2B POS Master Admin
                                </div>
                                <div className="border-t border-black w-full pt-1 text-[7px] uppercase tracking-widest font-black text-slate-400 font-sans z-10 relative">
                                  Authorized Signature
                                </div>
                              </div>
                            </div>

                            <div className="w-full text-center font-mono font-bold tracking-widest text-slate-900 pt-0 z-10 text-[10px]">
                              ⑆021000021⑆ 0244670267⑈ {checkNumber}
                            </div>
                          </div>

                          {/* LÍNEA DE CORTE EN IMPRESIÓN */}
                          <div className="w-full border-t border-dashed border-slate-400 relative my-4 block print:block">
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-3 font-mono text-[8px] uppercase tracking-wider text-slate-400 font-bold border border-slate-200 rounded">
                              ✂️ DETACH BEFORE DEPOSITING AND RETAIN AS STATEMENT
                            </span>
                          </div>

                          {/* PARTE DE ABAJO: EL TALONARIO OFICIAL COMPLIANT DE EE. UU. (EARNINGS STATEMENT) */}
                          <div className="w-full border border-slate-300 bg-white p-5 space-y-3 rounded-lg text-[10px] leading-snug">
                            
                            {/* Encabezado lateral */}
                            <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-300">
                              <div className="font-sans">
                                <span className="text-[8px] uppercase font-bold text-slate-500 block mb-0.5 font-bold">Employer Address</span>
                                <span className="font-black text-slate-900 block text-xs">B2B POS MASTER CORP.</span>
                                <span className="text-[9px] text-slate-500 block leading-tight">100 Wall Street, New York, NY 10005</span>
                              </div>
                              <div className="text-right font-sans">
                                <span className="text-[8px] uppercase font-bold text-slate-505 text-slate-500 block mb-0.5 font-bold">Earnings Statement / Pay Stub</span>
                                <span className="font-black text-slate-900 block text-xs uppercase leading-none font-sans">{settlementRep.nombre} {settlementRep.apellido}</span>
                                <span className="text-[9px] text-slate-500 block leading-tight mt-1">Estatus: {isW2 ? 'W-2 Regular Employee' : '1099 Contractor'}</span>
                                <span className="font-mono text-[9px] text-indigo-700 font-bold block mt-0.5">SSN/Tax ID: {settlementRep.ssn || settlementRep.taxId || 'XXX-XX-XXXX'}</span>
                              </div>
                            </div>

                            {/* ADP Payroll details */}
                            <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded border border-slate-200 text-center text-[9px] font-bold">
                              <div>
                                <span className="text-[8px] text-slate-400 block uppercase mb-0.5">Period Start</span>
                                <span className="font-mono text-slate-800">{period.start}</span>
                              </div>
                              <div>
                                <span className="text-[8px] text-slate-400 block uppercase mb-0.5">Period End</span>
                                <span className="font-mono text-slate-800">{period.end}</span>
                              </div>
                              <div>
                                <span className="text-[8px] text-slate-400 block uppercase mb-0.5">Pay Date</span>
                                <span className="font-mono text-slate-800">{checkDate}</span>
                              </div>
                              <div>
                                <span className="text-[8px] text-slate-400 block uppercase mb-0.5">No. Cheque</span>
                                <span className="font-mono text-slate-800">#{checkNumber}</span>
                              </div>
                            </div>

                            {/* Tabla de ganancias */}
                            <div className="space-y-1">
                              <span className="text-[8px] uppercase font-black text-slate-500 tracking-wider block font-bold">EARNINGS / INGRESOS DETALLADOS</span>
                              <div className="border border-slate-300 rounded overflow-hidden">
                                <table className="w-full text-left text-[10px] bg-white">
                                  <thead>
                                    <tr className="bg-slate-50 text-[8px] font-bold uppercase text-slate-500 border-b border-slate-300">
                                      <th className="p-1.5">Description</th>
                                      <th className="p-1.5 text-center">Amount (POS u)</th>
                                      <th className="p-1.5 text-right">Commission Rate</th>
                                      <th className="p-1.5 text-right">Current Gross</th>
                                      <th className="p-1.5 text-right font-sans">YTD Gross</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="border-b border-slate-200">
                                      <td className="p-1.5 font-bold">POS Terminal Sales Commission</td>
                                      <td className="p-1.5 text-center font-mono font-bold">{overridePosUnits} u</td>
                                      <td className="p-1.5 text-right font-mono text-slate-600">
                                        {tempCommType === 'percentage' ? `${tempCommRate}%` : `$${tempCommRate.toFixed(2)}`}
                                      </td>
                                      <td className="p-1.5 text-right font-mono font-bold text-slate-800">${comisionCalculada.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td className="p-1.5 text-right font-mono text-slate-500">${ytdGross.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr className="bg-slate-50/50 font-bold border-t border-slate-200">
                                      <td className="p-1.5 uppercase text-[8px] text-slate-500">Gross Salaries / Earning totals</td>
                                      <td className="p-1.5 text-center font-mono text-slate-500">{overridePosUnits} u</td>
                                      <td className="p-1.5 text-right font-mono">-</td>
                                      <td className="p-1.5 text-right font-mono text-slate-900">${comisionCalculada.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td className="p-1.5 text-right font-mono text-slate-500">${ytdGross.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Tabla de deductions */}
                            <div className="space-y-1 font-sans">
                              <span className="text-[8px] uppercase font-black text-slate-500 tracking-wider block font-bold font-sans">TAX AND DEDUCTIONS WITHHOLDINGS / RETENCIONES E IMPUESTOS EE.UU.</span>
                              <div className="border border-slate-300 rounded overflow-hidden">
                                <table className="w-full text-left text-[10px] bg-white">
                                  <thead>
                                    <tr className="bg-slate-50 text-[8px] font-bold uppercase text-slate-500 border-b border-slate-300 font-sans">
                                      <th className="p-1.5 font-sans whitespace-nowrap">Description</th>
                                      <th className="p-1.5 text-center font-sans">IRS Reference</th>
                                      <th className="p-1.5 text-right font-sans">Applicable %</th>
                                      <th className="p-1.5 text-right font-sans">Current Period</th>
                                      <th className="p-1.5 text-right font-sans">YTD Cumulative</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {isW2 ? (
                                      <>
                                        <tr className="border-b border-slate-200 font-sans">
                                          <td className="p-1.5 font-sans font-bold">FIT - Federal Income Tax</td>
                                          <td className="p-1.5 text-center text-slate-500">IRS Section 3402</td>
                                          <td className="p-1.5 text-right font-mono">{taxFitRate}%</td>
                                          <td className="p-1.5 text-right font-mono text-rose-700">-${fitDeduction.toFixed(2)}</td>
                                          <td className="p-1.5 text-right font-mono text-slate-505">-${ytdFit.toFixed(2)}</td>
                                        </tr>
                                        <tr className="border-b border-slate-200 font-sans">
                                          <td className="p-1.5 font-sans font-bold animate-pulse">SIT - State Income Tax</td>
                                          <td className="p-1.5 text-center text-slate-500 font-sans">State Code</td>
                                          <td className="p-1.5 text-right font-mono">{taxSitRate}%</td>
                                          <td className="p-1.5 text-right font-mono text-rose-700">-${sitDeduction.toFixed(2)}</td>
                                          <td className="p-1.5 text-right font-mono text-slate-505">-${ytdSit.toFixed(2)}</td>
                                        </tr>
                                        <tr className="border-b border-slate-200 font-sans">
                                          <td className="p-1.5 font-sans font-bold">FICA Social Security Retentions</td>
                                          <td className="p-1.5 text-center text-slate-505 text-slate-500">OASDI Act</td>
                                          <td className="p-1.5 text-right font-mono">6.20%</td>
                                          <td className="p-1.5 text-right font-mono text-rose-700">-${ssDeduction.toFixed(2)}</td>
                                          <td className="p-1.5 text-right font-mono text-slate-505">-${ytdSs.toFixed(2)}</td>
                                        </tr>
                                        <tr className="border-b border-slate-200 font-sans">
                                          <td className="p-1.5 font-sans font-bold">FICA Medicare Retentions</td>
                                          <td className="p-1.5 text-center text-slate-500">Hospital Ins.</td>
                                          <td className="p-1.5 text-right font-mono">1.45%</td>
                                          <td className="p-1.5 text-right font-mono text-rose-700">-${medicareDeduction.toFixed(2)}</td>
                                          <td className="p-1.5 text-right font-mono text-slate-505">-${ytdMedicare.toFixed(2)}</td>
                                        </tr>
                                        <tr className="border-b border-slate-200 font-sans">
                                          <td className="p-1.5 font-sans font-bold">SUI Disability / SDI Unemployment</td>
                                          <td className="p-1.5 text-center text-slate-500">State SUI Tax</td>
                                          <td className="p-1.5 text-right font-mono">0.50%</td>
                                          <td className="p-1.5 text-right font-mono text-rose-700">-${suiDeduction.toFixed(2)}</td>
                                          <td className="p-1.5 text-right font-mono text-slate-555 text-slate-500">-${ytdSui.toFixed(2)}</td>
                                        </tr>
                                        <tr className="bg-slate-50/50 font-bold border-t border-slate-300">
                                          <td className="p-1.5 uppercase text-[8px] text-slate-500 font-bold">Total Print Withholdings</td>
                                          <td className="p-1.5 text-center text-slate-500">Withholding Sum</td>
                                          <td className="p-1.5 text-right">15.85%</td>
                                          <td className="p-1.5 text-right font-mono text-rose-700">-${totalDeductions.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                          <td className="p-1.5 text-right font-mono text-slate-500">-${ytdTotalDeductions.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                      </>
                                    ) : (
                                      <tr>
                                        <td colSpan={5} className="p-4 text-center italic text-slate-500 bg-slate-50 font-sans">
                                          Independent Contractor 1099. No tax deductions withheld by the employer company.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Resumen de totales */}
                            <div className="grid grid-cols-3 gap-2 border-t-2 border-slate-300 border-double pt-3 text-center font-bold">
                              <div className="bg-slate-50 p-1.5 rounded border border-slate-200 font-sans">
                                <span className="text-[8px] text-slate-400 block uppercase leading-none mb-1">Gross Payment</span>
                                <span className="font-mono text-[10px] text-slate-800">${comisionCalculada.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <p className="font-mono text-[8px] text-slate-400 block mt-0.5 leading-none">YTD Gross: ${ytdGross.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              </div>
                              <div className="bg-slate-50 p-1.5 rounded border border-slate-200 font-sans">
                                <span className="text-[8px] text-slate-400 block uppercase leading-none mb-1">Total taxes withheld</span>
                                <span className="font-mono text-[10px] text-rose-700">-${totalDeductions.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <p className="font-mono text-[8px] text-slate-400 block mt-0.5 leading-none">YTD Taxes: ${ytdTotalDeductions.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              </div>
                              <div className="bg-slate-100 p-1.5 rounded border border-slate-200 font-sans">
                                <span className="text-[8px] text-slate-500 block uppercase leading-none mb-1">Net Pay Received value</span>
                                <span className="font-mono text-[10px] text-emerald-700 font-extrabold">${netPay.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <p className="font-mono text-[8px] text-emerald-600 block mt-0.5 leading-none">YTD Net Pay: ${ytdNetPay.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              </div>
                            </div>

                            <div className="text-center text-[7px] text-slate-400 pt-1 border-t border-slate-200 font-sans">
                              THIS IS A PROFESSIONAL US GOVERNMENT-COMPLIANT STATEMENT OF EARNINGS. RETAIN THIS FOR YOUR TAX FILING RECORDS.
                            </div>

                          </div>
                        </div>,
                        document.body
                        )}

                      </div>

                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="text-left font-sans">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase font-mono block">Instrucción de Impresión de Nómina</span>
                        <span className="text-[11px] text-slate-500 font-medium">Al pulsar "Imprimir Cheque con Talonario", el navegador aislará la página para imprimir tanto el Cheque como la Colilla de Nómina US (Pay Stub) alineados profesionalmente.</span>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setSettlementRep(null)}
                          className="px-4 py-2 border border-slate-300 bg-white rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                        >
                          Cerrar
                        </button>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-md shadow-emerald-100"
                        >
                          🖨️ Imprimir Cheque con Talonario
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* Application Detail Overlaid Modal */}
            {selectedReg && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col text-slate-800">
                  
                  {/* Modal Header */}
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">
                        Reviewing Merchant File
                      </span>
                      <h3 className="text-xl font-extrabold text-slate-950 mt-1">{selectedReg.busStoreNameDba}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Submitted by rep: {selectedReg.salesmanName} on {new Date(selectedReg.createdAt).toLocaleString()}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedReg(null)}
                      className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 md:p-8 overflow-y-auto space-y-8 flex-1 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      
                      {/* Left Column: Owner & Bank Info */}
                      <div className="space-y-6">
                        {/* Owner Section */}
                        <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-5 space-y-4">
                          <h4 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-4.5 h-4.5 text-blue-600" />
                            Owner Info (Datos del Dueño)
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Name:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.ownerFirstName} {selectedReg.ownerLastName}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">DOB:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.ownerDob}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">SSN:</span>
                              <span className="font-extrabold text-slate-800 tracking-wider font-mono">{selectedReg.ownerSsn}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Country:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.ownerCountry}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400 font-bold uppercase block">Cell Phone:</span>
                              <span className="font-extrabold text-slate-800 font-mono">{selectedReg.ownerCellPhone}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400 font-bold uppercase block">Email:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.ownerEmail}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400 font-bold uppercase block">Home Address:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.ownerHomeAddress} {selectedReg.ownerApartment && `, Apt ${selectedReg.ownerApartment}`}</span>
                              <span className="font-semibold text-slate-600 block">{selectedReg.ownerCity}, {selectedReg.ownerState}, {selectedReg.ownerZipCode}</span>
                            </div>
                          </div>
                        </div>

                        {/* Bank Details */}
                        <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-5 space-y-4">
                          <h4 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-wider flex items-center gap-2">
                            <CreditCard className="w-4.5 h-4.5 text-blue-600" />
                            Funds Settlements & Projections
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="col-span-2">
                              <span className="text-slate-400 font-bold uppercase block">Bank Name:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.bankName}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400 font-bold uppercase block">Account Holder:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.bankAccountHolder}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Routing (9 Digits):</span>
                              <span className="font-extrabold text-slate-800 font-mono tracking-wider">{selectedReg.bankRoutingNumber}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Account:</span>
                              <span className="font-extrabold text-slate-800 font-mono tracking-wider">{selectedReg.bankAccountNumber}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Industry:</span>
                              <span className="font-extrabold text-indigo-700">{selectedReg.bankIndustryType}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Projected Monthly CC:</span>
                              <span className="font-extrabold text-indigo-700">{selectedReg.bankProjectedMonthlyCreditCardCharges}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400 font-bold uppercase block font-semibold text-slate-500">Est. Store Yearly Sales:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.bankProjectedYearlyStoreSales}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Business Profile & Documents Preview */}
                      <div className="space-y-6">
                        {/* Business Section */}
                        <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-5 space-y-4">
                          <h4 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-wider flex items-center gap-2">
                            <Building2 className="w-4.5 h-4.5 text-blue-600" />
                            Business Info (Datos del Comercio)
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Store DBA:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.busStoreNameDba}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Corporate Legal:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.busLegalName}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Legal structure:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.busLegalType}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Tax ID / EIN:</span>
                              <span className="font-extrabold text-slate-800 font-mono tracking-wider">{selectedReg.busTaxId}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Store Phone:</span>
                              <span className="font-extrabold text-slate-800 font-mono">{selectedReg.busPhone}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase block">Est. date:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.busEstablishedDate}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400 font-bold uppercase block">Physical Address:</span>
                              <span className="font-extrabold text-slate-800">{selectedReg.busPhysicalAddress}</span>
                              <span className="font-semibold text-slate-600 block">{selectedReg.busCity}, {selectedReg.busState}, {selectedReg.busZipCode}</span>
                            </div>
                          </div>
                        </div>

                        {/* Uploaded Photos Section with zoom trigger */}
                        <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-5 space-y-4">
                          <h4 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-wider flex items-center gap-2">
                            <Upload className="w-4.5 h-4.5 text-blue-600" />
                            Visual Attachments Docs (Soportes)
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            {selectedReg.docDriversLicense ? (
                              <div className="border border-slate-200 rounded-xl bg-white p-2.5 flex flex-col items-center justify-between shadow-sm">
                                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 text-center truncate w-full">Driver's License</span>
                                <img 
                                  src={selectedReg.docDriversLicense} 
                                  alt="DL Document" 
                                  onClick={() => setZoomImg(selectedReg.docDriversLicense)}
                                  className="h-16 w-auto object-cover rounded cursor-pointer hover:opacity-85 transition border border-slate-100"
                                  referrerPolicy="no-referrer"
                                />
                                <button
                                  type="button"
                                  onClick={() => setZoomImg(selectedReg.docDriversLicense)}
                                  className="text-[10px] text-blue-600 font-bold hover:underline mt-1.5"
                                >
                                  Zoom View 🔍
                                </button>
                              </div>
                            ) : (
                              <div className="border border-slate-200 border-dashed rounded-xl bg-white p-4 flex flex-col items-center justify-center text-slate-300">
                                <span className="text-[10px] uppercase font-bold text-slate-400">No DL Document</span>
                              </div>
                            )}

                            {selectedReg.docVoidedCheck ? (
                              <div className="border border-slate-200 rounded-xl bg-white p-2.5 flex flex-col items-center justify-between shadow-sm">
                                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 text-center truncate w-full">Voided Check</span>
                                <img 
                                  src={selectedReg.docVoidedCheck} 
                                  alt="Check Document" 
                                  onClick={() => setZoomImg(selectedReg.docVoidedCheck)}
                                  className="h-16 w-auto object-cover rounded cursor-pointer hover:opacity-85 transition border border-slate-100"
                                  referrerPolicy="no-referrer"
                                />
                                <button
                                  type="button"
                                  onClick={() => setZoomImg(selectedReg.docVoidedCheck)}
                                  className="text-[10px] text-blue-600 font-bold hover:underline mt-1.5"
                                >
                                  Zoom View 🔍
                                </button>
                              </div>
                            ) : (
                              <div className="border border-slate-200 border-dashed rounded-xl bg-white p-4 flex flex-col items-center justify-center text-slate-300">
                                <span className="text-[10px] uppercase font-bold text-slate-400">No Check Document</span>
                              </div>
                            )}

                            {selectedReg.docBusinessLicense ? (
                              <div className="border border-slate-200 rounded-xl bg-white p-2.5 flex flex-col items-center justify-between shadow-sm">
                                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 text-center truncate w-full">Biz License / EIN</span>
                                <img 
                                  src={selectedReg.docBusinessLicense} 
                                  alt="Biz Document" 
                                  onClick={() => setZoomImg(selectedReg.docBusinessLicense)}
                                  className="h-16 w-auto object-cover rounded cursor-pointer hover:opacity-85 transition border border-slate-100"
                                  referrerPolicy="no-referrer"
                                />
                                <button
                                  type="button"
                                  onClick={() => setZoomImg(selectedReg.docBusinessLicense)}
                                  className="text-[10px] text-blue-600 font-bold hover:underline mt-1.5"
                                >
                                  Zoom View 🔍
                                </button>
                              </div>
                            ) : null}

                            {selectedReg.docAdditional_1 ? (
                              <div className="border border-slate-200 rounded-xl bg-white p-2.5 flex flex-col items-center justify-between shadow-sm">
                                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 text-center truncate w-full">Adicional Doc</span>
                                <img 
                                  src={selectedReg.docAdditional_1} 
                                  alt="Additional Document" 
                                  onClick={() => setZoomImg(selectedReg.docAdditional_1)}
                                  className="h-16 w-auto object-cover rounded cursor-pointer hover:opacity-85 transition border border-slate-100"
                                  referrerPolicy="no-referrer"
                                />
                                <button
                                  type="button"
                                  onClick={() => setZoomImg(selectedReg.docAdditional_1)}
                                  className="text-[10px] text-blue-600 font-bold hover:underline mt-1.5"
                                >
                                  Zoom View 🔍
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Additional Notes review row */}
                    {selectedReg.notes && (
                      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 text-sm text-amber-800">
                        <span className="font-extrabold uppercase block text-xs tracking-wider text-amber-900 mb-1">Rep Notes (Mensaje de la Solicitud):</span>
                        "{selectedReg.notes}"
                      </div>
                    )}
                  </div>

                  {/* Modal Footer Controls */}
                  <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
                    <button
                      onClick={() => setSelectedReg(null)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-xl transition"
                    >
                      Close Window
                    </button>

                    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'merchantRegistrations', selectedReg.id), { status: 'testing' });
                            toast.success('Onboarding Application set to TESTING/PRUEBA mode');
                            setMerchantRegistrations(prev => prev.map(r => r.id === selectedReg.id ? { ...r, status: 'testing' } : r));
                            setSelectedReg(null);
                          } catch (err) {
                            toast.error('Failed to set testing status');
                          }
                        }}
                        disabled={selectedReg.status === 'testing'}
                        className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-extrabold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-40"
                      >
                        Poner en Pruebas
                      </button>

                      <button
                        onClick={() => {
                          setTestingReg(selectedReg);
                          setSimStatus('idle');
                          setSimLogs([
                            `[INFO] POS Terminal Hardware Sandbox initialized for ${selectedReg.busStoreNameDba}...`,
                            `[READY] Device on standby. Select a transaction configuration on the right and click "Test Transaction".`
                          ]);
                          setSelectedReg(null);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-indigo-100 flex items-center gap-1.5"
                      >
                        Probar en Simulador 💳
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'merchantRegistrations', selectedReg.id), { status: 'rejected' });
                            toast.success('Onboarding Application REJECTED/DENIED');
                            setMerchantRegistrations(prev => prev.map(r => r.id === selectedReg.id ? { ...r, status: 'rejected' } : r));
                            setSelectedReg(null);
                          } catch (err) {
                            toast.error('Failed to update status');
                          }
                        }}
                        disabled={selectedReg.status === 'rejected'}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-35"
                      >
                        Reject
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'merchantRegistrations', selectedReg.id), { status: 'approved' });
                            toast.success('Onboarding Application APPROVED successfully!');
                            setMerchantRegistrations(prev => prev.map(r => r.id === selectedReg.id ? { ...r, status: 'approved' } : r));
                            setSelectedReg(null);
                          } catch (err) {
                            toast.error('Failed to update status');
                          }
                        }}
                        disabled={selectedReg.status === 'approved'}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-100 disabled:opacity-35"
                      >
                        Approve Merchant
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Immersive Zoom Lightbox Overlay */}
            {zoomImg && (
              <div 
                className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
                onClick={() => setZoomImg(null)}
              >
                <div className="relative max-w-4xl max-h-[85vh] w-full flex flex-col justify-between items-center text-white">
                  <button 
                    onClick={() => setZoomImg(null)}
                    className="absolute -top-10 right-0 text-white hover:text-slate-300 font-medium text-sm bg-black/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" /> Close Zoom (Presionar para cerrar)
                  </button>
                  <img 
                    src={zoomImg} 
                    alt="Document Full Zoom" 
                    className="w-full h-auto max-h-[80vh] object-contain rounded-lg border border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}

            {/* TESTING SANDBOX MODAL */}
            {testingReg && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
                  
                  {/* Header */}
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[9px] font-black uppercase tracking-widest border border-indigo-500/30">
                          Interactive hardware Sandbox
                        </span>
                        <h3 className="text-lg font-black text-white mt-0.5">
                          POS Terminal & Commission Simulator
                        </h3>
                        <p className="text-xs text-slate-400">
                          Testing credit card processing setup for <span className="text-indigo-400 font-bold">{testingReg.busStoreNameDba}</span> (Rep: {testingReg.salesmanName})
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setTestingReg(null)}
                      className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 md:p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-8 flex-1">
                    
                    {/* Left Grid: Hardware / Card Reader Simulator */}
                    <div className="md:col-span-5 flex flex-col items-center justify-between space-y-6 border-r border-slate-800 pr-0 md:pr-8">
                      <div className="w-full space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-indigo-400" />
                          1. Configure Device Sensor
                        </h4>
                        
                        <div className="grid grid-cols-3 gap-2">
                          {(['Pax A920', 'Dejavoo QD4', 'Clover Flex'] as const).map(term => (
                            <button
                              key={term}
                              onClick={() => {
                                setSimTerminal(term);
                                setSimLogs(prev => [...prev, `[INFO] Conmutando terminal activa a: ${term}`]);
                              }}
                              className={`py-2 px-2.5 rounded-xl border text-[10px] font-bold text-center uppercase tracking-wider transition ${
                                simTerminal === term 
                                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                                  : 'bg-slate-800/45 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                              }`}
                            >
                              {term}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {(['chip', 'tap', 'swipe'] as const).map(met => (
                            <button
                              key={met}
                              onClick={() => {
                                setSimMethod(met);
                                setSimLogs(prev => [...prev, `[INFO] Conmutando interfaz del lector de tarjeta a: ${met.toUpperCase()}`]);
                              }}
                              className={`py-2 px-1 rounded-xl border text-[10px] font-bold text-center uppercase tracking-wider transition ${
                                simMethod === met 
                                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' 
                                  : 'bg-slate-800/20 border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                              }`}
                            >
                              {met === 'chip' ? 'Dip (Chip)' : met === 'tap' ? 'NFC (Tap)' : 'Mag (Swipe)'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Graphic Terminal Device Display */}
                      <div className="w-full max-w-[260px] bg-slate-950 rounded-[2.5rem] border-4 border-slate-700 p-4 shadow-xl relative overflow-hidden flex flex-col items-center">
                        {/* Status LEDs indicators */}
                        <div className="flex gap-2 mb-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${simStatus === 'processing' ? 'bg-amber-500 animate-ping' : simStatus === 'approved' ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                          <div className={`w-2.5 h-2.5 rounded-full ${simStatus === 'approved' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-800'}`} />
                          <div className={`w-2.5 h-2.5 rounded-full ${simStatus === 'declined' ? 'bg-red-500 animate-pulse' : 'bg-slate-800'}`} />
                        </div>

                        {/* Device Screen */}
                        <div className="w-full h-36 bg-blue-950/40 border border-blue-900 rounded-2xl p-3 flex flex-col justify-between items-center text-center font-mono">
                          <span className="text-[9px] text-blue-400 font-extrabold uppercase tracking-widest">{simTerminal} ACTIVE</span>
                          
                          <div className="text-white text-xs font-black uppercase tracking-wider py-1 select-none">
                            {simStatus === 'idle' && "STANDBY - READY"}
                            {simStatus === 'inserting' && "Dip card..."}
                            {simStatus === 'processing' && "PROCESSING..."}
                            {simStatus === 'approved' && "APPROVED ✔"}
                            {simStatus === 'declined' && "DECLINED ✖"}
                          </div>

                          <span className="text-[11px] text-blue-300 font-bold bg-blue-950/80 px-2.5 py-0.5 rounded-lg border border-blue-900 font-mono">
                            USD ${parseFloat(simAmount).toFixed(2)}
                          </span>
                        </div>

                        {/* Physical slot graphical highlight */}
                        <div className="w-full mt-4 flex flex-col items-center gap-1">
                          <div className={`w-11/12 h-2.5 rounded bg-slate-800 border ${simMethod === 'chip' ? 'border-indigo-400 animate-pulse' : 'border-slate-900'} relative`} />
                          <span className="text-[8px] font-black tracking-widest text-slate-500 uppercase">
                            {simMethod === 'chip' ? 'DIPIAR CHIP EMV AQUÍ' : simMethod === 'tap' ? 'APROXIMAR MÓVIL/TARJETA (NFC)' : 'DESLIZAR BANDA MAGNÉTICA'}
                          </span>
                        </div>
                      </div>

                      {/* Mock Credit Card Graphics */}
                      <div className="w-full space-y-3">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Card Emulator (Tarjeta del Cliente)
                        </span>
                        
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['visa', 'mc', 'amex', 'discover'] as const).map(brand => (
                            <button
                              key={brand}
                              onClick={() => {
                                setSimCardType(brand);
                                setSimLogs(prev => [...prev, `[INFO] Tarjeta simulada cambiada a la marca: ${brand.toUpperCase()}`]);
                              }}
                              className={`py-1.5 px-1 bg-slate-800/60 rounded-xl border text-[10px] font-black uppercase text-center tracking-wider transition ${
                                simCardType === brand 
                                  ? 'border-indigo-500 text-indigo-400' 
                                  : 'border-transparent text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {brand}
                            </button>
                          ))}
                        </div>

                        <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 rounded-2xl border border-indigo-500/20 p-4 font-mono relative text-white text-left select-none overflow-hidden h-28 flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-black uppercase text-indigo-300">
                              {simCardType.toUpperCase()} BUSINESS GOLD
                            </span>
                            <div className="w-7 h-5 bg-amber-400/80 rounded-sm border border-amber-300" />
                          </div>
                          <div className="text-sm font-bold tracking-widest">
                            {simCardType === 'visa' && "4111 2222 5555 9843"}
                            {simCardType === 'mc' && "5412 8831 2201 1149"}
                            {simCardType === 'amex' && "3782 129483 11048"}
                            {simCardType === 'discover' && "6011 8832 9481 0541"}
                          </div>
                          <div className="flex justify-between items-end text-[9px] text-indigo-300">
                            <div>
                              <span>HOLDER: </span>
                              <span className="font-extrabold text-white block uppercase">{testingReg.ownerFirstName} {testingReg.ownerLastName}</span>
                            </div>
                            <div className="text-right">
                              <span>EXPIRES: </span>
                              <span className="font-bold text-white block">07 / 2029</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Grid: Fee Calculations & Testing Sandbox Console */}
                    <div className="md:col-span-7 flex flex-col justify-between space-y-6">
                      
                      {/* Subtitle / Projections */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-indigo-400" /> 2. Set Rates & Projection values</span>
                          <span className="text-[10px] text-indigo-400 font-extrabold">Dual-Engine Surcharge Pricing</span>
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                              Simulated Gross Charge (Venta)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xs">$</span>
                              <input
                                type="number"
                                step="10.00"
                                value={simAmount}
                                onChange={(e) => setSimAmount(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700/80 pl-6 pr-3 py-1.5 rounded-xl font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                              Interchange Rate % (Network Cost)
                            </label>
                            <input
                              type="range"
                              min="0.8"
                              max="3.0"
                              step="0.1"
                              value={simInterchange}
                              onChange={(e) => setSimInterchange(parseFloat(e.target.value))}
                              className="w-full accent-indigo-500 my-1 font-mono"
                            />
                            <div className="flex justify-between text-[10px] font-mono font-bold text-indigo-300 mt-1">
                              <span>Cost: {simInterchange.toFixed(1)}%</span>
                              <span>Est: ${((parseFloat(simAmount) || 0) * simInterchange / 100).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-1">
                          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                              Salesperson Residual Split %
                            </label>
                            <input
                              type="range"
                              min="10"
                              max="90"
                              step="5"
                              value={simCommissionRate * 100}
                              onChange={(e) => setSimCommissionRate(parseFloat(e.target.value) / 100)}
                              className="w-full accent-indigo-500 my-1 font-mono"
                            />
                            <div className="flex justify-between text-[10px] font-mono font-bold text-indigo-300 mt-1">
                              <span>Rep Split: {(simCommissionRate * 100).toFixed(0)}%</span>
                              <span>Company: {((1 - simCommissionRate) * 100).toFixed(0)}%</span>
                            </div>
                          </div>

                          {/* Static Surcharge configuration info */}
                          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Merchant Fee Engine</span>
                            <div className="text-xs font-black text-indigo-400 flex items-center justify-between pb-1">
                              <span>Cash-Discount Fee:</span>
                              <span className="font-mono">3.5% Flat</span>
                            </div>
                            <span className="text-[8.5px] text-slate-500 leading-tight block">Merchant surcharge automatically transfers processing charges to the cardholder, rendering payment routing free for the store owner.</span>
                          </div>
                        </div>
                      </div>

                      {/* Calculations Panel */}
                      {(() => {
                        const amountVal = parseFloat(simAmount) || 0;
                        const surchargeCharged = amountVal * 0.035;
                        const costInterchange = amountVal * (simInterchange / 100);
                        const grossProfitMargin = Math.max(0, surchargeCharged - costInterchange);
                        const repShare = grossProfitMargin * simCommissionRate;
                        const companyNet = grossProfitMargin * (1 - simCommissionRate);

                        return (
                          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4">
                            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-800 pb-2">
                              Transaction Profit/Split Analysis (Cuentas e Intereses)
                            </h5>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div className="border border-slate-800 p-3 rounded-xl bg-slate-900/40">
                                <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Gross Surcharge (3.5%)</span>
                                <span className="text-sm font-black text-white font-mono mt-0.5 block">${surchargeCharged.toFixed(2)}</span>
                              </div>
                              <div className="border border-slate-800 p-3 rounded-xl bg-slate-900/40">
                                <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Interchange Cost ({simInterchange.toFixed(1)}%)</span>
                                <span className="text-sm font-black text-red-400 font-mono mt-0.5 block">-${costInterchange.toFixed(2)}</span>
                              </div>
                              <div className="border border-slate-800 p-3 rounded-xl bg-slate-900/40">
                                <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Residual Profit Margin</span>
                                <span className="text-sm font-black text-indigo-400 font-mono mt-0.5 block">${grossProfitMargin.toFixed(2)}</span>
                              </div>
                              <div className="border border-slate-800 p-3 rounded-xl bg-indigo-950/20 border-indigo-500/20">
                                <span className="text-[8px] text-indigo-400 font-bold block uppercase tracking-wider">Net Settlement</span>
                                <span className="text-sm font-black text-emerald-400 font-mono mt-0.5 block">${(amountVal).toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                                <div>
                                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest block">Sales Advisor Share ({(simCommissionRate * 100).toFixed(0)}%)</span>
                                  <span className="text-sm font-black text-white font-mono mt-0.5 block">${repShare.toFixed(2)}</span>
                                </div>
                                <span className="text-[9px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded uppercase font-sans">Residual</span>
                              </div>

                              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                                <div>
                                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest block">Net Company Revenue ({((1 - simCommissionRate) * 100).toFixed(0)}%)</span>
                                  <span className="text-sm font-black text-indigo-400 font-mono mt-0.5 block">${companyNet.toFixed(2)}</span>
                                </div>
                                <span className="text-[9px] bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded uppercase font-semibold font-sans">Platform Profit</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Log Console Output Simulator */}
                      <div className="w-full space-y-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Card Verification Logs (Historial de Procesamiento)
                        </span>
                        
                        <div className="h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-slate-300 space-y-1.5 overflow-y-auto select-text text-left">
                          {simLogs.map((log, lidx) => (
                            <div key={lidx} className={`${log.includes('[SUCCESS]') || log.includes('APROBADO') ? 'text-emerald-400' : log.includes('ERROR') || log.includes('RECHAZADO') ? 'text-red-400' : 'text-slate-300'}`}>
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Simulation Triggers */}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => handleSimulateTransaction(false)}
                          disabled={simStatus === 'processing'}
                          className="flex-1 py-3 bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 rounded-xl text-xs font-black uppercase tracking-widest transition disabled:opacity-40 font-sans"
                        >
                          Simular Declinar Pago (Decline Test)
                        </button>

                        <button
                          onClick={() => handleSimulateTransaction(true)}
                          disabled={simStatus === 'processing'}
                          className="flex-1 py-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 rounded-xl text-xs font-black uppercase tracking-widest transition disabled:opacity-40 shadow-lg shadow-emerald-950/20 font-sans"
                        >
                          Simular Aprobar Pago (Approve Test)
                        </button>
                      </div>

                    </div>

                  </div>

                  {/* Simulator Footer Controls and approvals */}
                  <div className="p-6 border-t border-slate-800 flex items-center justify-between bg-slate-950">
                    <button
                      onClick={() => setTestingReg(null)}
                      className="px-5 py-2.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-sm rounded-xl transition"
                    >
                      Exit Simulator Sandbox
                    </button>

                    <div className="flex gap-3">
                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'merchantRegistrations', testingReg.id), { status: 'rejected' });
                            toast.success('Onboarding Application REJECTED from simulator logs review');
                            setMerchantRegistrations(prev => prev.map(r => r.id === testingReg.id ? { ...r, status: 'rejected' } : r));
                            setTestingReg(null);
                          } catch (err) {
                            toast.error('Failed to deny registration');
                          }
                        }}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-lg shadow-red-100 font-sans"
                      >
                        Rechazar Solicitud
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'merchantRegistrations', testingReg.id), { status: 'approved' });
                            toast.success('Onboarding Application APPROVED successfully via hardware testing logs validation!');
                            setMerchantRegistrations(prev => prev.map(r => r.id === testingReg.id ? { ...r, status: 'approved' } : r));
                            setTestingReg(null);
                          } catch (err) {
                            toast.error('Failed to approve registration');
                          }
                        }}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-lg shadow-emerald-100 font-sans"
                      >
                        Aprobar Solicitud
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'landing_cms' && (
          <LandingCMS />
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Platform Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Store ID</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-bold text-slate-900">{u.nombre}</td>
                      <td className="px-6 py-4 text-slate-600">{u.email}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{u.storeId}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${u.role === 'admin' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'catalog_images' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Global Image Bank</h2>
                <p className="text-sm text-slate-500 font-medium">Drop a folder or multiple images to upload them globally</p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowUrlModal(true)}
                  className="bg-green-600/10 text-green-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-600/20 transition flex items-center gap-2"
                >
                  <Link className="w-4 h-4" /> Import from Sheets
                </button>
                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*';
                    input.webkitdirectory = true;
                    input.onchange = (e: any) => {
                      if (e.target.files) {
                        const files = Array.from(e.target.files) as File[];
                        const imageFiles = files.filter(f => f.type.startsWith('image/'));
                        if (imageFiles.length > 0) {
                          processImageFiles(imageFiles);
                        } else {
                          toast.error('No images found in the selected folder.');
                        }
                      }
                    };
                    input.click();
                  }}
                  className="px-4 py-2 bg-blue-100 text-blue-600 font-bold rounded-xl text-sm hover:bg-blue-200 transition flex items-center gap-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  Upload Folder
                </button>
                <button 
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to delete ALL images from the global bank? This will delete the database records.')) {
                      try {
                        // Firestore batches support up to 500 operations
                        for (let i = 0; i < globalImages.length; i += 500) {
                          const batch = writeBatch(db);
                          const chunk = globalImages.slice(i, i + 500);
                          chunk.forEach(img => {
                            batch.delete(doc(db, 'system', 'catalog', 'images', img.id));
                          });
                          await batch.commit();
                        }
                        toast.success('All images cleared from database');
                      } catch (error) {
                        console.error('Error clearing images:', error);
                        toast.error('Failed to clear images');
                      }
                    }
                  }}
                  className="px-4 py-2 bg-rose-100 text-rose-600 font-bold rounded-xl text-sm hover:bg-rose-200 transition flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Images
                </button>
                <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm relative">
                  <Tag className="w-4 h-4 text-slate-400 ml-2" />
                  <select 
                    value={imageBankFolder}
                    onChange={(e) => setImageBankFolder(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 pr-8"
                  >
                    {Array.from(new Set(['General', imageBankFolder !== 'NEW_FOLDER' ? imageBankFolder : 'General', ...globalImages.map(img => img.folder || 'General')])).map(folder => (
                      <option key={folder} value={folder}>{folder}</option>
                    ))}
                    <option value="NEW_FOLDER">+ New Folder...</option>
                  </select>
                  {imageBankFolder === 'NEW_FOLDER' && (
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Folder name..."
                      onBlur={(e) => {
                        if (e.target.value) setImageBankFolder(e.target.value);
                        else setImageBankFolder('General');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          if (val) setImageBankFolder(val);
                          else setImageBankFolder('General');
                        }
                      }}
                      className="absolute top-full left-0 mt-2 min-w-[200px] w-full p-3 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] font-bold text-sm"
                    />
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsPushingImages(true)}
                    className="bg-indigo-600/10 text-indigo-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-600/20 transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Push Folder
                  </button>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Images</p>
                    <p className="text-xl font-black text-slate-900">{globalImages.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8">
              <input 
                type="file" 
                ref={imageUploadInputRef} 
                onChange={handleImageSelect} 
                multiple 
                accept="image/*" 
                className="hidden" 
              />
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageDrop}
                onClick={() => !isUploadingImages && imageUploadInputRef.current?.click()}
                className={`
                  border-4 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer
                  ${isUploadingImages ? 'border-blue-200 bg-blue-50/30 cursor-not-allowed' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50/50'}
                `}
              >
                {isUploadingImages ? (
                  <div className="flex flex-col items-center animate-pulse">
                    <RefreshCw className="w-12 h-12 text-blue-600 mb-4 animate-spin" />
                    <p className="text-lg font-black text-blue-600">Uploading to {imageBankFolder}...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 text-blue-600 shadow-lg shadow-blue-100">
                      <Plus className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Drop Images Here or Click to Browse</h3>
                    <p className="text-slate-500 font-medium text-center max-w-xs">
                      Uploading to folder: <span className="text-blue-600 font-bold">{imageBankFolder}</span>
                    </p>
                  </>
                )}
              </div>

              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {globalImages
                  .filter(img => (img.folder || 'General') === imageBankFolder)
                  .map((img) => (
                  <div key={img.id} className="group relative aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                      <p className="text-[10px] text-white font-bold truncate w-full text-center mb-2">{img.name}</p>
                      <div className="flex gap-2">
                        <select
                          className="bg-slate-800 text-white text-[10px] rounded-lg border-none px-2 py-1 max-w-[80px]"
                          value={img.folder || 'General'}
                          onChange={async (e) => {
                            const newFolder = e.target.value;
                            try {
                              await updateDoc(doc(db, 'system', 'catalog', 'images', img.id), { folder: newFolder });
                              toast.success(`Moved to ${newFolder}`);
                            } catch (error) {
                              console.error('Error changing folder', error);
                              toast.error('Failed to move image');
                            }
                          }}
                        >
                          {Array.from(new Set(['General', imageBankFolder !== 'NEW_FOLDER' ? imageBankFolder : 'General', ...globalImages.map(i => i.folder || 'General')])).map(folder => (
                            <option key={folder} value={folder}>{folder}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Image',
                              message: 'Delete this image from global bank?',
                              type: 'danger',
                              confirmText: 'Delete',
                              onConfirm: async () => {
                                try {
                                  if (img.storagePath && img.storagePath !== 'base64_fallback') {
                                    const storageRef = ref(storage, img.storagePath);
                                    // Add a timeout to deleteObject to prevent hanging if storage is not configured
                                    const deletePromise = deleteObject(storageRef);
                                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
                                    await Promise.race([deletePromise, timeoutPromise]).catch(e => console.warn("Storage object not found, already deleted, or timeout", e));
                                  }
                                  await deleteDoc(doc(db, 'system', 'catalog', 'images', img.id));
                                  toast.success('Image deleted');
                                } catch (error) {
                                  console.error("Error deleting image:", error);
                                  toast.error("Failed to delete image");
                                }
                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                              }
                            });
                          }}
                          className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {globalImages.filter(img => (img.folder || 'General') === imageBankFolder).length === 0 && !isUploadingImages && (
                  <div className="col-span-full py-12 text-center text-slate-300">
                    <p className="font-bold">No images in folder "{imageBankFolder}".</p>
                  </div>
                )}
              </div>
            </div>

            {isPushingImages && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Push Images to Store</h2>
                      <p className="text-sm text-slate-500">Auto-match "{imageBankFolder}" images to products in a target store.</p>
                    </div>
                    <button onClick={() => setIsPushingImages(false)} className="p-2 hover:bg-slate-100 rounded-full transition">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Select Target Store</label>
                      <select 
                        value={pushImageTargetStore}
                        onChange={(e) => setPushImageTargetStore(e.target.value)}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition font-bold"
                      >
                        <option value="">Select a store...</option>
                        {stores.map(store => (
                          <option key={store.id} value={store.id}>{store.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl">
                      <p className="text-sm text-blue-800 font-medium">
                        This action will search all products in the selected store and update their <span className="font-bold">Image URL</span> if the 
                        product name perfectly matches (or closely matches) any image name in the <span className="font-bold">{imageBankFolder}</span> folder.
                      </p>
                    </div>

                    <button 
                      onClick={handlePushImagesToStore}
                      disabled={isLoading}
                      className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mt-4 flex items-center justify-center gap-2"
                    >
                      {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                      Sync Images to Products
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'rubros' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Business Types (Rubros)</h2>
                  <p className="text-sm text-slate-500 font-medium">Define which fields are available for import based on business type</p>
                </div>
                <button 
                  onClick={() => setIsAddingRubro(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-100"
                >
                  <Plus className="w-5 h-5" /> Create New Type
                </button>
              </div>

              {isAddingRubro && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">New Business Type</h2>
                      <button onClick={() => setIsAddingRubro(false)} className="p-2 hover:bg-slate-100 rounded-full transition">
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>
                    <form onSubmit={handleCreateRubro} className="space-y-4">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Type Name</label>
                        <input 
                          required
                          type="text" 
                          value={newRubroName}
                          onChange={e => setNewRubroName(e.target.value)}
                          className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition font-bold"
                          placeholder="e.g. Pharmacy, Hardware Store"
                        />
                      </div>
                      <button 
                        type="submit"
                        className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-100 mt-4"
                      >
                        Create Business Type
                      </button>
                    </form>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-8">
                {businessCategories.map((rubro) => (
                  <div key={rubro.id} className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-white rounded-2xl shadow-sm">
                          <Tag className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-900">{rubro.name}</h3>
                          <p className="text-xs text-slate-400 font-mono">{rubro.id}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: 'Delete Business Type',
                            message: `Delete business type "${rubro.name}"?`,
                            type: 'danger',
                            confirmText: 'Delete',
                            onConfirm: async () => {
                              await deleteDoc(doc(db, 'system', 'config', 'rubros', rubro.id));
                              toast.success('Business type deleted');
                              setConfirmModal(prev => ({ ...prev, isOpen: false }));
                            }
                          });
                        }}
                        className="p-3 text-rose-600 hover:bg-rose-50 rounded-2xl transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {ALL_RUBRO_FIELDS.map((field) => (
                        <div key={field} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-between gap-3">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                            {field === 'thermal80mm' ? 'Thermal 80mm' : 
                             field === 'printA4' ? 'Print A4' : 
                             field.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <button
                            onClick={async () => {
                              const currentVal = rubro.enabledFields[field as keyof typeof rubro.enabledFields] ?? false;
                              const updatedFields = { ...rubro.enabledFields, [field]: !currentVal };
                              await setDoc(doc(db, 'system', 'config', 'rubros', rubro.id), { name: rubro.name, enabledFields: updatedFields }, { merge: true });
                            }}
                            className={`w-12 h-6 rounded-full transition-all relative ${rubro.enabledFields[field as keyof typeof rubro.enabledFields] ? 'bg-emerald-500' : 'bg-slate-200'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${rubro.enabledFields[field as keyof typeof rubro.enabledFields] ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {businessCategories.length === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <ListFilter className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">No business types defined yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Global Product Catalog</h2>
                <p className="text-sm text-slate-500">Products available for all stores to import</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <select 
                    value={catalogFilterRubro}
                    onChange={(e) => setCatalogFilterRubro(e.target.value)}
                    className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Folders</option>
                    {businessCategories.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {catalogFilterRubro !== 'all' && (
                    <button 
                      onClick={() => setCatalogFilterRubro('all')}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Back to Folders
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 px-3 border-r border-slate-200">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <select 
                      value={smartImportTargetStore}
                      onChange={(e) => setSmartImportTargetStore(e.target.value)}
                      className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 pr-8"
                    >
                      <option value="">Target Store (Optional)</option>
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <input 
                    type="file" 
                    ref={smartImportInputRef}
                    onChange={handleSmartImport}
                    multiple
                    className="hidden"
                  />
                  <button 
                    onClick={() => smartImportInputRef.current?.click()}
                    disabled={isSmartImporting}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {isSmartImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                    Smart Import Folder
                  </button>
                </div>

                <button 
                  onClick={() => setIsPushingCatalog(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Push to Stores
                </button>
                <button
                  onClick={handleClearGlobalCatalog}
                  className="bg-red-600/10 text-red-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-600/20 transition flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Clear Catalog
                </button>
                <input 
                  type="file" 
                  ref={globalCatalogInputRef} 
                  onChange={handleGlobalCatalogImport} 
                  accept=".csv, .xlsx, .xls" 
                  className="hidden" 
                />
                <button 
                  onClick={downloadGlobalCatalogTemplate}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition"
                  title="Download Template"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => globalCatalogInputRef.current?.click()}
                  className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" /> Bulk Import
                </button>
                <button 
                  onClick={() => setShowUrlModal(true)}
                  className="bg-green-600/10 text-green-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-600/20 transition flex items-center gap-2"
                >
                  <Link className="w-4 h-4" /> Import from Sheets
                </button>
                <button 
                  onClick={() => setIsAddingGlobalProduct(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Global Product
                </button>
              </div>
            </div>
            
            {isPushingCatalog && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Push Catalog to Stores</h2>
                      <p className="text-sm text-slate-500">Copy products from a business type to selected stores</p>
                    </div>
                    <button onClick={() => setIsPushingCatalog(false)} className="p-2 hover:bg-slate-100 rounded-full transition">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">1. Select Business Type Source</label>
                      <select 
                        value={pushTargetRubro}
                        onChange={(e) => setPushTargetRubro(e.target.value)}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition font-bold"
                      >
                        <option value="">Select a type...</option>
                        {businessCategories.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">2. Select Target Stores (Filtered by Type)</label>
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 bg-slate-50 rounded-2xl">
                        {stores
                          .filter(store => !pushTargetRubro || store.businessCategory === pushTargetRubro)
                          .map(store => (
                          <label key={store.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:bg-blue-50 transition">
                            <input 
                              type="checkbox"
                              checked={pushSelectedStores.includes(store.id)}
                              onChange={(e) => {
                                if (e.target.checked) setPushSelectedStores(prev => [...prev, store.id]);
                                else setPushSelectedStores(prev => prev.filter(id => id !== store.id));
                              }}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm font-bold text-slate-700">{store.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          const filtered = stores.filter(store => !pushTargetRubro || store.businessCategory === pushTargetRubro);
                          setPushSelectedStores(filtered.map(s => s.id));
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Select All Filtered
                      </button>
                      <button 
                        onClick={() => setPushSelectedStores([])}
                        className="text-xs font-bold text-slate-400 hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>

                    <button 
                      onClick={handlePushCatalog}
                      disabled={isLoading}
                      className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mt-4 flex items-center justify-center gap-2"
                    >
                      {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                      Push Catalog Now
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {isAddingGlobalProduct && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">New Global Product</h2>
                    <button onClick={() => setIsAddingGlobalProduct(false)} className="p-2 hover:bg-slate-100 rounded-full transition">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                  <form onSubmit={handleAddGlobalProduct} className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Product Name</label>
                      <input 
                        required
                        type="text" 
                        value={newGlobalProduct.nombre}
                        onChange={e => setNewGlobalProduct({...newGlobalProduct, nombre: e.target.value})}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition font-bold"
                        placeholder="e.g. Paracetamol 500mg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Business Type (Rubro)</label>
                      <select 
                        required
                        value={newGlobalProduct.rubroId}
                        onChange={e => setNewGlobalProduct({...newGlobalProduct, rubroId: e.target.value})}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition font-bold"
                      >
                        <option value="">Select a type...</option>
                        {businessCategories.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Global Price</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        value={newGlobalProduct.precio}
                        onChange={e => setNewGlobalProduct({...newGlobalProduct, precio: parseFloat(e.target.value)})}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                      <input 
                        type="text" 
                        value={newGlobalProduct.categoria}
                        onChange={e => setNewGlobalProduct({...newGlobalProduct, categoria: e.target.value})}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Image URL (Optional)</label>
                      <input 
                        type="text" 
                        value={newGlobalProduct.imagen}
                        onChange={e => setNewGlobalProduct({...newGlobalProduct, imagen: e.target.value})}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition font-bold"
                        placeholder="Paste URL or use Image Bank"
                      />
                    </div>
                    {globalImages.length > 0 && (
                      <div className="mt-4">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Select from Image Bank</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          {globalImages.slice(0, 10).map(img => (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => setNewGlobalProduct({...newGlobalProduct, imagen: img.url})}
                              className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 transition ${newGlobalProduct.imagen === img.url ? 'border-blue-600' : 'border-transparent'}`}
                            >
                              <img src={img.url} alt="Bank" className="w-full h-full object-cover rounded-md" referrerPolicy="no-referrer" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button 
                      type="submit"
                      className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-100 mt-4"
                    >
                      Create Global Product
                    </button>
                  </form>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-widest">
                    <th className="px-6 py-4">Product Name</th>
                    <th className="px-6 py-4">Business Type</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {catalogFilterRubro === 'all' ? (
                    businessCategories.map(rubro => {
                      const productsInRubro = globalCatalog.filter(p => p.rubroId === rubro.id);
                      if (productsInRubro.length === 0) return null;
                      return (
                        <tr key={rubro.id} onClick={() => setCatalogFilterRubro(rubro.id)} className="cursor-pointer hover:bg-blue-50/50 transition group">
                          <td colSpan={5} className="px-6 py-8">
                            <div className="flex items-center gap-4">
                              <div className="p-4 bg-blue-100/50 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                                <Tag className="w-8 h-8" />
                              </div>
                              <div>
                                <div className="text-xl font-black text-slate-900 tracking-tight">{rubro.name}</div>
                                <div className="text-sm text-slate-500 font-medium">{productsInRubro.length} products in this category</div>
                              </div>
                              <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-sm font-bold text-blue-600">Open Folder →</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    globalCatalog
                      .filter(p => p.rubroId === catalogFilterRubro)
                      .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{p.nombre}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            {businessCategories.find(r => r.id === p.rubroId)?.name || 'No Type'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 font-medium">{p.categoria}</td>
                        <td className="px-6 py-4 font-black text-slate-900">${p.precio.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmModal({
                                isOpen: true,
                                title: 'Delete Product',
                                message: 'Delete from global catalog?',
                                type: 'danger',
                                confirmText: 'Delete',
                                onConfirm: async () => {
                                  await deleteDoc(doc(db, 'system', 'catalog', 'products', p.id));
                                  toast.success('Removed from global catalog');
                                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                }
                              });
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                  {globalCatalog.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Global catalog is empty.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-8">
            {/* P&L Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-widest">Total Revenue</span>
                </div>
                <h3 className="text-3xl font-black text-slate-900">
                  ${(
                    superAdminInvoices.reduce((acc, inv) => acc + inv.total, 0) +
                    stores.reduce((acc, s) => acc + (s.subscriptionAmount || 0), 0)
                  ).toLocaleString()}
                </h3>
                <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-wider">Invoices + Monthly Subs</p>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-full uppercase tracking-widest">Total COGS</span>
                </div>
                <h3 className="text-3xl font-black text-slate-900">
                  ${superAdminInvoices.reduce((acc, inv) => 
                    acc + inv.articulos.reduce((sum, art) => sum + (art.costo * art.cantidad), 0)
                  , 0).toLocaleString()}
                </h3>
                <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-wider">Equipment & Service Costs</p>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-widest">Gross Profit</span>
                </div>
                <h3 className="text-3xl font-black text-emerald-900">
                  ${(
                    (superAdminInvoices.reduce((acc, inv) => acc + inv.total, 0) +
                    stores.reduce((acc, s) => acc + (s.subscriptionAmount || 0), 0)) -
                    superAdminInvoices.reduce((acc, inv) => 
                      acc + inv.articulos.reduce((sum, art) => sum + (art.costo * art.cantidad), 0)
                    , 0)
                  ).toLocaleString()}
                </h3>
                <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-wider">Net Platform Earnings</p>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-widest">Active Subs</span>
                </div>
                <h3 className="text-3xl font-black text-slate-900">
                  {stores.filter(s => s.isActive && (s.subscriptionAmount || 0) > 0).length}
                </h3>
                <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-wider">Paying Store Instances</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Equipment & Services Management */}
              <div className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Equipment & Services</h2>
                  <button 
                    onClick={() => setIsAddingBillingItem(true)}
                    className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {superAdminItems.map(item => (
                    <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-black text-slate-900 uppercase tracking-tight">{item.nombre}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.tipo}</p>
                        </div>
                        <button 
                          onClick={async () => {
                            await deleteDoc(doc(db, 'system', 'billing', 'items', item.id));
                            toast.success('Item deleted');
                          }}
                          className="p-1 text-slate-300 hover:text-rose-600 transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-4 flex justify-between items-center">
                        <div className="text-xs">
                          <span className="text-slate-400 font-bold">COST:</span>
                          <span className="ml-1 font-black text-slate-600">${item.costo.toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-slate-400 font-bold">PRICE:</span>
                          <span className="ml-1 font-black text-blue-600">${item.precio.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {superAdminItems.length === 0 && (
                    <p className="text-center py-8 text-slate-400 font-medium italic">No items defined yet.</p>
                  )}
                </div>
              </div>

              {/* Invoices List */}
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Store Invoices</h2>
                  <button 
                    onClick={() => setIsCreatingInvoice(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                  >
                    <FileText className="w-4 h-4" /> New Invoice
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="pb-4">Invoice ID</th>
                        <th className="pb-4">Store</th>
                        <th className="pb-4">Date</th>
                        <th className="pb-4">Total</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {superAdminInvoices.map(inv => (
                        <tr key={inv.id} className="group hover:bg-slate-50/50 transition">
                          <td className="py-4">
                            <span className="text-xs font-mono font-bold text-slate-400">{inv.id}</span>
                          </td>
                          <td className="py-4">
                            <span className="font-black text-slate-900 uppercase tracking-tight">
                              {stores.find(s => s.id === inv.storeId)?.nombre || inv.storeId}
                            </span>
                          </td>
                          <td className="py-4 text-xs text-slate-500 font-medium">
                            {new Date(inv.fecha).toLocaleDateString()}
                          </td>
                          <td className="py-4 font-black text-blue-600">
                            ${inv.total.toFixed(2)}
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                              inv.estado === 'Pagado' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {inv.estado}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <button 
                              onClick={async () => {
                                await setDoc(doc(db, 'system', 'billing', 'invoices', inv.id), { estado: inv.estado === 'Pagado' ? 'Pendiente' : 'Pagado' }, { merge: true });
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Toggle Status"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'updates' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Global Announcement */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">System Announcement</h2>
                  <p className="text-sm text-slate-500 font-medium">Broadcast a message to all active POS terminals</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Announcement Message</label>
                  <textarea
                    value={globalConfig.announcement}
                    onChange={(e) => setGlobalConfig({ ...globalConfig, announcement: e.target.value })}
                    placeholder="e.g. System maintenance scheduled for tonight at 10 PM..."
                    className="w-full h-32 bg-slate-50 border-none rounded-2xl p-4 text-slate-700 focus:ring-2 focus:ring-blue-500 transition resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="font-bold text-slate-900">Maintenance Mode</p>
                    <p className="text-xs text-slate-500">Prevent all stores from accessing the POS</p>
                  </div>
                  <button
                    onClick={() => updateGlobalConfig({ maintenance: !globalConfig.maintenance })}
                    className={`w-12 h-6 rounded-full transition-all relative ${globalConfig.maintenance ? 'bg-rose-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${globalConfig.maintenance ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <button
                  onClick={() => updateGlobalConfig(globalConfig)}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                >
                  Save & Broadcast Changes
                </button>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Bulk Operations</h2>
                  <p className="text-sm text-slate-500 font-medium">Apply changes to all stores at once</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <p className="text-sm text-indigo-900 font-bold mb-1">Push Global Update</p>
                  <p className="text-xs text-indigo-600 mb-4 font-medium">This will force a data refresh on all connected clients.</p>
                  <button 
                    onClick={() => {
                      updateGlobalConfig({ announcement: globalConfig.announcement + ' ' });
                      toast.success('Update signal sent to all clients');
                    }}
                    className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition"
                  >
                    Trigger Global Sync
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-sm text-slate-900 font-bold mb-1">Reset All Licenses</p>
                  <p className="text-xs text-slate-500 mb-4 font-medium">Deactivate all stores immediately. Use with caution.</p>
                  <button 
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Deactivate All Stores',
                        message: 'Are you sure you want to deactivate ALL stores?',
                        type: 'danger',
                        confirmText: 'Deactivate All',
                        onConfirm: async () => {
                          const batch = writeBatch(db);
                          stores.forEach(s => {
                            batch.update(doc(db, 'settings', s.id), { isActive: false });
                          });
                          await batch.commit();
                          toast.success('All stores deactivated');
                          setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        }
                      });
                    }}
                    className="px-6 py-2 bg-white border border-rose-200 text-rose-600 font-bold rounded-xl text-sm hover:bg-rose-50 transition"
                  >
                    Deactivate All
                  </button>
                </div>

                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-blue-900 font-bold">Super Admin Playground</p>
                  </div>
                  <p className="text-xs text-blue-600 mb-4 font-medium">Access a safe environment to test global updates without affecting clients.</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={initializeTestStore}
                      className="px-4 py-2 bg-white border border-blue-200 text-blue-600 font-bold rounded-xl text-xs hover:bg-blue-50 transition"
                    >
                      Initialize Test Store
                    </button>
                    <button 
                      onClick={() => onSelectStore('TEST-STORE')}
                      className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition"
                    >
                      Enter Test POS
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Add Billing Item Modal */}
        {isAddingBillingItem && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">New Billing Item</h2>
                  <p className="text-sm text-slate-500 font-medium">Define equipment or service pricing</p>
                </div>
                <button onClick={() => setIsAddingBillingItem(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreateBillingItem} className="p-8 space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Item Name</label>
                  <input
                    type="text"
                    required
                    value={newBillingItem.nombre}
                    onChange={(e) => setNewBillingItem({ ...newBillingItem, nombre: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-700 focus:ring-2 focus:ring-blue-500 transition font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Type</label>
                  <select
                    value={newBillingItem.tipo}
                    onChange={(e) => setNewBillingItem({ ...newBillingItem, tipo: e.target.value as any })}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-700 focus:ring-2 focus:ring-blue-500 transition font-bold"
                  >
                    <option value="Equipo">Equipo</option>
                    <option value="Instalación">Instalación</option>
                    <option value="Soporte">Soporte</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Cost ($)</label>
                    <input
                      type="number"
                      required
                      value={newBillingItem.costo}
                      onChange={(e) => setNewBillingItem({ ...newBillingItem, costo: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-700 focus:ring-2 focus:ring-blue-500 transition font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Price ($)</label>
                    <input
                      type="number"
                      required
                      value={newBillingItem.precio}
                      onChange={(e) => setNewBillingItem({ ...newBillingItem, precio: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-700 focus:ring-2 focus:ring-blue-500 transition font-bold"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition shadow-xl shadow-blue-100 mt-4"
                >
                  Save Item
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Create Invoice Modal */}
        {isCreatingInvoice && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Generate Store Invoice</h2>
                  <p className="text-sm text-slate-500 font-medium">Bill a store for equipment or services</p>
                </div>
                <button onClick={() => setIsCreatingInvoice(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Select Store</label>
                  <select
                    value={invoiceStoreId}
                    onChange={(e) => setInvoiceStoreId(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-700 focus:ring-2 focus:ring-blue-500 transition font-bold"
                  >
                    <option value="">Choose a store...</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre} ({s.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Add Items</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {superAdminItems.map(item => {
                      const existing = invoiceItems.find(ii => ii.itemId === item.id);
                      return (
                        <div key={item.id} className={`p-4 rounded-2xl border-2 transition-all ${existing ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-black text-slate-900 text-sm uppercase">{item.nombre}</p>
                            <p className="font-black text-blue-600 text-sm">${item.precio}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                if (existing) {
                                  if (existing.cantidad > 1) {
                                    setInvoiceItems(invoiceItems.map(ii => ii.itemId === item.id ? { ...ii, cantidad: ii.cantidad - 1 } : ii));
                                  } else {
                                    setInvoiceItems(invoiceItems.filter(ii => ii.itemId !== item.id));
                                  }
                                }
                              }}
                              className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 transition shadow-sm"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-black text-slate-900">{existing?.cantidad || 0}</span>
                            <button 
                              onClick={() => {
                                if (existing) {
                                  setInvoiceItems(invoiceItems.map(ii => ii.itemId === item.id ? { ...ii, cantidad: ii.cantidad + 1 } : ii));
                                } else {
                                  setInvoiceItems([...invoiceItems, { itemId: item.id, cantidad: 1 }]);
                                }
                              }}
                              className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 transition shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-6 bg-slate-900 rounded-3xl text-white">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Total Amount</span>
                    <span className="text-2xl font-black">
                      ${invoiceItems.reduce((acc, ii) => {
                        const item = superAdminItems.find(sai => sai.id === ii.itemId);
                        return acc + ((item?.precio || 0) * ii.cantidad);
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={handleCreateSuperAdminInvoice}
                  disabled={!invoiceStoreId || invoiceItems.length === 0}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition shadow-xl shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate & Send Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Store Modal */}
        {isAddingStore && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Add New Store</h2>
                  <p className="text-sm text-slate-500 font-medium">Create a new POS client instance</p>
                </div>
                <button 
                  onClick={() => setIsAddingStore(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Generated Store ID</label>
                  <div className="p-4 bg-slate-100 rounded-2xl font-mono font-bold text-slate-600 border border-slate-200">
                    {(() => {
                      const strIds = stores
                        .map(s => s.id)
                        .filter(id => id && id.startsWith('STR-'))
                        .map(id => {
                          const parts = id.split('-');
                          return parts.length > 1 ? parseInt(parts[1]) : 0;
                        })
                        .filter(num => !isNaN(num));
                      const nextNum = strIds.length > 0 ? Math.max(...strIds) + 1 : 1;
                      return `STR-${String(nextNum).padStart(5, '0')}`;
                    })()}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 italic">This ID is generated automatically and sequentially.</p>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Store Name</label>
                  <input 
                    type="text"
                    value={newStoreData.nombre}
                    onChange={(e) => setNewStoreData({ ...newStoreData, nombre: e.target.value })}
                    placeholder="e.g. Downtown Branch"
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Admin Email</label>
                  <input 
                    type="email"
                    value={newStoreData.email}
                    onChange={(e) => setNewStoreData({ ...newStoreData, email: e.target.value })}
                    placeholder="admin@example.com"
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Business Type (Rubro)</label>
                  <select 
                    value={newStoreData.businessCategory}
                    onChange={(e) => setNewStoreData({ ...newStoreData, businessCategory: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  >
                    <option value="">Default / General</option>
                    {businessCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Monthly Subscription Amount ($)</label>
                  <input
                    type="number"
                    value={newStoreData.subscriptionAmount}
                    onChange={(e) => setNewStoreData({ ...newStoreData, subscriptionAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => setIsAddingStore(false)}
                  className="flex-1 py-4 bg-white text-slate-500 font-black rounded-2xl border border-slate-200 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateStore}
                  className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                >
                  Create Store
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Store Modal */}
        {isEditingStore && editingStoreData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Edit Store</h2>
                  <p className="text-sm text-slate-500 font-medium">Update store basic settings. Changing email updates admin access.</p>
                </div>
                <button 
                  onClick={() => setIsEditingStore(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={editingStoreData.nombre || ''}
                    onChange={(e) => setEditingStoreData({ ...editingStoreData, nombre: e.target.value })}
                    placeholder="Enter store name"
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Admin Email Address
                  </label>
                  <input
                    type="email"
                    value={editingStoreData.email || ''}
                    onChange={(e) => setEditingStoreData({ ...editingStoreData, email: e.target.value })}
                    placeholder="admin@store.com"
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={editingStoreData.telefono || ''}
                    onChange={(e) => setEditingStoreData({ ...editingStoreData, telefono: formatPhoneNumber(e.target.value) })}
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={editingStoreData.direccion || ''}
                    onChange={(e) => setEditingStoreData({ ...editingStoreData, direccion: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => setIsEditingStore(false)}
                  className="flex-1 py-4 bg-white text-slate-500 font-black rounded-2xl border border-slate-200 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateStore}
                  className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Demo Modal */}
        {isEditingDemo && editingDemoData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Edit Demo Request</h2>
                  <p className="text-sm text-slate-500 font-medium">Update applicant details before creating store</p>
                </div>
                <button 
                  onClick={() => setIsEditingDemo(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingDemoData.nombre || ''}
                    onChange={(e) => setEditingDemoData({ ...editingDemoData, nombre: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingDemoData.email || ''}
                    onChange={(e) => setEditingDemoData({ ...editingDemoData, email: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editingDemoData.phone || ''}
                    onChange={(e) => setEditingDemoData({ ...editingDemoData, phone: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Business Type
                  </label>
                  <select
                    value={editingDemoData.businessType || 'wholesale'}
                    onChange={(e) => setEditingDemoData({ ...editingDemoData, businessType: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  >
                    <option value="wholesale">Wholesale</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="retail">Retail</option>
                  </select>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => setIsEditingDemo(false)}
                  className="flex-1 py-4 bg-white text-slate-500 font-black rounded-2xl border border-slate-200 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateDemo}
                  className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Confirm Modal */}
        {showUrlModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                    <Link className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Import from Google Sheets</h3>
                    <p className="text-xs text-slate-500 font-medium">Paste a published CSV link</p>
                  </div>
                </div>
                <button onClick={() => setShowUrlModal(false)} className="text-slate-400 hover:text-slate-600 transition bg-white hover:bg-slate-100 p-2 rounded-full shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                  <p className="font-bold mb-1">How to get the link:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-blue-700/80">
                    <li>Open your Google Sheet</li>
                    <li>Go to <strong>File &gt; Share &gt; Publish to web</strong></li>
                    <li>Select <strong>Entire Document</strong> and <strong>Comma-separated values (.csv)</strong></li>
                    <li>Click Publish and copy the link below</li>
                  </ol>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">CSV URL</label>
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setShowUrlModal(false)}
                  className="flex-1 py-3 bg-white text-slate-500 font-black rounded-xl border border-slate-200 hover:bg-slate-100 transition text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleImportFromUrl}
                  disabled={!importUrl || isLoading}
                  className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-100 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Import Data
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                  {confirmModal.type === 'danger' ? <Trash2 className="w-8 h-8" /> : <Settings className="w-8 h-8" />}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{confirmModal.message}</p>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 bg-white text-slate-500 font-black rounded-xl border border-slate-200 hover:bg-slate-100 transition text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 py-3 text-white font-black rounded-xl transition shadow-lg text-sm ${confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
                >
                  {confirmModal.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
    </>
  );
};
