import React, { useState } from 'react';
import { Inventory } from '../types';
import { X, Search, FileText } from 'lucide-react';

interface InventoryListModalProps {
  inventoryRecords: Inventory[];
  onClose: () => void;
  onViewInventory: (inventory: Inventory) => void;
}

export const InventoryListModal = ({ 
  inventoryRecords, 
  onClose, 
  onViewInventory 
}: InventoryListModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInventory = inventoryRecords.filter(i => {
    const matchesSearch = (i.proveedor || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (i.factura || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-2xl font-bold text-gray-800">Purchase Invoices / Inventory Records</h2>
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
                placeholder="Search by Invoice # or Supplier..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-sm uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3 font-bold">Date</th>
                <th className="px-6 py-3 font-bold">Supplier</th>
                <th className="px-6 py-3 font-bold">Invoice #</th>
                <th className="px-6 py-3 font-bold">Total Items</th>
                <th className="px-6 py-3 font-bold">Total Cost</th>
                <th className="px-6 py-3 font-bold">Status</th>
                <th className="px-6 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInventory.map(i => (
                <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">{new Date(i.fecha).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-bold">{i.proveedor}</td>
                  <td className="px-6 py-4 font-mono">{i.factura}</td>
                  <td className="px-6 py-4">{i.articulos} items</td>
                  <td className="px-6 py-4 font-bold">${Number(i.total || 0).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">{i.estado}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => onViewInventory(i)}
                      className="px-3 py-1 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 transition flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" /> View Details
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 font-bold">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
