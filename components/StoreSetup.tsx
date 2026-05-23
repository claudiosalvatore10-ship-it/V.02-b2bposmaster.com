import React, { useState } from 'react';
import { Building2, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { doc, setDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { INITIAL_STORE_SETTINGS, INITIAL_CATEGORIES, INITIAL_TAXES, INITIAL_DEVICES, INITIAL_VENDORS, INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_SALESMEN } from '../constants';
import { toast } from 'sonner';

interface StoreSetupProps {
  user: any;
  onComplete: (storeId: string) => void;
}

export const StoreSetup: React.FC<StoreSetupProps> = ({ user, onComplete }) => {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [storeName, setStoreName] = useState('');
  const [joinStoreId, setJoinStoreId] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);

  React.useEffect(() => {
    const checkQuickDemo = async () => {
      const demoDataStr = localStorage.getItem('quick_demo_data');
      if (demoDataStr) {
        try {
          const config = JSON.parse(demoDataStr);
          localStorage.removeItem('quick_demo_data'); // clean up
          await createStoreInstance(config.negocio, config);
        } catch (e) {
          console.error("Failed to parse or create quick demo from local storage", e);
        }
      }
    };
    checkQuickDemo();
  }, []);

  const createStoreInstance = async (name: string, config?: any) => {
    setIsSettingUp(true);
    const storeId = `STORE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    try {
      const batch = writeBatch(db);

      // 1. Create Store Settings
      const storeRef = doc(db, 'settings', storeId);
      batch.set(storeRef, { 
        ...INITIAL_STORE_SETTINGS, 
        id: storeId, 
        nombre: name,
        email: config?.email || user.email,
        businessCategory: config?.type || 'wholesale', // Sets the selected business category
        isActive: true,
        licenseKey: `LIC-DEMO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      });

      // 2. Update User Profile
      const userRef = doc(db, 'users', user.uid);
      batch.set(userRef, {
        id: user.uid,
        email: config?.email || user.email,
        nombre: config?.nombre || user.displayName || '',
        storeId: storeId,
        role: 'admin',
        activo: true,
        createdAt: Date.now()
      });

      // 3. Seed Initial Data
      const businessType = config?.type || 'wholesale';
      let categoriesToSeed = INITIAL_CATEGORIES;
      if (businessType === 'grocery') {
        categoriesToSeed = [
          { id: 'gc1', nombre: 'Frutas' },
          { id: 'gc2', nombre: 'Verduras' },
          { id: 'gc3', nombre: 'Lácteos' },
          { id: 'gc4', nombre: 'Panadería' },
          { id: 'gc5', nombre: 'Abarrotes' },
          { id: 'gc6', nombre: 'Bebidas' },
          { id: 'gc7', nombre: 'Limpieza' },
          { id: 'gc8', nombre: 'Cuidado Personal' }
        ];
      } else if (businessType === 'wholesale') {
        categoriesToSeed = [
          { id: 'wc1', nombre: 'Abarrotes' },
          { id: 'wc2', nombre: 'Higiene' },
          { id: 'wc3', nombre: 'Bebidas' },
          { id: 'wc4', nombre: 'Desechables' },
          { id: 'wc5', nombre: 'Mascotas' },
          { id: 'wc6', nombre: 'Limpieza Hogar' }
        ];
      } else if (businessType === 'combo') {
        categoriesToSeed = [
          ...INITIAL_CATEGORIES,
          { id: 'c1', nombre: 'Frutas y Verduras' },
          { id: 'c2', nombre: 'Abarrotes' },
          { id: 'c3', nombre: 'Lácteos' }
        ];
      }

      categoriesToSeed.forEach(cat => {
        const ref = doc(db, 'categories', `CAT-${Math.random().toString(36).substr(2, 5)}`);
        batch.set(ref, { ...cat, id: ref.id, storeId });
      });
      
      INITIAL_TAXES.forEach(tax => {
        const ref = doc(db, 'taxes', `TAX-${Math.random().toString(36).substr(2, 5)}`);
        batch.set(ref, { ...tax, id: ref.id, storeId });
      });
      
      INITIAL_DEVICES.forEach(pr => {
        const ref = doc(db, 'devices', `DEV-${Math.random().toString(36).substr(2, 5)}`);
        batch.set(ref, { ...pr, id: ref.id, storeId });
      });

      INITIAL_VENDORS.forEach(v => {
        const ref = doc(db, 'vendors', `VEN-${Math.random().toString(36).substr(2, 5)}`);
        batch.set(ref, { ...v, id: ref.id, storeId });
      });

      // Seed a few demo products, optionally based on business type
      let demoProducts = INITIAL_PRODUCTS;
      
      if (businessType === 'retail') {
        demoProducts = [
          { id: '1', nombre: 'Camiseta Básica Naranja', precio: 25.00, costo: 10.00, categoria: 'Ropa', sku: 'CM-001', stock: 50, upc: '221' },
          { id: '2', nombre: 'Pantalón Jean Azul', precio: 45.00, costo: 20.00, categoria: 'Ropa', sku: 'PJ-001', stock: 30, upc: '222' },
          { id: '3', nombre: 'Zapatillas Deportivas', precio: 80.00, costo: 40.00, categoria: 'Calzado', sku: 'ZD-001', stock: 20, upc: '223' },
        ] as any[];
      } else if (businessType === 'grocery') {
        demoProducts = [
          { id: 'g1', nombre: 'Manzana Roja (Kg)', precio: 3.50, costo: 1.50, categoria: 'Frutas', sku: 'FR-001', stock: 100, upc: '331', unidad: 'kg' },
          { id: 'g2', nombre: 'Leche Enterprise 1L', precio: 1.20, costo: 0.80, categoria: 'Lácteos', sku: 'LK-001', stock: 50, upc: '332', unidad: 'unit' },
          { id: 'g3', nombre: 'Pan de Caja Integral', precio: 2.80, costo: 1.40, categoria: 'Panadería', sku: 'PN-001', stock: 24, upc: '333', unidad: 'unit' },
          { id: 'g4', nombre: 'Arroz Super Mega 1kg', precio: 1.50, costo: 0.70, categoria: 'Abarrotes', sku: 'AB-001', stock: 200, upc: '334', unidad: 'unit' },
          { id: 'g5', nombre: 'Huevo Blanco 12 pzs', precio: 3.20, costo: 2.00, categoria: 'Lácteos', sku: 'LK-002', stock: 30, upc: '335', unidad: 'unit' },
        ] as any[];
      } else if (businessType === 'wholesale') {
        demoProducts = [
          { id: 'w1', nombre: 'Caja de Papel Higiénico (48 rollos)', precio: 25.00, costo: 15.00, categoria: 'Higiene', sku: 'PH-001', stock: 200, upc: '551', unitsPerBox: 48, boxBarcode: 'B-551' },
          { id: 'w2', nombre: 'Paca de Agua Embotellada (24 pzs)', precio: 12.00, costo: 7.00, categoria: 'Bebidas', sku: 'AE-001', stock: 150, upc: '552', unitsPerBox: 24, boxBarcode: 'B-552' },
          { id: 'w3', nombre: 'Caja de Aceite Vegetal (12 botellas)', precio: 35.00, costo: 25.00, categoria: 'Abarrotes', sku: 'AC-001', stock: 100, upc: '553', unitsPerBox: 12, boxBarcode: 'B-553' },
          { id: 'w4', nombre: 'Saco de Arroz 25kg', precio: 45.00, costo: 30.00, categoria: 'Abarrotes', sku: 'AR-001', stock: 80, upc: '554', unitsPerBox: 1, boxBarcode: 'B-554' },
          { id: 'w5', nombre: 'Saco de Frijol 25kg', precio: 50.00, costo: 35.00, categoria: 'Abarrotes', sku: 'FR-001', stock: 60, upc: '555', unitsPerBox: 1, boxBarcode: 'B-555' },
        ] as any[];
      } else if (businessType === 'combo') {
        const groceryProducts = [
          { id: 'gc1', nombre: 'Manzana Roja (Kg)', precio: 3.50, costo: 1.50, categoria: 'Frutas y Verduras', sku: 'FR-001', stock: 100, upc: '331', unidad: 'kg' },
          { id: 'gc2', nombre: 'Leche Enterprise 1L', precio: 1.20, costo: 0.80, categoria: 'Lácteos', sku: 'LK-001', stock: 50, upc: '332', unidad: 'unit' },
          { id: 'gc3', nombre: 'Bebida Energética Vz', precio: 2.50, costo: 1.50, categoria: 'Bebidas', sku: 'BE-001', stock: 30, upc: '333', unidad: 'unit' },
        ];
        demoProducts = [...groceryProducts, ...INITIAL_PRODUCTS.slice(0, 3)] as any[];
      } else if (businessType === 'restaurant') {
        demoProducts = INITIAL_PRODUCTS.slice(0, 5) as any[];
      }

      demoProducts.forEach(p => {
        const ref = doc(db, 'products', `PROD-${Math.random().toString(36).substr(2, 5)}`);
        batch.set(ref, { ...p, id: ref.id, storeId });
      });

      // Seed initial salesmen
      INITIAL_SALESMEN.forEach(s => {
        const ref = doc(db, 'salesmen', s.id === 'admin' ? `ADM-${storeId}` : `SAL-${Math.random().toString(36).substr(2, 5)}`);
        batch.set(ref, { ...s, id: ref.id, storeId });
      });

      // Seed initial clients
      INITIAL_CLIENTS.forEach(c => {
        const ref = doc(db, 'clients', `CLI-${Math.random().toString(36).substr(2, 5)}`);
        batch.set(ref, { ...c, id: ref.id, storeId });
      });

      // Seed current user as an additional admin salesman
      const adminSalesmanId = `SAL-${user.uid}`;
      batch.set(doc(db, 'salesmen', adminSalesmanId), {
        id: adminSalesmanId,
        nombre: config?.nombre?.split(' ')[0] || user.displayName?.split(' ')[0] || 'Admin',
        apellido: config?.nombre?.split(' ')[1] || user.displayName?.split(' ')[1] || 'User',
        codigo: 'ADM-001',
        email: config?.email || user.email,
        storeId: storeId,
        activo: true,
        pin: '1111',
        role: 'admin'
      });

      await batch.commit();
      toast.success('Store created successfully!');
      onComplete(storeId);
    } catch (error) {
      console.error("Error setting up store:", error);
      toast.error('Failed to create store. Please try again.');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleJoinStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinStoreId.trim()) return;

    setIsSettingUp(true);
    try {
      const storeRef = doc(db, 'settings', joinStoreId.trim());
      const storeSnap = await getDoc(storeRef);

      if (!storeSnap.exists()) {
        toast.error('Store ID not found. Please check with your administrator.');
        return;
      }

      // Link user to this store
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        email: user.email,
        nombre: user.displayName || '',
        storeId: joinStoreId.trim(),
        role: 'user', // Default role for joining users
        activo: true,
        createdAt: Date.now()
      });

      toast.success('Joined store successfully!');
      onComplete(joinStoreId.trim());
    } catch (error) {
      console.error("Error joining store:", error);
      toast.error('Failed to join store.');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    await createStoreInstance(storeName.trim());
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenido a TakiPOS</h1>
          <p className="text-slate-500">Configura el entorno de tu negocio.</p>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            New Store
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'join' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Join Existing
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreateStore} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Store Name
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ej. Taquería El Paisa"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 focus:ring-0 transition text-lg"
                disabled={isSettingUp}
              />
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <div className="flex gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-bold mb-1">Activation Required</p>
                  <p>Your store will be created but will require a license key from the Super Admin to be activated.</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSettingUp || !storeName.trim()}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSettingUp ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Configurando...
                </>
              ) : (
                <>
                  Crear Mi Negocio <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinStore} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Store ID
              </label>
              <input
                type="text"
                required
                value={joinStoreId}
                onChange={(e) => setJoinStoreId(e.target.value)}
                placeholder="e.g. STORE-XXXXX"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 focus:ring-0 transition text-lg"
                disabled={isSettingUp}
              />
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-sm text-slate-500">
                Enter the Store ID provided by your administrator to join an existing environment.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSettingUp || !joinStoreId.trim()}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition shadow-lg shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSettingUp ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  Join Store <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <ShieldCheck className="w-4 h-4" />
          Secure Multi-Tenant Environment
        </div>
      </div>
    </div>
  );
};
