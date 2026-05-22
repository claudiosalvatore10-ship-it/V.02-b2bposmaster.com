import React, { useState } from 'react';
import { Order, Salesman, Client } from '../types';
import { X, Search, Users, Trash2, CheckCircle } from 'lucide-react';

interface OrderListModalProps {
  orders: Order[];
  salesmen: Salesman[];
  clients: Client[];
  activeSalesman: Salesman;
  userRole: 'admin' | 'user' | 'salesman';
  isSuperAdmin: boolean;
  onClose: () => void;
  onViewOrder: (order: Order) => void;
  onDeleteOrder: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
}

export const OrderListModal = ({ 
  orders, 
  salesmen, 
  clients, 
  activeSalesman, 
  userRole,
  isSuperAdmin,
  onClose, 
  onViewOrder, 
  onDeleteOrder,
  onMarkAsPaid
}: OrderListModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const filteredOrders = orders.filter(o => {
    // If not admin, only show their own orders
    if (activeSalesman.id !== 'admin' && o.vendedorId !== activeSalesman.id) return false;

    const client = clients.find(c => c.id === o.clienteId);
    const clientName = client ? client.nombre : '';
    const matchesGeneral = (o.factura || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (o.proveedor || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCustomer = clientName.toLowerCase().includes(customerSearchQuery.toLowerCase());
    return matchesGeneral && matchesCustomer;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-2xl font-bold text-gray-800">Recent Orders</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-100 bg-white">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search by Invoice or Supplier..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>
            <div className="relative flex-1">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search by Customer..." 
                value={customerSearchQuery}
                onChange={e => setCustomerSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-sm uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3 font-bold">Supplier</th>
                <th className="px-6 py-3 font-bold">Salesman</th>
                <th className="px-6 py-3 font-bold">Date</th>
                <th className="px-6 py-3 font-bold">Invoice</th>
                <th className="px-6 py-3 font-bold">Total</th>
                <th className="px-6 py-3 font-bold">Status</th>
                <th className="px-6 py-3 font-bold">Payment</th>
                <th className="px-6 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map(o => {
                const salesman = salesmen.find(s => s.id === o.vendedorId);
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">{o.proveedor}</td>
                    <td className="px-6 py-4">{salesman ? `${salesman.nombre} ${salesman.apellido}` : 'N/A'}</td>
                    <td className="px-6 py-4">{new Date(o.fecha).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-mono text-sm">{o.factura}</td>
                    <td className="px-6 py-4 font-bold">${Number(o.total || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          o.estado === 'Pagado' ? 'bg-green-100 text-green-700' :
                          o.estado === 'Pendiente' ? 'bg-amber-100 text-amber-700' :
                          o.estado === 'Enviado' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {o.estado}
                        </span>
                        {o.estado !== 'Pagado' && (
                          <button 
                            onClick={() => onMarkAsPaid(o.id)}
                            className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200 transition"
                            title="Mark as Paid"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {o.metodoPago && (
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          o.metodoPago === 'Cash' ? 'bg-green-100 text-green-700' :
                          o.metodoPago === 'Credit' ? 'bg-amber-100 text-amber-700' :
                          o.metodoPago === 'Check' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {o.metodoPago}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => onViewOrder(o)}
                          className="text-blue-600 hover:underline font-bold text-sm"
                        >
                          View
                        </button>
                        {(userRole === 'admin' || isSuperAdmin) && (
                          <button 
                            onClick={() => onDeleteOrder(o.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                            title="Delete Order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 font-bold">No orders found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
