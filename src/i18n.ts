import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English translations
const en = {
  translation: {
    "Dashboard": "Dashboard",
    "POS / Sales": "POS / Sales",
    "Products": "Products",
    "Clients": "Clients",
    "Salesmen": "Users",
    "Suppliers": "Suppliers",
    "Purchase Orders": "Purchase Orders",
    "Orders": "Orders",
    "Inventory": "Inventory",
    "Modifiers Library": "Modifiers Library",
    "Admin Dashboard": "Admin Dashboard",
    "Store Settings": "Store Settings",
    "Main Actions": "Main Actions",
    "Order History": "Order History",
    "New Client": "New Client",
    "Account Registry": "Account Registry",
    "Customer Display": "Customer Display",
    "Customer View": "Customer View",
    "Kiosk Mode": "Kiosk Mode",
    "Self Service": "Self Service",
    "Exit Receive Mode": "Exit Receive Mode",
    "Receive Inventory": "Receive Inventory",
    "Vendor Invoices": "Vendor Invoices",
    "Management": "Management",
    "Z-Report": "Z-Report",
    "Current Order": "Current Order",
    "Call": "Call",
    "Pause": "Pause",
    "Name": "Name",
    "Client": "Client",
    "Phone": "Phone",
    "No products": "No products",
    "Add BOX": "Add BOX",
    "Subtotal": "Subtotal",
    "TAX": "TAX",
    "Total": "Total",
    "Clear Cart": "Clear Cart",
    "Print Ticket": "Print Ticket",
    "Warehouse": "Warehouse",
    "Kitchen": "Kitchen",
    "Checkout": "Checkout",
    "Search Products...": "Search Products...",
    "Search Client...": "Search Client...",
    "Stock": "Stock",
    "BUY": "BUY",
    "SPECIAL COMBO": "SPECIAL COMBO",
    "No clients found": "No clients found",
    "Hide Ticket": "Hide Ticket",
    "Show Ticket": "Show Ticket",
    "Cart is empty.": "Cart is empty.",
    "Type amount and select department or item.": "Type amount and select department or item.",
    "Settings": "Settings",
    "Categories": "Categories",
    "Reports": "Reports",
    "Devices": "Devices"
  }
};

// Spanish translations
const es = {
  translation: {
    "Dashboard": "Panel",
    "POS / Sales": "Punto de Venta",
    "Products": "Productos",
    "Clients": "Clientes",
    "Salesmen": "Usuarios",
    "Suppliers": "Proveedores",
    "Purchase Orders": "Órdenes de Compra",
    "Orders": "Órdenes",
    "Inventory": "Inventario",
    "Modifiers Library": "Modificadores",
    "Admin Dashboard": "Dashboard Admin",
    "Store Settings": "Configuración",
    "Main Actions": "Acciones Principales",
    "Order History": "Historial de Órdenes",
    "New Client": "Nuevo Cliente",
    "Account Registry": "Registro",
    "Customer Display": "Pantalla Cliente",
    "Customer View": "Vista del Cliente",
    "Kiosk Mode": "Modo Kiosko",
    "Self Service": "Autoservicio",
    "Exit Receive Mode": "Salir de Recibir",
    "Receive Inventory": "Recibir Inventario",
    "Vendor Invoices": "Facturas de Proveedores",
    "Management": "Gestión",
    "Z-Report": "Reporte Z",
    "Current Order": "Orden Actual",
    "Call": "Llamada",
    "Pause": "Pausa",
    "Name": "Nombre",
    "Client": "Cliente",
    "Phone": "Teléfono",
    "No products": "Sin productos",
    "Add BOX": "Añadir BOX",
    "Subtotal": "Subtotal",
    "TAX": "Impuestos",
    "Total": "Total",
    "Clear Cart": "Limpiar Carrito",
    "Print Ticket": "Imprimir Ticket",
    "Warehouse": "Almacén",
    "Kitchen": "Cocina",
    "Checkout": "Cobrar",
    "Search Products...": "Buscar Productos...",
    "Search Client...": "Buscar Cliente...",
    "Stock": "Stock",
    "BUY": "LLEVA",
    "SPECIAL COMBO": "COMBO ESPECIAL",
    "No clients found": "No se encontraron clientes",
    "Hide Ticket": "Ocultar Ticket",
    "Show Ticket": "Ver Ticket",
    "Cart is empty.": "Carrito vacío.",
    "Type amount and select department or item.": "Ingrese monto o seleccione producto.",
    "Settings": "Ajustes",
    "Categories": "Categorías",
    "Reports": "Reportes",
    "Devices": "Dispositivos"
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: en,
      es: es
    },
    lng: localStorage.getItem('app_language') || 'es', // Default to Spanish
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
