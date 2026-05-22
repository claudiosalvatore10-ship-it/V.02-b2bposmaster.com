import { Product, Client, Salesman, Category, Tax, Device, StoreSettings, Vendor, PurchaseOrder } from './types';

export const INITIAL_STORE_SETTINGS: StoreSettings = {
  id: 'STORE-001',
  nombre: 'Taquería Demo',
  direccion: 'Av. Siempre Viva 123',
  email: 'contacto@taqueria.demo',
  telefono: '(555) 123-4567',
  logoUrl: '',
  trainingMode: false,
  googleDriveFolderId: '',
  googleApiKey: '',
  licenseKey: 'DEMO-KEY-0000',
  isActive: true
};

export const INITIAL_VENDORS: Vendor[] = [
  { id: 'v1', nombre: 'PharmaCorp Global', contacto: 'John Smith', telefono: '(800) 555-0100', email: 'orders@pharmacorp.com', direccion: '100 Pharma Way', terminos: 'Net 60' },
  { id: 'v2', nombre: 'HealthMed Supplies', contacto: 'Jane Doe', telefono: '(800) 555-0200', email: 'sales@healthmed.com', direccion: '200 Health Blvd', terminos: 'Net 30' }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1', upc: '000000000001', nombre: 'Tacos al Pastor', precio: 12.00, costo: 5.00, categoria: 'Tacos', sku: 'TAC-PAST', stock: 100, imagenUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&q=80&w=400', descuento: 0,
    modifierGroups: [
      {
        id: 'mg1',
        nombre: 'Ingredientes Base',
        required: false,
        allowMultiple: true,
        modifiers: [
          { id: 'm1', nombre: 'Cebolla y Cilantro', precio: 0 },
          { id: 'm2', nombre: 'Piña', precio: 0 },
          { id: 'm3', nombre: 'Queso Extra', precio: 3.00 }
        ]
      }
    ]
  },
  {
    id: 'p2', upc: '000000000002', nombre: 'Tacos de Asada', precio: 14.00, costo: 6.00, categoria: 'Tacos', sku: 'TAC-ASA', stock: 100, imagenUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=400', descuento: 0,
    modifierGroups: [
      {
        id: 'mg2',
        nombre: 'Salsas',
        required: false,
        allowMultiple: true,
        modifiers: [
          { id: 'm4', nombre: 'Salsa Roja (Picante)', precio: 0 },
          { id: 'm5', nombre: 'Salsa Verde', precio: 0 },
          { id: 'm6', nombre: 'Guacamole', precio: 5.00 }
        ]
      }
    ]
  },
  {
    id: 'p3', upc: '000000000003', nombre: 'Torta Cubana', precio: 18.00, costo: 8.00, categoria: 'Tortas', sku: 'TOR-CUB', stock: 50, imagenUrl: 'https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?auto=format&fit=crop&q=80&w=400', descuento: 0
  },
  {
    id: 'p4', upc: '000000000004', nombre: 'Burrito de Asada', precio: 16.00, costo: 7.00, categoria: 'Burritos', sku: 'BUR-ASA', stock: 70, imagenUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&q=80&w=400', descuento: 0
  },
  {
    id: 'p5', upc: '000000000005', nombre: 'Quesadilla con Carne', precio: 15.00, costo: 6.00, categoria: 'Quesadillas', sku: 'QUE-CAR', stock: 80, imagenUrl: 'https://images.unsplash.com/photo-1633519446487-b062bb221d60?auto=format&fit=crop&q=80&w=400', descuento: 0
  },
  {
    id: 'p6', upc: '000000000006', nombre: 'Agua de Horchata', precio: 4.00, costo: 1.50, categoria: 'Bebidas', sku: 'BEB-HOR', stock: 200, imagenUrl: 'https://images.unsplash.com/photo-1543227443-16a7f36fa89c?auto=format&fit=crop&q=80&w=400', descuento: 0
  },
  {
    id: 'p7', upc: '000000000007', nombre: 'Agua de Jamaica', precio: 4.00, costo: 1.50, categoria: 'Bebidas', sku: 'BEB-JAM', stock: 200, imagenUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=400', descuento: 0
  },
  {
    id: 'p8', upc: '000000000008', nombre: 'Tacos de Suadero', precio: 12.00, costo: 5.00, categoria: 'Tacos', sku: 'TAC-SUA', stock: 100, imagenUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400', descuento: 0
  },
  {
    id: 'p9', upc: '000000000009', nombre: 'Burrito de Pollo', precio: 14.00, costo: 6.00, categoria: 'Burritos', sku: 'BUR-POL', stock: 70, imagenUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&q=80&w=400', descuento: 0
  },
  {
    id: 'p10', upc: '000000000010', nombre: 'Torta de Milanesa', precio: 15.00, costo: 7.00, categoria: 'Tortas', sku: 'TOR-MIL', stock: 50, imagenUrl: 'https://images.unsplash.com/photo-1632516441093-5aa553d162a0?auto=format&fit=crop&q=80&w=400', descuento: 0
  }
];

export const INITIAL_CLIENTS: Client[] = [
  { id: 'c1', nombre: 'Cliente General', telefono: '(555) 000-0000', direccion: 'N/A', ciudad: 'N/A', estado: 'N/A', cp: '00000', email: 'cliente@general.com', vendedorAsignado: 'admin', terminosCredito: 'Cash' }
];

export const INITIAL_SALESMEN: Salesman[] = [
  { id: 'admin', nombre: 'Cajero', apellido: 'Principal', codigo: 'ADMIN-001', email: 'admin@taqueria.demo', telefono: '(555) 000-0000', direccion: 'Matriz', ciudad: 'CDMX', estado: 'CDMX', cp: '10000', taxId: 'TAX-00000', activo: true, pin: '1111' }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat1', nombre: 'Tacos' },
  { id: 'cat2', nombre: 'Tortas' },
  { id: 'cat3', nombre: 'Burritos' },
  { id: 'cat4', nombre: 'Quesadillas' },
  { id: 'cat5', nombre: 'Bebidas' }
];

export const INITIAL_TAXES: Tax[] = [
  { id: 't1', nombre: 'IVA Standard', porcentaje: 16 },
  { id: 't2', nombre: 'IVA Reducido', porcentaje: 8 }
];

export const INITIAL_DEVICES: Device[] = [
  { id: 'pr1', nombre: 'Impresora Bodega', tipo: 'Printer', conexion: 'WIFI', direccion: '192.168.1.100', activo: true }
];

export const DEFAULT_BUSINESS_CATEGORIES = [
  {
    id: 'restaurant',
    name: 'Restaurant / Food',
    enabledFields: {
      upc: false, sku: false, stock: true, lote: false, vencimiento: false, componenteActivo: false, laboratorio: false, unidad: false,
      descuento: true, costo: true, categoria: true, nombre: true, precio: true, threshold: false, imagenUrl: true, descripcion: true,
      thermal80mm: true, printA4: false, modifiers: true
    }
  },
  {
    id: 'wholesale',
    name: 'Retail / Wholesale',
    enabledFields: {
      upc: true, sku: true, stock: true, lote: true, vencimiento: true, componenteActivo: false, laboratorio: false, unidad: true,
      descuento: true, costo: true, categoria: true, nombre: true, precio: true, threshold: true, imagenUrl: true, descripcion: true,
      thermal80mm: true, printA4: true, modifiers: false
    }
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    enabledFields: {
      upc: true, sku: true, stock: true, lote: true, vencimiento: true, componenteActivo: true, laboratorio: true, unidad: true,
      descuento: true, costo: true, categoria: true, nombre: true, precio: true, threshold: true, imagenUrl: true, descripcion: true,
      thermal80mm: false, printA4: true, modifiers: false
    }
  },
  {
    id: 'grocery',
    name: 'Grocery / Supermarket',
    enabledFields: {
      upc: true, sku: true, stock: true, lote: false, vencimiento: true, componenteActivo: false, laboratorio: false, unidad: true,
      descuento: true, costo: true, categoria: true, nombre: true, precio: true, threshold: true, imagenUrl: true, descripcion: true,
      thermal80mm: true, printA4: false, modifiers: false
    }
  }
];

