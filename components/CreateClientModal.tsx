import React, { useState } from 'react';
import { Client, Salesman } from '../types';

interface CreateClientModalProps {
  onClose: () => void;
  onSave: (client: Client) => void;
  salesmen?: Salesman[];
  activeSalesman?: Salesman | null;
  isSuperAdmin?: boolean;
}

export const CreateClientModal = ({ onClose, onSave, salesmen = [], activeSalesman, isSuperAdmin }: CreateClientModalProps) => {
  const [client, setClient] = useState<Partial<Client>>({
    nombre: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    estado: '',
    cp: '',
    email: '',
    vendedorAsignado: activeSalesman?.id || '',
    terminosCredito: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...client, id: `CLIENT-${Date.now()}` } as Client);
  };

  const availableSalesmen = salesmen.filter(s => s.id !== 'admin' || isSuperAdmin);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Client</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" placeholder="Nombre" value={client.nombre || ''} onChange={e => setClient({...client, nombre: e.target.value})} className="w-full p-2 border rounded font-bold" />
          <input type="text" placeholder="Teléfono" value={client.telefono || ''} onChange={e => setClient({...client, telefono: e.target.value})} className="w-full p-2 border rounded font-bold" />
          <input type="text" placeholder="Direccion" value={client.direccion || ''} onChange={e => setClient({...client, direccion: e.target.value})} className="w-full p-2 border rounded font-bold" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Ciudad" value={client.ciudad || ''} onChange={e => setClient({...client, ciudad: e.target.value})} className="w-full p-2 border rounded font-bold" />
            <input type="text" placeholder="Estado" value={client.estado || ''} onChange={e => setClient({...client, estado: e.target.value})} className="w-full p-2 border rounded font-bold" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="CP" value={client.cp || ''} onChange={e => setClient({...client, cp: e.target.value})} className="w-full p-2 border rounded font-bold" />
            <input type="email" placeholder="Email" value={client.email || ''} onChange={e => setClient({...client, email: e.target.value})} className="w-full p-2 border rounded font-bold" />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Vendedor Asignado</label>
            <select 
              value={client.vendedorAsignado || ''} 
              onChange={e => setClient({...client, vendedorAsignado: e.target.value})}
              className="w-full p-2 border rounded font-bold bg-white"
            >
              <option value="">Select Salesman</option>
              {availableSalesmen.map(s => (
                <option key={s.id} value={s.id}>{s.nombre} {s.apellido}</option>
              ))}
            </select>
          </div>

          <input type="text" placeholder="Terminos de Credito" value={client.terminosCredito || ''} onChange={e => setClient({...client, terminosCredito: e.target.value})} className="w-full p-2 border rounded font-bold" />
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded font-bold">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};
