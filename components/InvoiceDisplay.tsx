import React from 'react';
import { TicketPreview, InvoicePreview } from './PrintPreviews';
import { Inventory, StoreSettings, Order, Client, Salesman } from '../types';
import { X, Printer, Mail, CheckCircle2, DollarSign, CreditCard, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface InvoiceDisplayProps {
  invoice?: Inventory;
  order?: Order;
  client?: Client;
  salesman?: Salesman;
  onClose: () => void;
  onUpdatePayment?: (updates: Partial<Inventory>) => void;
  onComplete?: () => void;
  storeSettings?: StoreSettings;
  onBarcodeClick?: (invoiceId: string) => void;
}

const InvoiceDisplay: React.FC<InvoiceDisplayProps> = ({ 
  invoice, 
  order, 
  client, 
  salesman, 
  onClose, 
  onUpdatePayment, 
  onComplete, 
  storeSettings,
  onBarcodeClick
}) => {
  const [showReceiptOnMobile, setShowReceiptOnMobile] = React.useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = React.useState(false);
  const data = invoice || order;
  if (!data) return null;

  const isBorrador = invoice?.estado === 'Borrador';
  const items = invoice?.items || order?.articulos || [];
  const date = new Date(data.fecha).toLocaleDateString();
  const invoiceNumber = data.factura || 'PENDING';
  const billedTo = invoice?.proveedor || client?.nombre || 'Unknown Client';
  const repName = salesman ? `${salesman.nombre} ${salesman.apellido}` : 'Admin System';
  const repId = salesman ? salesman.codigo : 'ADMIN-001';

  const handleBillChange = (bill: string, value: string) => {
    if (!onUpdatePayment || !invoice?.bills) return;
    const numValue = parseInt(value) || 0;
    const newBills = { ...invoice.bills, [bill]: numValue };
    
    const newTotal = (newBills.b100 * 100) + (newBills.b50 * 50) + (newBills.b20 * 20) + 
                     (newBills.b10 * 10) + (newBills.b5 * 5) + (newBills.b1 * 1);
    
    onUpdatePayment({ 
      bills: newBills,
      amountTendered: newTotal,
      changeDue: Math.max(0, newTotal - (invoice.total || 0))
    });
  };

  const creditSurcharge = storeSettings?.creditSurcharge || 4;
  const subtotal = items.reduce((acc, item) => acc + (((order ? item.precio : item.costo) || 0) * (item.cantidad || 1)), 0);
  const taxAmount = order?.tax || 0;
  const tipAmount = order?.tip || 0;
  const totalCash = subtotal + taxAmount + tipAmount;
  const totalCredit = (subtotal * (1 + creditSurcharge / 100)) + taxAmount + tipAmount;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300 print:p-0 print:bg-white print:static print:inset-auto print:block">
      <div className={`bg-white rounded-[2.5rem] shadow-2xl w-full ${storeSettings?.printFormat === 'ticket' ? 'max-w-4xl' : 'max-w-[95vw]'} max-h-[95vh] overflow-hidden flex flex-col border border-white/20 print:w-full print:max-w-full print:max-h-full print:rounded-none print:border-none print:shadow-none print:m-0`}>
        {/* Header */}
        <div className="p-6 lg:p-8 border-b border-gray-100 flex justify-between items-center bg-white shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {storeSettings?.printFormat === 'ticket' ? 'Sale Ticket' : 'Professional Invoice'}
              </h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order Details & History</p>
            </div>
            <button 
              onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
              className="hidden lg:flex px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              {isFullscreenPreview ? 'VER DETALLES' : 'SCREEN PRINT'}
            </button>
            <button 
              onClick={() => setShowReceiptOnMobile(!showReceiptOnMobile)}
              className="lg:hidden px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              {showReceiptOnMobile ? 'VER DETALLES' : 'VER TICKET'}
            </button>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-all">
            <X className="w-8 h-8 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row print:flex-col print:overflow-visible print:p-0">
          {/* Left Side: Receipt Preview */}
          <div className={`${(showReceiptOnMobile || isFullscreenPreview) ? 'flex' : 'hidden lg:flex'} w-full ${isFullscreenPreview ? 'lg:flex-1' : (storeSettings?.printFormat === 'ticket' ? 'lg:w-[400px]' : 'lg:w-[600px]')} bg-gray-100/50 p-6 lg:p-8 flex flex-col items-center justify-center lg:border-r border-gray-100 overflow-y-auto print:block print:w-full print:p-0 print:bg-white print:border-none print:overflow-visible`}>
            {storeSettings?.printFormat === 'ticket' ? (
              <TicketPreview 
                cart={items.map(i => ({ ...i, cartId: i.id || Math.random().toString(), precio: i.costo !== undefined ? i.costo : i.precio } as any))}
                storeSettings={storeSettings || {} as any}
                salesman={salesman}
                subtotal={subtotal}
                taxAmount={taxAmount}
                tipAmount={tipAmount}
                totalCash={totalCash}
                totalCredit={totalCredit}
                creditSurcharge={creditSurcharge}
                paymentMethod={data.metodoPago}
                splits={order?.splits}
                invoiceId={data.id || data.invoiceNumber || data.factura}
                bills={data.bills}
                onBarcodeClick={onBarcodeClick}
              />
            ) : (
              <InvoicePreview 
                cart={items.map(i => ({ ...i, cartId: i.id || Math.random().toString(), precio: i.costo !== undefined ? i.costo : i.precio } as any))}
                storeSettings={storeSettings || {} as any}
                salesman={salesman}
                client={client}
                subtotal={subtotal}
                taxAmount={taxAmount}
                tipAmount={tipAmount}
                totalCash={totalCash}
                totalCredit={totalCredit}
                creditSurcharge={creditSurcharge}
                paymentMethod={data.metodoPago}
                creditTerm={data.terminosCredito}
                dueDate={date}
                splits={order?.splits}
                invoiceId={data.id || data.invoiceNumber || data.factura}
                bills={data.bills}
                onBarcodeClick={onBarcodeClick}
              />
            )}
          </div>

          {/* Right Side: Details & Actions */}
          <div className={`${(!showReceiptOnMobile && !isFullscreenPreview) ? 'flex' : 'hidden lg:flex'} flex-1 p-6 lg:p-8 overflow-y-auto flex-col space-y-8 print:hidden`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50/50 p-5 rounded-[1.5rem] border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                  {order ? 'BILLED TO' : 'SUPPLIER'}
                </span>
                <h3 className="text-lg font-black text-gray-900 mb-1">{billedTo}</h3>
                {client && (
                  <p className="text-xs font-bold text-gray-500">
                    {client.direccion}, {client.ciudad}
                  </p>
                )}
              </div>
              <div className="bg-gray-50/50 p-5 rounded-[1.5rem] border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">PAYMENT INFO</span>
                <h3 className="text-lg font-black text-gray-900 mb-1">{data.metodoPago || 'N/A'}</h3>
                <p className="text-xs font-bold text-gray-500">Status: {data.estado}</p>
              </div>
            </div>

            {data.metodoPago === 'Split' && order?.splits && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Split Payment Details</h3>
                <div className="grid grid-cols-1 gap-3">
                  {order.splits.map((split, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-gray-400 font-black text-xs">
                          {idx + 1}
                        </div>
                        <span className="font-bold text-gray-700">{split.method}</span>
                      </div>
                      <span className="font-black text-gray-900">${split.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-8 border-t border-gray-100 flex gap-4">
              <button 
                onClick={() => window.print()}
                className="flex-1 py-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-gray-700 flex items-center justify-center gap-2 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
              >
                <Printer className="w-5 h-5" /> IMPRIMIR
              </button>
              <button 
                onClick={() => {
                  if (!client?.email) {
                    toast.error('Cliente no tiene un email configurado.');
                    return;
                  }
                  const subject = `Factura de ${storeSettings?.nombre || 'Tienda'}`;
                  const body = `Hola ${client.nombre || 'Cliente'},\n\nGracias por su compra. A continuacion los detalles de la factura ${data.id}:\n\n${items.map(item => `${item.cantidad || item.quantity || 1}x ${item.nombre || item.name || 'Articulo'} - $${(((order ? (item.precio || item.price) : (item.costo || item.price)) || 0) * (item.cantidad || item.quantity || 1)).toFixed(2)}`).join('\n')}\n\nTotal: $${(data.total || 0).toFixed(2)}\n\n¡Gracias por su preferencia!\n${storeSettings?.nombre || ''}`;
                  
                  let mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  if (storeSettings.emailContacts && storeSettings.emailContacts.length > 0) {
                    const bccEmails = storeSettings.emailContacts.map(c => c.email).join(',');
                    mailtoUrl += `&bcc=${encodeURIComponent(bccEmails)}`;
                  }
                  
                  window.location.href = mailtoUrl;
                  toast.success(`Abriendo cliente de correo para ${client.email}`);
                }}
                className="flex-1 py-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-gray-700 flex items-center justify-center gap-2 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
              >
                <Mail className="w-5 h-5" /> EMAIL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDisplay;
