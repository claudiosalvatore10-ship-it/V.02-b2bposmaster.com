import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { KitchenTicket } from '../types';
import { Clock, CheckCircle, ChefHat, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';

interface KitchenDisplayProps {
  storeId: string;
  isWholesale?: boolean;
}

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ storeId, isWholesale }) => {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'kitchenTickets'),
      where('storeId', '==', storeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KitchenTicket));
      // Filter out delivered tickets and sort by timestamp
      const activeTickets = fetchedTickets
        .filter(t => t.status !== 'delivered')
        .sort((a, b) => a.timestamp - b.timestamp);
      setTickets(activeTickets);
    }, (error) => {
      console.error("Error fetching kitchen tickets:", error);
    });

    return () => unsubscribe();
  }, [storeId]);

  const updateTicketStatus = async (ticketId: string, newStatus: KitchenTicket['status']) => {
    try {
      await setDoc(doc(db, 'kitchenTickets', ticketId), { status: newStatus }, { merge: true });
      toast.success(`Ticket marked as ${newStatus}`);
    } catch (error) {
      console.error("Error updating ticket status:", error);
      toast.error("Failed to update ticket");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 border-amber-200 text-amber-900';
      case 'preparing': return 'bg-blue-100 border-blue-200 text-blue-900';
      case 'ready': return 'bg-green-100 border-green-200 text-green-900';
      default: return 'bg-gray-100 border-gray-200 text-gray-900';
    }
  };

  return (
    <div className="h-full bg-slate-900 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{isWholesale ? 'Monitor de Almacén' : 'Kitchen Monitor'}</h1>
            <p className="text-slate-400 font-medium text-sm">Active Orders</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 px-4 py-2 rounded-xl font-bold text-sm">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
            {tickets.filter(t => t.status === 'pending').length} Pending
          </div>
          <div className="flex items-center gap-2 text-blue-400 bg-blue-400/10 px-4 py-2 rounded-xl font-bold text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
            {tickets.filter(t => t.status === 'preparing').length} Preparing
          </div>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
          <UtensilsCrossed className="w-24 h-24 mb-6 opacity-20" />
          <h2 className="text-2xl font-black tracking-tight mb-2">No Active Orders</h2>
          <p className="font-medium">The kitchen is clear. Waiting for new tickets...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {tickets.map(ticket => (
            <div 
              key={ticket.id} 
              className={`rounded-3xl border-2 flex flex-col overflow-hidden shadow-xl transition-all ${getStatusColor(ticket.status)}`}
            >
              {/* Ticket Header */}
              <div className="p-4 border-b border-black/5 flex justify-between items-start bg-white/40 backdrop-blur-sm">
                <div>
                  <h3 className="font-black text-xl tracking-tight mb-1">
                    {ticket.tableName ? `Table ${ticket.tableName}` : (ticket.customerName || 'Takeout')}
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm font-bold opacity-70">
                    <Clock className="w-4 h-4" />
                    {new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black uppercase tracking-widest opacity-50 block mb-1">Ticket</span>
                  <span className="font-mono font-bold text-lg">#{ticket.id.slice(-4)}</span>
                </div>
              </div>

              {/* Ticket Items */}
              <div className="p-5 flex-1 overflow-y-auto bg-white/60">
                <div className="space-y-4">
                  {(Object.entries(
                    ticket.items.reduce((acc, item) => {
                      const seat = item.seatId || 'General';
                      if (!acc[seat]) acc[seat] = [];
                      acc[seat].push(item);
                      return acc;
                    }, {} as Record<string, typeof ticket.items>)
                  ) as [string, typeof ticket.items][]).map(([seat, items]) => (
                    <div key={seat} className="border-t-2 border-black/10 mt-4 pt-4 pb-2 px-3">
                      <h3 className="font-black text-sm uppercase mb-3 text-slate-600 tracking-widest">Seat / Box: {seat}</h3>
                      {items.map((item, idx) => (
                        <div key={idx} className="flex gap-3 mb-3 last:mb-0">
                          <div className="font-black text-lg min-w-[1.5rem]">{item.cantidad}x</div>
                          <div>
                            <div className="font-bold text-lg leading-tight">{item.nombre}</div>
                            {item.promo && item.promo.type === 'combo' && item.promo.items && (
                              <div className="mt-1.5 space-y-1">
                                {item.promo.items.map((promoItem, pIdx) => (
                                  <div key={pIdx} className="text-sm font-bold text-indigo-600 flex items-start gap-1.5">
                                    <span className="opacity-50 mt-0.5">•</span>
                                    {promoItem.cantidad}x {promoItem.nombre}
                                  </div>
                                ))}
                              </div>
                            )}
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {item.selectedModifiers.map((mod, mIdx) => (
                                  <div key={mIdx} className="text-sm font-bold text-rose-600 flex items-start gap-1.5">
                                    <span className="opacity-50 mt-0.5">↳</span>
                                    {mod.modifierName}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ticket Actions */}
              <div className="p-4 bg-white/40 backdrop-blur-sm border-t border-black/5">
                {ticket.status === 'pending' && (
                  <button
                    onClick={() => updateTicketStatus(ticket.id, 'preparing')}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 active:scale-95"
                  >
                    Start Preparing
                  </button>
                )}
                {ticket.status === 'preparing' && (
                  <button
                    onClick={() => updateTicketStatus(ticket.id, 'ready')}
                    className="w-full py-3 bg-green-600 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-green-700 transition shadow-lg shadow-green-900/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" /> Mark as Ready
                  </button>
                )}
                {ticket.status === 'ready' && (
                  <button
                    onClick={() => updateTicketStatus(ticket.id, 'delivered')}
                    className="w-full py-3 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-slate-900 transition shadow-lg shadow-slate-900/20 active:scale-95"
                  >
                    Mark Delivered
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
