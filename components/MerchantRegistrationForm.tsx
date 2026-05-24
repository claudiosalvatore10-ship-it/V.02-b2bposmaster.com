import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Building2, CreditCard, Upload, CheckCircle2, 
  ArrowLeft, ArrowRight, Loader2, Trash2, Check, ExternalLink, RefreshCw 
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { MerchantRegistration, Salesman } from '../types';
import { toast } from 'sonner';
import { formatPhoneNumber, formatSsn, formatTaxId } from '../utils';

interface MerchantRegistrationFormProps {
  onBackToLanding?: () => void;
  fixedSalesman?: Salesman | null;
}

export default function MerchantRegistrationForm({ onBackToLanding, fixedSalesman }: MerchantRegistrationFormProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('');
  const [customSalesmanCode, setCustomSalesmanCode] = useState<string>('');
  const [verifiedSalesman, setVerifiedSalesman] = useState<Salesman | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Owner's Information
    ownerFirstName: '',
    ownerLastName: '',
    ownerDob: '',
    ownerSsn: '',
    ownerCountry: 'US',
    ownerHomeAddress: '',
    ownerApartment: '',
    ownerCity: '',
    ownerState: '',
    ownerZipCode: '',
    ownerCellPhone: '',
    ownerEmail: '',

    // Business Information
    busStoreNameDba: '',
    busLegalName: '',
    busLegalType: 'LLC',
    busPhysicalAddress: '',
    busCity: '',
    busState: '',
    busZipCode: '',
    busPhone: '',
    busLegalSameAsDbaAddress: true,
    busTaxId: '',
    busEstablishedDate: '',

    // Bank Info
    bankName: '',
    bankAccountHolder: '',
    bankRoutingNumber: '',
    bankAccountNumber: '',
    bankIndustryType: 'Retail',
    bankProjectedMonthlyCreditCardCharges: 'Under $10,000',
    bankProjectedYearlyStoreSales: 'Under $100,000',
    notes: '',
  });

  // Files State (Base64 representation)
  const [files, setFiles] = useState<{
    docDriversLicense: string;
    docDriversLicenseName: string;
    docBusinessLicense: string;
    docBusinessLicenseName: string;
    docVoidedCheck: string;
    docVoidedCheckName: string;
    docAdditional_1: string;
    docAdditional_1Name: string;
    docAdditional_2: string;
    docAdditional_2Name: string;
  }>({
    docDriversLicense: '',
    docDriversLicenseName: '',
    docBusinessLicense: '',
    docBusinessLicenseName: '',
    docVoidedCheck: '',
    docVoidedCheckName: '',
    docAdditional_1: '',
    docAdditional_1Name: '',
    docAdditional_2: '',
    docAdditional_2Name: '',
  });

  // Load Salesmen for assignment validation
  useEffect(() => {
    const fetchSalesmen = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'salesreps'));
        const activeSalesmen = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Salesman)).filter(s => s.activo !== false);
        setSalesmen(activeSalesmen);

        if (fixedSalesman) {
          setVerifiedSalesman(fixedSalesman);
          setSelectedSalesmanId(fixedSalesman.id);
        }
      } catch (err) {
        console.error('Error fetching salespeople:', err);
      }
    };
    fetchSalesmen();
  }, [fixedSalesman]);

  const handleVerifySalesman = () => {
    if (!customSalesmanCode.trim()) {
      toast.error('Ingrese un código de vendedor válido');
      return;
    }
    const codeUpper = customSalesmanCode.trim().toUpperCase();
    if (codeUpper === 'DIRECTO' || codeUpper === 'DIRECT' || codeUpper === 'WEB' || codeUpper === 'ONLINE') {
      const directSalesman: Salesman = {
        id: 'salesman-direct',
        storeId: 'SYSTEM',
        nombre: 'Registro',
        apellido: 'Directo (Web)',
        codigo: codeUpper,
        email: 'direct@b2bposmaster.com',
        telefono: '',
        direccion: '',
        ciudad: '',
        estado: '',
        cp: '',
        taxId: '',
        activo: true
      };
      setVerifiedSalesman(directSalesman);
      setSelectedSalesmanId(directSalesman.id);
      toast.success('Código verificado con éxito: Registro Directo (Web/Online)');
      return;
    }
    const found = salesmen.find(
      s => s.codigo?.toLowerCase() === customSalesmanCode.trim().toLowerCase()
    );
    if (found) {
      setVerifiedSalesman(found);
      setSelectedSalesmanId(found.id);
      toast.success(`Vendedor Verificado: ${found.nombre} ${found.apellido}`);
    } else {
      toast.error('Código de vendedor no encontrado. Use "DIRECTO" si se registra sin asesor.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: formatPhoneNumber(value) }));
  };

  const handleSsnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, ownerSsn: formatSsn(e.target.value) }));
  };

  const handleTaxIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, busTaxId: formatTaxId(e.target.value) }));
  };

  const handleRoutingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
    setFormData(prev => ({ ...prev, bankRoutingNumber: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileKey: keyof typeof files) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error('El tamaño de la imagen no debe exceder los 8 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const nameKey = `${String(fileKey)}Name` as keyof typeof files;
        setFiles(prev => ({
          ...prev,
          [fileKey]: reader.result as string,
          [nameKey]: file.name,
        }));
        toast.success(`Archivo subido exitosamente: ${file.name}`);
      }
    };
    reader.onerror = () => {
      toast.error('Error al leer el archivo');
    };
    reader.readAsDataURL(file);
  };

  const removeFile = (fileKey: keyof typeof files) => {
    const nameKey = `${String(fileKey)}Name` as keyof typeof files;
    setFiles(prev => ({
      ...prev,
      [fileKey]: '',
      [nameKey]: '',
    }));
  };

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      const required = [
        'ownerFirstName', 'ownerLastName', 'ownerDob', 'ownerSsn', 
        'ownerHomeAddress', 'ownerCity', 'ownerState', 'ownerZipCode', 
        'ownerCellPhone', 'ownerEmail'
      ];
      for (const field of required) {
        if (!formData[field as keyof typeof formData]) {
          toast.error(`Por favor ingrese todos los campos requeridos del dueño.`);
          return false;
        }
      }
      return true;
    }
    if (currentStep === 2) {
      const required = [
        'busStoreNameDba', 'busLegalName', 'busPhysicalAddress', 
        'busCity', 'busState', 'busZipCode', 'busPhone', 'busTaxId'
      ];
      for (const field of required) {
        if (!formData[field as keyof typeof formData]) {
          toast.error('Por favor ingrese todos los campos requeridos del negocio.');
          return false;
        }
      }
      return true;
    }
    if (currentStep === 3) {
      const required = [
        'bankName', 'bankAccountHolder', 'bankRoutingNumber', 'bankAccountNumber'
      ];
      for (const field of required) {
        if (!formData[field as keyof typeof formData]) {
          toast.error('Por favor ingrese todos los datos bancarios requeridos.');
          return false;
        }
      }
      if (formData.bankRoutingNumber.length !== 9) {
        toast.error('El Routing Number del banco debe tener exactamente 9 dígitos.');
        return false;
      }
      return true;
    }
    if (currentStep === 4) {
      if (!files.docDriversLicense) {
        toast.error('Se requiere subir una foto de la Licencia de Conducir.');
        return false;
      }
      if (!files.docVoidedCheck) {
        toast.error('Se requiere subir la foto del Cheque Voided.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setStep(prev => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    if (!selectedSalesmanId && !verifiedSalesman) {
      toast.error('Por favor verifique su código de vendedor o seleccione uno.');
      return;
    }

    setLoading(true);
    try {
      const activeRep = verifiedSalesman || salesmen.find(s => s.id === selectedSalesmanId);
      const name = activeRep ? `${activeRep.nombre} ${activeRep.apellido}` : 'Vendedor Desconocido';
      const storeId = activeRep?.storeId || 'SYSTEM';

      const pathForWrite = 'merchantRegistrations';
      const registrationDoc: Omit<MerchantRegistration, 'id'> = {
        storeId,
        salesmanId: activeRep?.id || 'EXTERNAL_SALES',
        salesmanName: name,
        status: 'pending',
        createdAt: Date.now(),
        
        ...formData,
        ...files
      };

      await addDoc(collection(db, pathForWrite), registrationDoc);
      toast.success('¡Registro de merchant enviado de manera exitosa!');
      setStep(5); // Show success screen
    } catch (error) {
      toast.error(`Error al transferir los datos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: string) => {
    return val;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="merchant-registration-screen">
      {/* Dynamic Navigation Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            M
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Merchant ProMaster Onboarding</h1>
            <p className="text-xs text-slate-500 font-medium">Sales Field Tool v.02</p>
          </div>
        </div>

        {onBackToLanding && (
          <button 
            onClick={onBackToLanding}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a b2bposmaster.com
          </button>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col justify-start">
        
        {/* Header Hero Area */}
        <div className="mb-6 text-center md:text-left mt-2">
          <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs font-bold text-indigo-700 uppercase tracking-widest leading-none">
            Tarjeta de Crédito & Onboarding
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2 tracking-tight">
            Sección de Registro de Cuentas Nuevas
          </h2>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl">
            Complete todos los campos del dueño, comercio y adjunte los soportes visuales para iniciar la aprobación inmediata del procesamiento de cobros con tarjetas.
          </p>
        </div>

        {/* Step Wizard Bar */}
        {step <= 4 && (
          <div className="mb-8 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 mb-4 font-bold">
              <span>PASO {step} DE 4</span>
              <span className="text-indigo-600 uppercase tracking-wide">
                {step === 1 && '🔑 Datos de Identificación del Dueño / Owner\'s Information'}
                {step === 2 && '🏢 Perfil del Establecimiento / Business Details'}
                {step === 3 && '🏦 Domiciliación de Fondos y Proyección Bancaria'}
                {step === 4 && '📸 Soporte y Documentação en Fotografía (Soportes)'}
              </span>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(s => (
                <div 
                  key={s} 
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    s === step 
                      ? 'bg-indigo-600 w-full' 
                      : s < step 
                        ? 'bg-emerald-500' 
                        : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>

            {/* Salesperson Assignment Widget */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                <span className="text-xs font-semibold text-slate-700">Firma del Representante de Ventas:</span>
              </div>

              {verifiedSalesman ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-extrabold text-emerald-800">
                    {verifiedSalesman.nombre} {verifiedSalesman.apellido} (Cód: {verifiedSalesman.codigo})
                  </span>
                  {!fixedSalesman && (
                    <button 
                      onClick={() => {
                        setVerifiedSalesman(null);
                        setSelectedSalesmanId('');
                      }}
                      className="text-emerald-800 hover:text-red-600 ml-1.5 transition text-[10px] font-black uppercase"
                    >
                      [Cambiar]
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input 
                    type="text" 
                    placeholder="Cód. Vendedor (o DIRECTO) *" 
                    value={customSalesmanCode}
                    onChange={(e) => setCustomSalesmanCode(e.target.value)}
                    className="px-3 py-1.5 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
                  />
                  <button 
                    onClick={handleVerifySalesman}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                  >
                    Verificar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Panel */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-8 flex-1">
          <AnimatePresence mode="wait">
            
            {/* Step 1: Owner Info */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
                id="step-owner-info"
              >
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-600" />
                    Información del Dueño o Firmante Autorizado
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Ingrese los datos exactos que aparecen en la Licencia de Conducir o pasaporte del dueño legal del negocio.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Nombre (First Name) *</label>
                    <input 
                      type="text" 
                      name="ownerFirstName" 
                      value={formData.ownerFirstName} 
                      onChange={handleChange}
                      placeholder="Ej: Juan"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Apellido (Last Name) *</label>
                    <input 
                      type="text" 
                      name="ownerLastName" 
                      value={formData.ownerLastName} 
                      onChange={handleChange}
                      placeholder="Ej: Pérez"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Fecha de Nacimiento *</label>
                    <input 
                      type="date" 
                      name="ownerDob" 
                      value={formData.ownerDob} 
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">SSN (Número Seguro Social) *</label>
                    <input 
                      type="text" 
                      name="ownerSsn" 
                      value={formData.ownerSsn} 
                      onChange={handleSsnChange}
                      placeholder="000-00-0000"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">País de Residencia *</label>
                    <select 
                      name="ownerCountry" 
                      value={formData.ownerCountry} 
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    >
                      <option value="US">Estados Unidos (US)</option>
                      <option value="MX">México (MX)</option>
                      <option value="CA">Canadá (CA)</option>
                      <option value="CO">Colombia (CO)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Celular Personal *</label>
                    <input 
                      type="text" 
                      name="ownerCellPhone" 
                      value={formData.ownerCellPhone} 
                      onChange={handlePhoneChange}
                      placeholder="(000) 000-0000"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Email Personal *</label>
                    <input 
                      type="email" 
                      name="ownerEmail" 
                      value={formData.ownerEmail} 
                      onChange={handleChange}
                      placeholder="dueño@correo.com"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Dirección Particular Residencia *</label>
                    <input 
                      type="text" 
                      name="ownerHomeAddress" 
                      value={formData.ownerHomeAddress} 
                      onChange={handleChange}
                      placeholder="Calle, número, fraccionamiento o vecindad"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Apartamento / Suite (Opcional)</label>
                    <input 
                      type="text" 
                      name="ownerApartment" 
                      value={formData.ownerApartment} 
                      onChange={handleChange}
                      placeholder="No. Apt, Suite 101"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Ciudad *</label>
                    <input 
                      type="text" 
                      name="ownerCity" 
                      value={formData.ownerCity} 
                      onChange={handleChange}
                      placeholder="Ciudad"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Estado *</label>
                    <input 
                      type="text" 
                      name="ownerState" 
                      value={formData.ownerState} 
                      onChange={handleChange}
                      placeholder="Ej: FL, TX, CA"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Código Postal (Zip Code) *</label>
                    <input 
                      type="text" 
                      name="ownerZipCode" 
                      value={formData.ownerZipCode} 
                      onChange={handleChange}
                      placeholder="Zip"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Business Info */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
                id="step-business-info"
              >
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    Perfil & Datos Legales del Negocio
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Defina el nombre comercial (DBA), de constitución empresarial y los identificadores fiscales de la tienda.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Nombre Comercial (Store DBA) *</label>
                    <input 
                      type="text" 
                      name="busStoreNameDba" 
                      value={formData.busStoreNameDba} 
                      onChange={handleChange}
                      placeholder="Ej: Supermarket Pro"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Razón Social Legal (Legal Name) *</label>
                    <input 
                      type="text" 
                      name="busLegalName" 
                      value={formData.busLegalName} 
                      onChange={handleChange}
                      placeholder="Ej: Pérez Enterprise LLC"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Tipo de Estructura Legal *</label>
                    <select 
                      name="busLegalType" 
                      value={formData.busLegalType} 
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    >
                      <option value="LLC">Sociedad de Resp. Limitada (LLC)</option>
                      <option value="Sole Proprietor">Propietario Único (Sole Proprietorship)</option>
                      <option value="S-Corp">Corporación S (S-Corporation)</option>
                      <option value="C-Corp">Corporación C (C-Corporation)</option>
                      <option value="Partnership">Asociación (Partnership)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">TAX ID / EIN (Identificación Fiscal) *</label>
                    <input 
                      type="text" 
                      name="busTaxId" 
                      value={formData.busTaxId} 
                      onChange={handleTaxIdChange}
                      placeholder="XX-XXXXXXX"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Teléfono del Comercio *</label>
                    <input 
                      type="text" 
                      name="busPhone" 
                      value={formData.busPhone} 
                      onChange={handlePhoneChange}
                      placeholder="(000) 000-0000"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Fecha de Constitución *</label>
                    <input 
                      type="date" 
                      name="busEstablishedDate" 
                      value={formData.busEstablishedDate} 
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Dirección Física del Establecimiento *</label>
                    <input 
                      type="text" 
                      name="busPhysicalAddress" 
                      value={formData.busPhysicalAddress} 
                      onChange={handleChange}
                      placeholder="Dirección del local o bodega"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Ciudad del Comercio *</label>
                    <input 
                      type="text" 
                      name="busCity" 
                      value={formData.busCity} 
                      onChange={handleChange}
                      placeholder="Ciudad"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Estado del Comercio *</label>
                    <input 
                      type="text" 
                      name="busState" 
                      value={formData.busState} 
                      onChange={handleChange}
                      placeholder="Estado"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Zip Code del Comercio *</label>
                    <input 
                      type="text" 
                      name="busZipCode" 
                      value={formData.busZipCode} 
                      onChange={handleChange}
                      placeholder="Código Postal"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 md:col-span-2 pt-2">
                    <input 
                      type="checkbox" 
                      id="busLegalSameAsDbaAddress" 
                      name="busLegalSameAsDbaAddress" 
                      checked={formData.busLegalSameAsDbaAddress}
                      onChange={handleChange}
                      className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded-md focus:ring-indigo-500"
                    />
                    <label htmlFor="busLegalSameAsDbaAddress" className="text-xs font-bold text-slate-700 select-none">
                      La dirección postal e impuestos legal del negocio es igual a la dirección física comercial anterior.
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Bank & Volumes */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
                id="step-bank-info"
              >
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    Domiciliación de Fondos y Proyección de Ventas
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Indique la cuenta donde se le depositarán los reembolsos diarios de cobros por tarjeta de crédito, y sus proyecciones operativas.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Nombre del Banco *</label>
                    <input 
                      type="text" 
                      name="bankName" 
                      value={formData.bankName} 
                      onChange={handleChange}
                      placeholder="Ej: Chase, Bank of America, Wells Fargo"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Titular de la Cuenta *</label>
                    <input 
                      type="text" 
                      name="bankAccountHolder" 
                      value={formData.bankAccountHolder} 
                      onChange={handleChange}
                      placeholder="Ej: Pérez Enterprise LLC o Juan Pérez"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Número de Ruta (Routing Number - 9 Dígitos) *</label>
                    <input 
                      type="text" 
                      name="bankRoutingNumber" 
                      value={formData.bankRoutingNumber} 
                      onChange={handleRoutingChange}
                      placeholder="000000000"
                      className="w-full px-4 py-2.5 text-sm font-mono tracking-wider bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                    <span className="text-[10px] text-slate-400 font-medium">Debe coincidir exactamente con el cheque voided.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Número de Cuenta Bancaria *</label>
                    <input 
                      type="text" 
                      name="bankAccountNumber" 
                      value={formData.bankAccountNumber} 
                      onChange={handleChange}
                      placeholder="0000000000"
                      className="w-full px-4 py-2.5 text-sm font-mono tracking-wider bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Rubro de la Industria / Tipo de Negocio *</label>
                    <select 
                      name="bankIndustryType" 
                      value={formData.bankIndustryType} 
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    >
                      <option value="Retail">Minorista / Retail (Tienda, Grocery)</option>
                      <option value="Restaurant">Restaurante / Alimentos</option>
                      <option value="Wholesale">Venta al por Mayor / Wholesale</option>
                      <option value="Services">Servicios Profesionales / Profesiones</option>
                      <option value="E-Commerce">Comercio Electrónico / Ecommerce</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Procesamiento de Tarjeta Mensual Estimado *</label>
                    <select 
                      name="bankProjectedMonthlyCreditCardCharges" 
                      value={formData.bankProjectedMonthlyCreditCardCharges} 
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    >
                      <option value="Under $10,000">Menos de $10,000</option>
                      <option value="$10,000 - $30,000">$10,000 a $30,000</option>
                      <option value="$30,000 - $100,000">$30,000 a $100,000</option>
                      <option value="$100,000 - $250,000">$100,000 a $250,000</option>
                      <option value="Over $250,000">Más de $250,000</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Venta Anual Store Total Estimada *</label>
                    <select 
                      name="bankProjectedYearlyStoreSales" 
                      value={formData.bankProjectedYearlyStoreSales} 
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    >
                      <option value="Under $100,000">Menos de $100,000</option>
                      <option value="$100,000 - $500,000">$100,000 a $500,000</option>
                      <option value="$500,000 - $1,500,000">$500,000 a $1,500,000</option>
                      <option value="Over $1,500,000">Más de $1,500,000</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase mb-1">Notas, Peticiones de Pricing o Comentarios Adicionales (Opcional)</label>
                    <textarea 
                      name="notes"
                      rows={3}
                      value={formData.notes || ''}
                      onChange={handleChange}
                      placeholder="Escriba aquí alguna nota para aprobación rápida, solicitud de lector inalámbrico, tasas acordadas, etc."
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Visual Documents Upload */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
                id="step-attachments-info"
              >
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-indigo-600" />
                    Soporte Visual & Carga de Documentos Obligatorios
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cargue fotos claras desde su dispositivo celular o tablet. Estas pruebas validan los datos provistos para prevenir el fraude fiscal.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* File 1: DL */}
                  <div className="flex flex-col p-4 border border-slate-200 bg-slate-50/50 rounded-2xl relative shadow-sm hover:border-indigo-300 transition">
                    <span className="text-xs font-black text-slate-900 uppercase">1. Driver's License (Licencia de Conducir) *</span>
                    <span className="text-[10px] text-slate-500 mb-3 font-medium">Foto nítida frontal de la identificación oficial del dueño.</span>
                    
                    {files.docDriversLicense ? (
                      <div className="flex-1 flex flex-col items-center justify-between p-3 bg-white rounded-xl border border-emerald-300">
                        <div className="w-full flex items-center justify-between text-slate-700">
                          <span className="text-xs font-semibold truncate max-w-[200px]">{files.docDriversLicenseName}</span>
                          <button 
                            onClick={() => removeFile('docDriversLicense')} 
                            className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 text-xs font-bold"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <img 
                          src={files.docDriversLicense} 
                          alt="DL Preview" 
                          className="mt-2 h-20 w-auto object-cover rounded shadow"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <label className="flex-1 flex flex-col items-center justify-center p-6 bg-white border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition min-h-[140px]">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-black text-indigo-600">Seleccionar o tomar foto</span>
                        <span className="text-[9px] text-slate-400 mt-1">PNG, JPG hasta 8MB</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileUpload(e, 'docDriversLicense')} 
                        />
                      </label>
                    )}
                  </div>

                  {/* File 2: Voided Check */}
                  <div className="flex flex-col p-4 border border-slate-200 bg-slate-50/50 rounded-2xl relative shadow-sm hover:border-indigo-300 transition">
                    <span className="text-xs font-black text-slate-900 uppercase">2. Cheque Voided (Voided Check) *</span>
                    <span className="text-[10px] text-slate-500 mb-3 font-medium">Cheque en blanco anulado para verificar enrutamiento.</span>
                    
                    {files.docVoidedCheck ? (
                      <div className="flex-1 flex flex-col items-center justify-between p-3 bg-white rounded-xl border border-emerald-300">
                        <div className="w-full flex items-center justify-between text-slate-700">
                          <span className="text-xs font-semibold truncate max-w-[200px]">{files.docVoidedCheckName}</span>
                          <button 
                            onClick={() => removeFile('docVoidedCheck')} 
                            className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 text-xs font-bold"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <img 
                          src={files.docVoidedCheck} 
                          alt="Check Preview" 
                          className="mt-2 h-20 w-auto object-cover rounded shadow"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <label className="flex-1 flex flex-col items-center justify-center p-6 bg-white border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition min-h-[140px]">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-black text-indigo-600">Seleccionar o tomar foto</span>
                        <span className="text-[9px] text-slate-400 mt-1">PNG, JPG hasta 8MB</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileUpload(e, 'docVoidedCheck')} 
                        />
                      </label>
                    )}
                  </div>

                  {/* File 3: Business License */}
                  <div className="flex flex-col p-4 border border-slate-200 bg-slate-50/50 rounded-2xl relative shadow-sm hover:border-indigo-300 transition">
                    <span className="text-xs font-black text-slate-900 uppercase">3. Business License o EIN Letter (Opcional)</span>
                    <span className="text-[10px] text-slate-500 mb-3 font-medium">Permisos de operación o documento oficial del IRS.</span>
                    
                    {files.docBusinessLicense ? (
                      <div className="flex-1 flex flex-col items-center justify-between p-3 bg-white rounded-xl border border-emerald-300">
                        <div className="w-full flex items-center justify-between text-slate-700">
                          <span className="text-xs font-semibold truncate max-w-[200px]">{files.docBusinessLicenseName}</span>
                          <button 
                            onClick={() => removeFile('docBusinessLicense')} 
                            className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 text-xs font-bold"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <img 
                          src={files.docBusinessLicense} 
                          alt="Biz Preview" 
                          className="mt-2 h-20 w-auto object-cover rounded shadow"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <label className="flex-1 flex flex-col items-center justify-center p-6 bg-white border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition min-h-[140px]">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-black text-indigo-600">Seleccionar o tomar foto</span>
                        <span className="text-[9px] text-slate-400 mt-1">PNG, JPG hasta 8MB</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileUpload(e, 'docBusinessLicense')} 
                        />
                      </label>
                    )}
                  </div>

                  {/* File 4: Additional Document 1 */}
                  <div className="flex flex-col p-4 border border-slate-200 bg-slate-50/50 rounded-2xl relative shadow-sm hover:border-indigo-300 transition">
                    <span className="text-xs font-black text-slate-900 uppercase">4. Documento Adicional 1 (Opcional)</span>
                    <span className="text-[10px] text-slate-500 mb-3 font-medium">Contrato de renta, facturas o certificado estatal.</span>
                    
                    {files.docAdditional_1 ? (
                      <div className="flex-1 flex flex-col items-center justify-between p-3 bg-white rounded-xl border border-emerald-300">
                        <div className="w-full flex items-center justify-between text-slate-700">
                          <span className="text-xs font-semibold truncate max-w-[200px]">{files.docAdditional_1Name}</span>
                          <button 
                            onClick={() => removeFile('docAdditional_1')} 
                            className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 text-xs font-bold"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <img 
                          src={files.docAdditional_1} 
                          alt="Additional Preview" 
                          className="mt-2 h-20 w-auto object-cover rounded shadow"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <label className="flex-1 flex flex-col items-center justify-center p-6 bg-white border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition min-h-[140px]">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-black text-indigo-600">Seleccionar o tomar foto</span>
                        <span className="text-[9px] text-slate-400 mt-1">PNG, JPG hasta 8MB</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileUpload(e, 'docAdditional_1')} 
                        />
                      </label>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 5: SUCCESS Confirmation */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-10 space-y-6"
                id="success-onboarding-screen"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                  <Check className="w-12 h-12 stroke-[3]" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">¡Registro Completado con Éxito!</h3>
                  <p className="text-sm text-slate-600 max-w-lg mx-auto">
                    Los datos del dueño y del comercio, junto con los soportes de identificación, han sido transferidos al sistema central y guardados en la base de datos de manera segura.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 max-w-md mx-auto text-left space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold uppercase"> DBA Negocio:</span>
                    <span className="font-extrabold text-slate-800">{formData.busStoreNameDba}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold uppercase">Dueño Registrado:</span>
                    <span className="font-extrabold text-slate-800">{formData.ownerFirstName} {formData.ownerLastName}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-slate-200 pt-2.5">
                    <span className="text-slate-500 font-bold uppercase">Vendedor a Cargo:</span>
                    <span className="font-extrabold text-slate-800">
                      {verifiedSalesman ? `${verifiedSalesman.nombre} ${verifiedSalesman.apellido}` : 'Ventas Externas'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold uppercase">Estado de Solicitud:</span>
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-black rounded text-[9px] uppercase tracking-wider">
                      Pendiente de Aprobación
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    onClick={() => {
                      // Reset Form
                      setFormData({
                        ownerFirstName: '', ownerLastName: '', ownerDob: '', ownerSsn: '',
                        ownerCountry: 'US', ownerHomeAddress: '', ownerApartment: '',
                        ownerCity: '', ownerState: '', ownerZipCode: '', ownerCellPhone: '', ownerEmail: '',
                        busStoreNameDba: '', busLegalName: '', busLegalType: 'LLC',
                        busPhysicalAddress: '', busCity: '', busState: '', busZipCode: '',
                        busPhone: '', busLegalSameAsDbaAddress: true, busTaxId: '', busEstablishedDate: '',
                        bankName: '', bankAccountHolder: '', bankRoutingNumber: '', bankAccountNumber: '',
                        bankIndustryType: 'Retail', bankProjectedMonthlyCreditCardCharges: 'Under $10,000',
                        bankProjectedYearlyStoreSales: 'Under $100,000', notes: ''
                      });
                      setFiles({
                        docDriversLicense: '', docDriversLicenseName: '',
                        docBusinessLicense: '', docBusinessLicenseName: '',
                        docVoidedCheck: '', docVoidedCheckName: '',
                        docAdditional_1: '', docAdditional_1Name: '',
                        docAdditional_2: '', docAdditional_2Name: ''
                      });
                      setStep(1);
                    }}
                    className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Registrar Otra Cuenta
                  </button>

                  {onBackToLanding && (
                    <button
                      onClick={onBackToLanding}
                      className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-lg shadow-indigo-100"
                    >
                      Finalizar y Salir
                    </button>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer actions wizard buttons */}
        {step <= 4 && (
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={step === 1 || loading}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border border-slate-300 rounded-2xl transition bg-white text-slate-700 ${
                step === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-50'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Atrás
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition shadow-md shadow-indigo-100 uppercase tracking-widest"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-7 py-3 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl transition shadow-md shadow-emerald-100 uppercase tracking-widest disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Enviar y Registrar
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
