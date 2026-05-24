export interface EmailContact {
  id: string;
  nombre: string;
  email: string;
}

export interface StoreSettings {
  id: string;
  nombre: string;
  direccion: string;
  email: string;
  telefono: string;
  logoUrl: string;
  trainingMode: boolean;
  emailContacts?: EmailContact[];
  senderEmail?: string;
  language?: string;
  googleDriveFolderId?: string;
  googleApiKey?: string;
  licenseKey?: string;
  isActive?: boolean;
  printFormat?: 'invoice' | 'ticket';
  businessCategory?: string; // ID of the BusinessCategory
  salesmenLabel?: string;
  creditSurcharge?: number;
  subscriptionAmount?: number;
  hideProductImages?: boolean;
  enableTips?: boolean;
  tipPercentages?: number[];
  kioskCashEnabled?: boolean;
  kioskCardEnabled?: boolean;
  kioskMedia?: { url: string; type: 'image' | 'video'; duration?: number }[];
  enableCashDiscount?: boolean;
}

export interface SuperAdminItem {
  id: string;
  nombre: string;
  costo: number;
  precio: number;
  tipo: 'Equipo' | 'Instalación' | 'Soporte' | 'Otro';
}

export interface SuperAdminInvoice {
  id: string;
  storeId: string;
  fecha: number;
  articulos: {
    itemId: string;
    nombre: string;
    cantidad: number;
    costo: number;
    precio: number;
  }[];
  total: number;
  estado: 'Pendiente' | 'Pagado';
}

export interface BusinessCategory {
  id: string;
  name: string;
  description?: string;
  enabledFields: {
    upc: boolean;
    boxBarcode: boolean;
    unitsPerBox: boolean;
    nombre: boolean;
    precio: boolean;
    costo: boolean;
    categoria: boolean;
    sku: boolean;
    lote: boolean;
    vencimiento: boolean;
    stock: boolean;
    componenteActivo: boolean;
    laboratorio: boolean;
    unidad: boolean;
    descuento: boolean;
    threshold: boolean;
    imagenUrl: boolean;
    descripcion: boolean;
    thermal80mm: boolean;
    printA4: boolean;
    modifiers: boolean;
    serialNumber?: boolean;
    kiosk?: boolean;
  };
}

export interface Modifier {
  id: string;
  nombre: string;
  precio: number;
}

export interface ModifierGroup {
  id: string;
  nombre: string;
  required: boolean;
  allowMultiple: boolean;
  modifiers: Modifier[];
}

export interface GlobalModifierGroup extends ModifierGroup {
  storeId?: string;
}

export interface PromoConfig {
  type: 'quantity' | 'combo' | 'discount';
  quantity?: number;
  price?: number;
  discountPercent?: number;
  items?: { productId: string; nombre: string; cantidad: number }[];
}

export interface Product {
  id: string;
  storeId?: string;
  upc: string;
  boxBarcode?: string;
  unitsPerBox?: number;
  nombre: string;
  precio: number;
  costo: number;
  categoria: string;
  sku: string;
  lote?: string;
  vencimiento?: string;
  serialNumber?: string;
  stock: number;
  componenteActivo?: string;
  laboratorio?: string;
  unidad?: string;
  imagenUrl: string;
  descuento: number;
  featured?: boolean;
  threshold?: number;
  showInPOS?: boolean;
  oculto?: boolean;
  modifierGroups?: ModifierGroup[];
  promo?: PromoConfig;
  moduleType?: 'grocery' | 'restaurant';
  vendorPrices?: { vendorId: string; vendorName: string; costo: number; lastUpdated?: number }[];
}

export interface Client {
  id: string;
  storeId?: string;
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  email: string;
  vendedorAsignado: string;
  terminosCredito: string;
}

export interface User {
  id: string;
  storeId?: string;
  nombre: string;
  email: string;
  role: 'admin' | 'salesman' | 'user';
  activo: boolean;
  createdAt: number;
}

export interface Salesman {
  id: string;
  storeId?: string;
  nombre: string;
  apellido: string;
  codigo: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  taxId: string;
  activo: boolean;
  pin?: string;
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  modifierId: string;
  modifierName: string;
  precio: number;
}

export interface CartItem extends Product {
  cartId: string;
  cantidad: number;
  status?: 'Pending' | 'Sent' | 'Ready' | 'Delivered';
  selectedModifiers?: SelectedModifier[];
  seatId?: string;
}

export interface KitchenTicket {
  id: string;
  storeId: string;
  orderId?: string;
  timestamp: number;
  items: CartItem[];
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  tableName?: string;
  customerName?: string;
}

export interface Order {
  id: string;
  storeId?: string;
  proveedor: string;
  fecha: number;
  factura: string;
  articulos: CartItem[];
  total: number;
  estado: 'Pendiente' | 'Pagado' | 'Enviado' | 'Cancelado';
  clienteId: string;
  vendedorId: string;
  metodoPago: 'Cash' | 'Credit' | 'Check' | 'EBT' | 'EBT + Cash' | 'EBT + Credit' | 'Split' | '';
  checkNumber?: string;
  montoLetras?: string;
  terminosCredito?: string;
  amountTendered?: number;
  changeDue?: number;
  checkDate?: string;
  creditCardType?: string;
  creditCardLast4?: string;
  subtotal?: number;
  tax?: number;
  taxRate?: number;
  taxesApplied?: { name: string; amount: number }[];
  tip?: number;
  splits?: { amount: number; method: string }[];
  bills?: {
    b100: number;
    b50: number;
    b20: number;
    b10: number;
    b5: number;
    b1: number;
  };
}

export interface Vendor {
  id: string;
  storeId?: string;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  direccion: string;
  terminos: string;
}

export interface PurchaseOrderItem {
  productId: string;
  nombre: string;
  cantidad: number;
  costo: number;
}

export interface PurchaseOrder {
  id: string;
  storeId?: string;
  vendorId: string;
  fechaCreacion: number;
  fechaEsperada?: number;
  fechaRecepcion?: number;
  estado: 'Borrador' | 'Enviado' | 'Recibido' | 'Cancelado' | 'Printed' | 'Mailed';
  articulos: PurchaseOrderItem[];
  total: number;
  notas: string;
  invoiceNumber?: string;
  checkNumber?: string;
}

export interface Inventory {
  id: string;
  storeId?: string;
  proveedor: string;
  fecha: number;
  factura: string;
  articulos: number;
  total: number;
  estado: string;
  items?: any[];
  metodoPago?: 'Cash' | 'Credit' | 'Check' | 'EBT' | 'EBT + Cash' | 'EBT + Credit' | 'Split' | '';
  terminosCredito?: string;
  amountTendered?: number;
  changeDue?: number;
  checkNumber?: string;
  montoLetras?: string;
  bills?: {
    b100: number;
    b50: number;
    b20: number;
    b10: number;
    b5: number;
    b1: number;
  };
}

export interface Category {
  id: string;
  storeId?: string;
  nombre: string;
  taxIds?: string[];
  color?: string;
  borderColor?: string;
  quickAccess?: boolean;
  moduleType?: 'grocery' | 'restaurant';
  ebt?: boolean;
}

export interface Tax {
  id: string;
  storeId?: string;
  nombre: string;
  porcentaje: number;
}

export interface Device {
  id: string;
  storeId?: string;
  nombre: string;
  tipo: 'Printer' | 'Scale' | 'Scanner' | 'CreditCard';
  conexion: 'WIFI' | 'Bluetooth' | 'IP' | 'USB';
  direccion: string;
  modelo?: string;
  activo: boolean;
}

export interface MerchantRegistration {
  id: string;
  storeId?: string;
  salesmanId: string;
  salesmanName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  notes?: string;

  // Owner's Information
  ownerFirstName: string;
  ownerLastName: string;
  ownerDob: string;
  ownerSsn: string;
  ownerCountry: string;
  ownerHomeAddress: string;
  ownerApartment?: string;
  ownerCity: string;
  ownerState: string;
  ownerZipCode: string;
  ownerCellPhone: string;
  ownerEmail: string;

  // Business Information
  busStoreNameDba: string;
  busLegalName: string;
  busLegalType: string;
  busPhysicalAddress: string;
  busCity: string;
  busState: string;
  busZipCode: string;
  busPhone: string;
  busLegalSameAsDbaAddress: boolean;
  busTaxId: string;
  busEstablishedDate: string;

  // Bank Info
  bankName: string;
  bankAccountHolder: string;
  bankRoutingNumber: string;
  bankAccountNumber: string;
  bankIndustryType: string;
  bankProjectedMonthlyCreditCardCharges: string;
  bankProjectedYearlyStoreSales: string;

  // Document attachments (Base64 file value)
  docDriversLicense?: string;
  docDriversLicenseName?: string;
  docBusinessLicense?: string;
  docBusinessLicenseName?: string;
  docVoidedCheck?: string;
  docVoidedCheckName?: string;
  docAdditional_1?: string;
  docAdditional_1Name?: string;
  docAdditional_2?: string;
  docAdditional_2Name?: string;
}

