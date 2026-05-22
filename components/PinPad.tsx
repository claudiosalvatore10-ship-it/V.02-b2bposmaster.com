import React, { useState } from 'react';
import { Salesman } from '../types';
import { User, Delete, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PinPadProps {
  salesmen: Salesman[];
  onLogin: (salesman: Salesman) => void;
}

const PinPad: React.FC<PinPadProps> = ({ salesmen, onLogin }) => {
  const [selectedSalesman, setSelectedSalesman] = useState<Salesman | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  const handleSubmit = () => {
    if (selectedSalesman && (pin === String(selectedSalesman.pin || '') || (selectedSalesman.id === 'admin' && pin === '1111'))) {
      onLogin(selectedSalesman);
    } else {
      setError(true);
      setPin('');
    }
  };

  // Auto submit when 4 digits are entered
  React.useEffect(() => {
    if (pin.length === 4 && selectedSalesman) {
      const timer = setTimeout(() => {
        if (pin === String(selectedSalesman.pin || '') || (selectedSalesman.id === 'admin' && pin === '1111')) {
          onLogin(selectedSalesman);
        } else {
          setError(true);
          setPin('');
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pin, selectedSalesman, onLogin]);

  return (
    <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full flex flex-col md:flex-row gap-8 items-stretch">
        
        {/* Left Side: Salesman Selection */}
        <div className="flex-1 bg-white/10 rounded-3xl p-8 border border-white/10 flex flex-col">
          <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
            <User className="w-8 h-8 text-blue-400" />
            Select User
          </h2>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {salesmen.filter(s => s.activo !== false).map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSalesman(s);
                  setPin('');
                  setError(false);
                }}
                className={`p-4 rounded-2xl transition-all flex flex-col items-center gap-2 border-2 ${
                  selectedSalesman?.id === s.id 
                    ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/20' 
                    : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {(s.nombre?.[0] || '')}{(s.apellido?.[0] || '')}
                </div>
                <span className="text-white font-bold text-sm text-center">
                  {s.nombre || ''} {s.apellido || ''}
                </span>
              </button>
            ))}
            {salesmen.filter(s => s.activo !== false).length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-white/20 mb-4">
                  <User className="w-8 h-8" />
                </div>
                <p className="text-white/50 text-sm mb-6">No users found for this store.</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                >
                  Refresh Data
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Pin Pad */}
        <div className="w-full md:w-[400px] bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center">
          <AnimatePresence mode="wait">
            {!selectedSalesman ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col items-center justify-center text-center"
              >
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                  <User className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-gray-900">Waiting for Selection</h3>
                <p className="text-gray-500 mt-2">Please select a user from the left to continue</p>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full flex flex-col items-center"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-black text-gray-900">Welcome, {selectedSalesman.nombre}</h3>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">Enter your 4-digit PIN</p>
                  {(selectedSalesman.role === 'admin' || selectedSalesman.id === 'super-admin' || selectedSalesman.id.startsWith('ADM-')) && (
                    <p className="text-blue-500 text-xs mt-2 font-bold bg-blue-50 py-1 px-3 rounded-full inline-block">Hint: Default admin PIN is 1111</p>
                  )}
                </div>

                {/* Pin Display */}
                <div className={`flex gap-4 mb-8 ${error ? 'animate-shake' : ''}`}>
                  {[0, 1, 2, 3].map(i => (
                    <div 
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                        pin.length > i 
                          ? 'bg-blue-600 border-blue-600 scale-125' 
                          : error ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  ))}
                </div>

                {error && (
                  <p className="text-red-500 font-bold text-sm mb-4 animate-bounce">Incorrect PIN. Try again.</p>
                )}

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4 w-full">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => handleNumberClick(num.toString())}
                      className="h-16 rounded-2xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-2xl font-black text-gray-800 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={handleClear}
                    className="h-16 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => handleNumberClick('0')}
                    className="h-16 rounded-2xl bg-gray-50 hover:bg-gray-100 text-2xl font-black text-gray-800 transition-all"
                  >
                    0
                  </button>
                  <button
                    onClick={handleDelete}
                    className="h-16 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center transition-all"
                  >
                    <Delete className="w-6 h-6" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}} />
    </div>
  );
};

export default PinPad;
