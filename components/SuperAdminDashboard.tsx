import React, { useState, useEffect, useRef } from 'react';
import { Building2, Users, Package, Settings, Search, Trash2, ShieldCheck, Sparkles, LogOut, RefreshCw, CheckCircle, XCircle, Plus, Minus, X, Tag, ListFilter, Upload, Download, CreditCard, FileText, TrendingUp, TrendingDown, DollarSign, Briefcase, FolderOpen, Send, Filter, Link, Power, Globe } from 'lucide-react';
import { collection, onSnapshot, query, doc, deleteDoc, updateDoc, setDoc, getDocs, writeBatch, addDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { StoreSettings, User, BusinessCategory, Salesman, SuperAdminItem, SuperAdminInvoice, GlobalModifierGroup } from '../types';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_STORE_SETTINGS, DEFAULT_BUSINESS_CATEGORIES } from '../constants';
import { toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";
import Papa from 'papaparse';
import { read, utils, writeFile } from 'xlsx';
import { LandingCMS } from './LandingCMS';

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
  const [activeTab, setActiveTab] = useState<'stores' | 'users' | 'updates' | 'catalog' | 'catalog_images' | 'rubros' | 'billing' | 'demos' | 'landing_cms'>('stores');
  const [stores, setStores] = useState<StoreSettings[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [businessCategories, setBusinessCategories] = useState<BusinessCategory[]>([]);
  const [superAdminItems, setSuperAdminItems] = useState<SuperAdminItem[]>([]);
  const [superAdminInvoices, setSuperAdminInvoices] = useState<SuperAdminInvoice[]>([]);
  const [globalConfig, setGlobalConfig] = useState<{ announcement: string; maintenance: boolean }>({ announcement: '', maintenance: false });
  const [globalCatalog, setGlobalCatalog] = useState<any[]>([]);
  const [globalImages, setGlobalImages] = useState<any[]>([]);
  const [demoRequests, setDemoRequests] = useState<any[]>([]);
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
              telefono: item.Telefono || item.telefono || item.Phone || '',
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
              telefono: item.Telefono || item.telefono || item.Phone || '',
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
              telefono: item.Telefono || item.telefono || item.Phone || '',
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">PharmaPOS Super Admin</h1>
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
                    onChange={(e) => setEditingStoreData({ ...editingStoreData, telefono: e.target.value })}
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
  );
};
