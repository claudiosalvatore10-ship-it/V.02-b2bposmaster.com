import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Monitor, ShoppingCart, BarChart3, Smartphone, Zap, Shield, 
  ChefHat, Layers, Globe, Clock, CheckCircle2, ArrowRight, RefreshCw, Grid
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

import { formatPhoneNumber } from '../utils';

interface LandingPageProps {
  onDemoSignup?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onDemoSignup }) => {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [phone, setPhone] = useState('');
  const [negocio, setNegocio] = useState('');
  const [direccion, setDireccion] = useState('');
  const [necesidades, setNecesidades] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState<'restaurant' | 'wholesale' | 'retail' | 'grocery' | 'combo'>('wholesale');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [showQuickTrialModal, setShowQuickTrialModal] = useState(false);

  const toggleNecesidad = (req: string) => {
    setNecesidades(prev => prev.includes(req) ? prev.filter(r => r !== req) : [...prev, req]);
  };

  const handleRequestDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !nombre) {
      toast.error('Por favor, ingresa tu nombre y correo');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'demoRequests'), {
        nombre,
        email,
        phone,
        negocio,
        direccion,
        necesidades,
        status: 'pending',
        requestedAt: serverTimestamp(),
        type: 'custom_instance'
      });
      toast.success('¡Solicitud enviada! Nos contactaremos pronto.');
      setIsSubmitted(true);
    } catch (error) {
      console.error(error);
      toast.error('Error al enviar la solicitud. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !nombre || !negocio) {
       toast.error('Rellena los campos obligatorios');
       return;
    }
    if (onDemoSignup) {
       onDemoSignup({ nombre, email, phone, negocio, type: businessType });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 text-white">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">Enterprise POS</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="?mode=login" className="text-slate-500 font-bold hover:text-blue-600 transition text-sm uppercase tracking-wider">Acceso Portal</a>
            <button onClick={() => setShowQuickTrialModal(true)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200">Prueba Gratis 48h</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-block py-1 px-3 rounded-full bg-blue-50 text-blue-600 font-bold text-xs uppercase tracking-widest mb-6 border border-blue-100">
                Enterprise Distribution Network v.01
              </span>
              <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight mb-6">
                Domina la distribución <span className="text-blue-600 underline decoration-blue-100 underline-offset-8">global.</span>
              </h1>
              <p className="text-xl text-slate-500 mb-8 max-w-2xl mx-auto lg:mx-0 font-medium leading-relaxed">
                Gestión inteligente de inventarios, logística avanzada y facturación centralizada para redes de distribución a gran escala.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <button onClick={() => setShowQuickTrialModal(true)} className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-blue-700 transition shadow-xl shadow-blue-200 flex items-center justify-center gap-2">
                  Prueba Gratis Inmediata <ArrowRight className="w-5 h-5" />
                </button>
                <a href="#demo" className="w-full sm:w-auto bg-white text-slate-700 border-2 border-slate-200 px-8 py-4 rounded-2xl font-black text-lg hover:border-slate-300 hover:bg-slate-50 transition text-center flex items-center justify-center">
                  Contactar a Ventas
                </a>
              </div>
            </motion.div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-indigo-50 rounded-[3rem] transform rotate-3 scale-105 -z-10 blur-3xl opacity-50"></div>
            <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=1000" alt="POS System" className="rounded-[2rem] shadow-2xl border-4 border-white transform -rotate-2 hover:rotate-0 transition duration-500" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-4xl font-black tracking-tight text-slate-900 mb-4">Inteligencia Corporativa</h2>
            <p className="text-lg text-slate-500 font-medium tracking-tight">Potencia cada sucursal con herramientas de nivel Enterprise.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[
              { icon: Zap, title: 'Logística en Tiempo Real', desc: 'Rastreo preciso de stock y movimientos entre bodegas con latencia cero.' },
              { icon: Shield, title: 'Seguridad Multi-capa', desc: 'Protocolos de encriptación bancaria para proteger cada transacción comercial.' },
              { icon: BarChart3, title: 'Insights de Mercado', desc: 'Analítica avanzada con IA para predecir demanda y optimizar márgenes.' },
              { icon: Globe, title: 'Escalabilidad Global', desc: 'Añade nuevas regiones o nodos de distribución en segundos desde la nube.' },
              { icon: Smartphone, title: 'Acceso Multi-dispositivo', desc: 'Control total desde tablets, móviles o estaciones de escritorio dedicadas.' },
              { icon: Clock, title: 'Continuidad Operativa', desc: 'Arquitectura resiliente que garantiza disponibilidad del 99.9% para tu negocio.' },
            ].map((feature, i) => (
              <div key={i} className="group bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-2 transition-all duration-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 mb-8 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed text-sm opacity-80 group-hover:opacity-100">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Request Section */}
      <section id="demo" className="py-24 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-900/20 bg-cover bg-center"></div>
        <div className="max-w-4xl mx-auto relative z-10 bg-white/5 backdrop-blur-xl p-8 lg:p-12 rounded-[3rem] border border-white/10 shadow-2xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-4 block">Enterprise Setup</span>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-6 text-white">Diseña tu Instancia Enterprise.</h2>
              <p className="text-lg text-slate-300 font-medium mb-8">
                Cuentanos sobre tu negocio y nuestro equipo configurará un entorno dedicado y optimizado para tus volúmenes de operación.
              </p>
              <ul className="space-y-4">
                {['Mapeo de requerimientos', 'Setup de catálogos', 'Capacitación del equipo', 'Soporte VIP'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-200 font-bold">
                    <CheckCircle2 className="w-6 h-6 text-blue-400" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-xl text-slate-900">
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-black mb-4">¡Petición en Trayecto!</h3>
                  <p className="text-slate-600 font-medium mb-8">
                    Nuestros arquitectos han recibido los detalles corporativos.
                  </p>
                  <button 
                    onClick={() => {
                      setIsSubmitted(false);
                      setNombre('');
                      setEmail('');
                      setPhone('');
                    }} 
                    className="flex text-sm font-bold items-center justify-center gap-2 mx-auto text-blue-600 hover:text-blue-800 transition"
                  >
                    <RefreshCw className="w-4 h-4" /> Nueva solicitud
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-black mb-2">Instancia Enterprise Personalizada</h3>
                  <p className="text-slate-500 font-medium text-sm mb-6">Contacta a ventas para diseñar un entorno alineado a tu infraestructura comercial.</p>
                  <form onSubmit={handleRequestDemo} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo *</label>
                        <input required value={nombre} onChange={e => setNombre(e.target.value)} type="text" className="w-full bg-slate-50 px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 focus:ring-0 outline-none transition font-medium text-sm" placeholder="Ej. Ana Gómez" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Nombre de Empresa *</label>
                        <input required value={negocio} onChange={e => setNegocio(e.target.value)} type="text" className="w-full bg-slate-50 px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 focus:ring-0 outline-none transition font-medium text-sm" placeholder="Bodegas del Sur S.A" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                        <input required value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-slate-50 px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 focus:ring-0 outline-none transition font-medium text-sm" placeholder="ana@empresa.com" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                        <input value={phone} onChange={e => setPhone(formatPhoneNumber(e.target.value))} type="tel" className="w-full bg-slate-50 px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 focus:ring-0 outline-none transition font-medium text-sm" placeholder="(555) 555-5678" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Dirección o País de Operación</label>
                      <input value={direccion} onChange={e => setDireccion(e.target.value)} type="text" className="w-full bg-slate-50 px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 focus:ring-0 outline-none transition font-medium text-sm" placeholder="Miami, FL / Argentina" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Selecciona tus áreas de interés</label>
                      <div className="flex flex-wrap gap-2">
                        {['Reportes P&L', '1099 / W2', 'Control Clock In/Out', 'Más de 10 usuarios', 'B2B Wholesale', 'Retail Multi-sucursal', 'Integración ERP'].map((req) => (
                          <div 
                            key={req} 
                            onClick={() => toggleNecesidad(req)}
                            className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold border ${necesidades.includes(req) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}
                          >
                            {req}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button disabled={isSubmitting} type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-lg hover:bg-slate-800 transition shadow-lg mt-4 disabled:opacity-50">
                      {isSubmitting ? 'Procesando...' : 'Solicitar Instancia Completa'}
                    </button>
                    <p className="text-center text-xs font-bold text-slate-500 mt-4">
                      Un especialista comercial se contactará para diseñar tu entorno a medida.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 text-center border-t border-slate-100 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900">Enterprise POS</span>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">© {new Date().getFullYear()} Enterprise POS Solutions • Global SaaS Portfolio</p>
        </div>
      </footer>

      {showQuickTrialModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Prueba Gratis 48H</h3>
                <p className="text-sm font-medium text-slate-500">Demo con productos iniciales pre-cargados</p>
              </div>
              <button onClick={() => setShowQuickTrialModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <form onSubmit={handleQuickTrialSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo *</label>
                  <input required value={nombre} onChange={e => setNombre(e.target.value)} type="text" className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-0 outline-none transition font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nombre del Negocio *</label>
                  <input required value={negocio} onChange={e => setNegocio(e.target.value)} type="text" className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-0 outline-none transition font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                  <input required value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-0 outline-none transition font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-0 outline-none transition font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Negocio *</label>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <button 
                      type="button"
                      onClick={() => setBusinessType('wholesale')}
                      className={`py-3 px-2 rounded-xl border font-bold transition-all flex flex-col items-center justify-center gap-2 ${businessType === 'wholesale' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      <Layers className="w-5 h-5" />
                      <span className="text-xs">Wholesale</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setBusinessType('retail')}
                      className={`py-3 px-2 rounded-xl border font-bold transition-all flex flex-col items-center justify-center gap-2 ${businessType === 'retail' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      <ShoppingCart className="w-5 h-5" />
                      <span className="text-xs">Retail</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setBusinessType('restaurant')}
                      className={`py-3 px-2 rounded-xl border font-bold transition-all flex flex-col items-center justify-center gap-2 ${businessType === 'restaurant' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      <ChefHat className="w-5 h-5" />
                      <span className="text-xs">Restaurant</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setBusinessType('grocery')}
                      className={`py-3 px-2 rounded-xl border font-bold transition-all flex flex-col items-center justify-center gap-2 ${businessType === 'grocery' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      <Grid className="w-5 h-5" />
                      <span className="text-xs">Grocery</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setBusinessType('combo')}
                      className={`py-3 px-2 rounded-xl border font-bold transition-all flex flex-col items-center justify-center gap-2 col-span-2 lg:col-span-1 ${businessType === 'combo' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      <div className="flex gap-1"><Grid className="w-5 h-5" /><ChefHat className="w-5 h-5" /></div>
                      <span className="text-xs">Combo (Groc. + Rest.)</span>
                    </button>
                  </div>
                </div>
                <button type="submit" className="w-full mt-6 bg-blue-600 text-white py-4 rounded-xl font-black text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                  Comenzar Demo Instantánea <ArrowRight className="w-5 h-5 inline-block ml-1" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
