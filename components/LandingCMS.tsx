import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { 
  Save, RefreshCw, Sparkles, Image, Layout, HelpCircle, FileText, Check, AlignLeft,
  Zap, Shield, BarChart3, Globe, Smartphone, Clock, Monitor, ShoppingCart, ChefHat, Layers, Grid,
  Upload
} from 'lucide-react';

const presetImages = [
  { name: 'Distribución & POS (Por defecto)', url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=1000' },
  { name: 'Tienda de Abarrotes / Grocery', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1000' },
  { name: 'Boutique / Tienda Retail', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1000' },
  { name: 'Logística / Grandes Almacenes', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1000' },
  { name: 'Café de Especialidad / Restaurant', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000' }
];

const availableIcons = [
  'Zap', 'Shield', 'BarChart3', 'Globe', 'Smartphone', 'Clock', 'Monitor', 'ShoppingCart', 'ChefHat', 'Layers', 'Grid'
];

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
}

interface LandingPageData {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  heroCta: string;
  heroCtaSecondary: string;
  featuresTitle: string;
  featuresSubtitle: string;
  features: FeatureItem[];
  contactTitle: string;
  contactSubtitle: string;
  contactItems: string[];
  contactFormTitle: string;
  contactFormSubtitle: string;
}

const DEFAULT_LANDING_DATA: LandingPageData = {
  heroBadge: 'Enterprise Distribution Network v.01',
  heroTitle: 'Domina la distribución global.',
  heroSubtitle: 'Gestión inteligente de inventarios, logística avanzada y facturación centralizada para redes de distribución a gran escala.',
  heroImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=1000',
  heroCta: 'Prueba Gratis Inmediata',
  heroCtaSecondary: 'Contactar a Ventas',
  featuresTitle: 'Inteligencia Corporativa',
  featuresSubtitle: 'Potencia cada sucursal con herramientas de nivel Enterprise.',
  features: [
    { icon: 'Zap', title: 'Logística en Tiempo Real', desc: 'Rastreo preciso de stock y movimientos entre bodegas con latencia cero.' },
    { icon: 'Shield', title: 'Seguridad Multi-capa', desc: 'Protocolos de encriptación bancaria para proteger cada transacción comercial.' },
    { icon: 'BarChart3', title: 'Insights de Mercado', desc: 'Analítica avanzada con IA para predecir demanda y optimizar márgenes.' },
    { icon: 'Globe', title: 'Escalabilidad Global', desc: 'Añade nuevas regiones o nodos de distribución en segundos desde la nube.' },
    { icon: 'Smartphone', title: 'Acceso Multi-dispositivo', desc: 'Control total desde tablets, móviles o estaciones de escritorio dedicadas.' },
    { icon: 'Clock', title: 'Continuidad Operativa', desc: 'Arquitectura resiliente que garantiza disponibilidad del 99.9% para tu negocio.' }
  ],
  contactTitle: 'Diseña tu Instancia Enterprise.',
  contactSubtitle: 'Cuentanos sobre tu negocio y nuestro equipo configurará un entorno dedicado y optimizado para tus volúmenes de operación.',
  contactItems: ['Mapeo de requerimientos', 'Setup de catálogos', 'Capacitación del equipo', 'Soporte VIP'],
  contactFormTitle: 'Instancia Enterprise Personalizada',
  contactFormSubtitle: 'Contacta a ventas para diseñar un entorno alineado a tu infraestructura comercial.'
};

export const LandingCMS: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'hero' | 'features' | 'contact'>('hero');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<LandingPageData>(DEFAULT_LANDING_DATA);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen (JPG, PNG, WebP...)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          setConfig(prev => ({ ...prev, heroImage: dataUrl }));
          toast.success('¡Foto procesada y cargada con éxito!');
        }
      };
      img.onerror = () => {
        toast.error('Error al procesar el archivo de imagen.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'system', 'landingPage'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<LandingPageData>;
        setConfig({
          heroBadge: data.heroBadge || DEFAULT_LANDING_DATA.heroBadge,
          heroTitle: data.heroTitle || DEFAULT_LANDING_DATA.heroTitle,
          heroSubtitle: data.heroSubtitle || DEFAULT_LANDING_DATA.heroSubtitle,
          heroImage: data.heroImage || DEFAULT_LANDING_DATA.heroImage,
          heroCta: data.heroCta || DEFAULT_LANDING_DATA.heroCta,
          heroCtaSecondary: data.heroCtaSecondary || DEFAULT_LANDING_DATA.heroCtaSecondary,
          featuresTitle: data.featuresTitle || DEFAULT_LANDING_DATA.featuresTitle,
          featuresSubtitle: data.featuresSubtitle || DEFAULT_LANDING_DATA.featuresSubtitle,
          features: data.features || DEFAULT_LANDING_DATA.features,
          contactTitle: data.contactTitle || DEFAULT_LANDING_DATA.contactTitle,
          contactSubtitle: data.contactSubtitle || DEFAULT_LANDING_DATA.contactSubtitle,
          contactItems: data.contactItems || DEFAULT_LANDING_DATA.contactItems,
          contactFormTitle: data.contactFormTitle || DEFAULT_LANDING_DATA.contactFormTitle,
          contactFormSubtitle: data.contactFormSubtitle || DEFAULT_LANDING_DATA.contactFormSubtitle
        });
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Error al conectar con la base de datos');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'system', 'landingPage'), config);
      toast.success('¡Landing page actualizada correctamente! Los visitantes verán tus cambios de inmediato.');
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar los cambios en Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('¿Estás seguro de que deseas restablecer los textos y fotos predeterminados de fábrica?')) {
      setConfig(DEFAULT_LANDING_DATA);
      toast.info('Se han cargado los valores por defecto. Guarda los cambios para aplicarlos.');
    }
  };

  const updateFeatureField = (index: number, field: keyof FeatureItem, value: string) => {
    const updatedFeatures = [...config.features];
    updatedFeatures[index] = {
      ...updatedFeatures[index],
      [field]: value
    };
    setConfig({ ...config, features: updatedFeatures });
  };

  const updateContactItem = (index: number, value: string) => {
    const updatedItems = [...config.contactItems];
    updatedItems[index] = value;
    setConfig({ ...config, contactItems: updatedItems });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-bold">Cargando editor del portal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CMS Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-6 lg:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2 bg-blue-600/50 w-fit px-3 py-1 rounded-full border border-blue-400/30">
            <Sparkles className="w-4 h-4 text-blue-200 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Editor Visual de Landing Page / CMS</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight">Cambia Textos y Fotos del Portal</h2>
          <p className="text-blue-100/90 text-sm font-medium mt-1 max-w-2xl">
            Personaliza lo que tus visitantes, clientes y administradores de franquicias ven antes de ingresar a la plataforma. No requiere saber de código.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold text-sm text-white transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Restablecer
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 hover:-translate-y-0.5 border border-green-400 rounded-xl font-black text-sm text-white transition shadow-lg shadow-green-950/20 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Editor Form Panel (Left side) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          {/* Sub-tabs Selection */}
          <div className="flex border-b border-gray-100 bg-gray-50/50">
            <button 
              onClick={() => setActiveSubTab('hero')}
              className={`flex-1 py-4 text-center font-black text-sm transition-all border-b-2 flex items-center justify-center gap-2 ${activeSubTab === 'hero' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Layout className="w-4 h-4" /> Sección Principal (Hero)
            </button>
            <button 
              onClick={() => setActiveSubTab('features')}
              className={`flex-1 py-4 text-center font-black text-sm transition-all border-b-2 flex items-center justify-center gap-2 ${activeSubTab === 'features' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Zap className="w-4 h-4" /> Características (CMS)
            </button>
            <button 
              onClick={() => setActiveSubTab('contact')}
              className={`flex-1 py-4 text-center font-black text-sm transition-all border-b-2 flex items-center justify-center gap-2 ${activeSubTab === 'contact' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <FileText className="w-4 h-4" /> Contacto & Demostración
            </button>
          </div>

          <div className="p-6 space-y-6 flex-1 max-h-[75vh] overflow-y-auto">
            {activeSubTab === 'hero' && (
              <div className="space-y-6">
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                  <Image className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Sección de Inicio (Hero)</h4>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Esta es la primera sección con la que interactúan tus clientes. Elige un título enganchador y una foto profesional de tu sistema de ventas.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Etiqueta Superior (Badge)</label>
                    <input 
                      type="text" 
                      value={config.heroBadge}
                      onChange={e => setConfig({ ...config, heroBadge: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-bold text-sm text-gray-800"
                      placeholder="Ej. Enterprise Distribution Network v.01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Título Principal (Hero Title)</label>
                    <input 
                      type="text" 
                      value={config.heroTitle}
                      onChange={e => setConfig({ ...config, heroTitle: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-black text-sm text-gray-800"
                      placeholder="Ej. Domina la distribución global."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Subtítulo / Descripción Hero (Hero Subtitle)</label>
                  <textarea 
                    value={config.heroSubtitle}
                    onChange={e => setConfig({ ...config, heroSubtitle: e.target.value })}
                    className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-semibold text-sm text-gray-600 min-h-[90px] leading-relaxed"
                    placeholder="Escribe una atractiva descripción para enganchar al usuario..."
                  />
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Image className="w-4 h-4 text-blue-600" />
                    Foto / Imagen de Portada del Héroe
                  </label>

                  {/* Drag and Drop Zone */}
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all bg-gray-50/50 mb-4 cursor-pointer relative ${
                      dragActive 
                        ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-100' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input 
                      type="file" 
                      id="hero-image-upload"
                      accept="image/*"
                      onChange={handleChangeFile}
                      className="hidden" 
                    />
                    <label 
                      htmlFor="hero-image-upload" 
                      className="cursor-pointer flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="w-12 h-12 bg-blue-100/70 text-blue-600 rounded-full flex items-center justify-center border border-blue-200">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-center space-y-2">
                        <p className="text-sm font-semibold text-gray-400">Arrastra tu foto de portada aquí, o</p>
                        <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow-md cursor-pointer">
                          <Upload className="w-4 h-4" /> Importar Foto desde mi PC
                        </span>
                        <p className="text-[10px] text-gray-400 font-medium pt-1">Formatos permitidos: PNG, JPG, JPEG, WEBP. Se optimizará automáticamente.</p>
                      </div>
                    </label>

                    {/* Quick Preview inside dropzone if custom image is set */}
                    {config.heroImage && (
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-4">
                        <div className="relative w-20 h-12 rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm flex-shrink-0">
                          <img src={config.heroImage} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="text-left">
                          <p className="text-[11px] font-bold text-gray-800">Imagen actual de la portada</p>
                          <p className="text-[9px] text-gray-400 font-semibold truncate max-w-sm">
                            {config.heroImage.startsWith('data:') ? 'Imagen cargada desde tu dispositivo (Optimizada)' : config.heroImage}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">O si lo prefieres, pega una dirección URL (HTTPS) de imagen:</label>
                    <input 
                      type="url" 
                      value={config.heroImage?.startsWith('data:') ? '' : config.heroImage}
                      onChange={e => setConfig({ ...config, heroImage: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-xs text-gray-500 mb-4"
                      placeholder="https://images.unsplash.com/photo-..."
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-500">O haz clic para aplicar una de nuestras fotos preconfiguradas:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {presetImages.map((img) => (
                        <div 
                          key={img.url}
                          onClick={() => setConfig({ ...config, heroImage: img.url })}
                          className={`cursor-pointer group flex flex-col rounded-xl overflow-hidden border-2 transition-all ${config.heroImage === img.url ? 'border-blue-600 ring-2 ring-blue-100 bg-blue-50/50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                        >
                          <img src={img.url} alt={img.name} className="h-20 object-cover w-full opacity-80 group-hover:opacity-100 transition" referrerPolicy="no-referrer" />
                          <div className="p-2 text-[10px] font-bold text-gray-600 text-center truncate">{img.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-6">
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Botón de Llamado Primario (CTA)</label>
                    <input 
                      type="text" 
                      value={config.heroCta}
                      onChange={e => setConfig({ ...config, heroCta: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-bold text-sm text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Botón de Llamado Secundario</label>
                    <input 
                      type="text" 
                      value={config.heroCtaSecondary}
                      onChange={e => setConfig({ ...config, heroCtaSecondary: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-bold text-sm text-gray-800"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'features' && (
              <div className="space-y-6">
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
                  <Zap className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-indigo-900">Sección de Beneficios y Ventajas</h4>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      Edita el encabezado y las 6 tarjetas de características de tu sistema que diferencian tu negocio de la competencia.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Título de Características</label>
                    <input 
                      type="text" 
                      value={config.featuresTitle}
                      onChange={e => setConfig({ ...config, featuresTitle: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-black text-sm text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Subtítulo de Características</label>
                    <input 
                      type="text" 
                      value={config.featuresSubtitle}
                      onChange={e => setConfig({ ...config, featuresSubtitle: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-bold text-sm text-gray-800"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6 space-y-6">
                  <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">Tarjetas Individuales de Beneficio (6)</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    {config.features.map((feature, idx) => (
                      <div key={idx} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 relative">
                        <span className="absolute top-3 right-4 text-[10px] font-black text-gray-300"># {idx + 1}</span>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Icono Asociado</label>
                            <div className="flex flex-wrap gap-1.5">
                              {availableIcons.map((iconName) => (
                                <button 
                                  key={iconName}
                                  type="button"
                                  onClick={() => updateFeatureField(idx, 'icon', iconName)}
                                  className={`p-1.5 rounded-lg border text-xs transition ${feature.icon === iconName ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
                                  title={iconName}
                                >
                                  {iconName === 'Zap' && <Zap className="w-3.5 h-3.5" />}
                                  {iconName === 'Shield' && <Shield className="w-3.5 h-3.5" />}
                                  {iconName === 'BarChart3' && <BarChart3 className="w-3.5 h-3.5" />}
                                  {iconName === 'Globe' && <Globe className="w-3.5 h-3.5" />}
                                  {iconName === 'Smartphone' && <Smartphone className="w-3.5 h-3.5" />}
                                  {iconName === 'Clock' && <Clock className="w-3.5 h-3.5" />}
                                  {iconName === 'Monitor' && <Monitor className="w-3.5 h-3.5" />}
                                  {iconName === 'ShoppingCart' && <ShoppingCart className="w-3.5 h-3.5" />}
                                  {iconName === 'ChefHat' && <ChefHat className="w-3.5 h-3.5" />}
                                  {iconName === 'Layers' && <Layers className="w-3.5 h-3.5" />}
                                  {iconName === 'Grid' && <Grid className="w-3.5 h-3.5" />}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-gray-600 uppercase tracking-wider mb-1">Título de Tarjeta</label>
                            <input 
                              type="text" 
                              value={feature.title}
                              onChange={e => updateFeatureField(idx, 'title', e.target.value)}
                              className="w-full bg-white px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none font-bold text-sm text-gray-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-gray-600 uppercase tracking-wider mb-1">Breve Descripción</label>
                            <textarea 
                              value={feature.desc}
                              onChange={e => updateFeatureField(idx, 'desc', e.target.value)}
                              className="w-full bg-white px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none font-semibold text-xs text-gray-500 min-h-[60px]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'contact' && (
              <div className="space-y-6">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                  <FileText className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Sección de Demo e Instancia Enterprise</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Personaliza los textos laterales de la sección de contacto, los ítems de valor agregado, y el formulario de solicitud de cuenta.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Título Lateral de Contacto</label>
                    <input 
                      type="text" 
                      value={config.contactTitle}
                      onChange={e => setConfig({ ...config, contactTitle: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-black text-sm text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Subtítulo Lateral</label>
                    <input 
                      type="text" 
                      value={config.contactSubtitle}
                      onChange={e => setConfig({ ...config, contactSubtitle: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-bold text-sm text-gray-800"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-3">Ítems de Compromiso de Valor (4)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {config.contactItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 w-6 h-6 rounded-full flex items-center justify-center border border-blue-100 flex-shrink-0">{idx + 1}</span>
                        <input 
                          type="text" 
                          value={item}
                          onChange={e => updateContactItem(idx, e.target.value)}
                          className="bg-transparent text-sm font-bold text-gray-700 w-full outline-none focus:text-blue-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Cabecera del Formulario</label>
                    <input 
                      type="text" 
                      value={config.contactFormTitle}
                      onChange={e => setConfig({ ...config, contactFormTitle: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-black text-sm text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Subtítulo del Formulario</label>
                    <input 
                      type="text" 
                      value={config.contactFormSubtitle}
                      onChange={e => setConfig({ ...config, contactFormSubtitle: e.target.value })}
                      className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-bold text-sm text-gray-800"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Simulated Live Preview (Right side) */}
        <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 text-slate-100 flex flex-col justify-between shadow-2xl relative overflow-hidden h-fit">
          <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-blue-500/10 blur-[60px] rounded-full"></div>
          
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/85 relative z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previsualización En Vivo</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 py-1 px-2 rounded-md text-slate-400">Mobile Frame v.05</span>
          </div>

          <div className="space-y-6 relative z-10 select-none pointer-events-none">
            {/* Nav mockup */}
            <div className="flex justify-between items-center opacity-70">
              <span className="text-xs font-black text-white">Enterprise POS</span>
              <span className="text-[9px] font-black border border-blue-500 text-blue-400 py-0.5 px-2 rounded bg-blue-950/30">Prueba 48h</span>
            </div>

            {/* Hero Mockup */}
            <div className="space-y-3 pt-2 text-center">
              <span className="inline-block text-[8px] font-black bg-blue-950 text-blue-400 px-2 py-0.5 rounded-full border border-blue-800/40 uppercase">
                {config.heroBadge || 'ENTERPRISE'}
              </span>
              <h1 className="text-lg lg:text-xl font-black text-white leading-tight">
                {config.heroTitle || 'Domina'}
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed max-w-xs mx-auto truncate">
                {config.heroSubtitle || 'Gestión inteligente...'}
              </p>
              
              <div className="flex gap-1.5 justify-center py-1">
                <span className="text-[8px] font-extrabold bg-blue-600 text-white px-3 py-1.5 rounded-lg shrink-0">{config.heroCta}</span>
                <span className="text-[8px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg shrink-0">{config.heroCtaSecondary}</span>
              </div>
            </div>

            {/* Simulated Desktop App Screenshot */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1 overflow-hidden relative shadow-inner">
              <div className="flex items-center gap-1.5 px-1 py-1 bg-slate-950 rounded-t-lg opacity-40">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              </div>
              <img src={config.heroImage} alt="Preview" className="h-32 w-full object-cover rounded-b-lg object-top" referrerPolicy="no-referrer" />
            </div>

            {/* Features Preview Single Box */}
            <div className="border border-slate-800 bg-slate-900/40 p-3 rounded-2xl">
              <div className="text-center mb-3">
                <span className="text-[9px] font-black text-slate-200">{config.featuresTitle}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {config.features.slice(0, 2).map((item, i) => (
                  <div key={i} className="bg-slate-950/50 p-2 rounded-xl border border-slate-850">
                    <div className="w-5 h-5 bg-slate-900 rounded flex items-center justify-center text-blue-400 mb-1">
                      {item.icon === 'Zap' && <Zap className="w-3 h-3" />}
                      {item.icon === 'Shield' && <Shield className="w-3 h-3" />}
                      {item.icon === 'BarChart3' && <BarChart3 className="w-3 h-3" />}
                      {item.icon === 'Globe' && <Globe className="w-3 h-3" />}
                      {item.icon === 'Smartphone' && <Smartphone className="w-3 h-3" />}
                      {item.icon === 'Clock' && <Clock className="w-3 h-3" />}
                      {item.icon === 'Monitor' && <Monitor className="w-3 h-3" />}
                      {item.icon === 'ShoppingCart' && <ShoppingCart className="w-3 h-3" />}
                      {item.icon === 'ChefHat' && <ChefHat className="w-3 h-3" />}
                      {item.icon === 'Layers' && <Layers className="w-3 h-3" />}
                      {item.icon === 'Grid' && <Grid className="w-3 h-3" />}
                    </div>
                    <div className="text-[9px] font-black text-white truncate">{item.title}</div>
                    <div className="text-[7px] text-slate-500 truncate mt-0.5">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Contact Preview Header */}
            <div className="bg-blue-600/10 p-3 border border-blue-500/20 rounded-2xl text-center space-y-1">
              <span className="block text-[9px] font-black text-blue-400">{config.contactTitle}</span>
              <p className="text-[8px] text-slate-400 line-clamp-1">{config.contactSubtitle}</p>
              <div className="flex justify-center gap-1 text-[7px] text-slate-300 font-bold">
                <span className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800">✓ {config.contactItems[0]}</span>
                <span className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800">✓ {config.contactItems[1]}</span>
              </div>
            </div>
          </div>

          <div className="text-[9px] text-center text-slate-500 mt-6 pt-3 border-t border-slate-800/50 relative z-10 select-none font-bold">
            Guarda en la izquierda para aplicar al portal en vivo
          </div>
        </div>
      </div>
    </div>
  );
};
