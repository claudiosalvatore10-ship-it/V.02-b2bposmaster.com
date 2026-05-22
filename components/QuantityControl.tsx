import React, { useState, useEffect } from 'react';

interface QuantityControlProps {
  quantity: number;
  onChange: (q: number) => void;
}

export const QuantityControl: React.FC<QuantityControlProps> = ({ quantity, onChange }) => {
  const [inputValue, setInputValue] = useState(quantity.toString());

  useEffect(() => {
    // Only update if the parsed value is different to avoid cursor jumping
    if (parseFloat(inputValue) !== quantity) {
      setInputValue(quantity.toString());
    }
  }, [quantity]);

  const handleBlur = () => {
    const val = parseFloat(inputValue);
    if (!isNaN(val)) {
      onChange(Math.max(0, val));
    } else {
      setInputValue(quantity.toString());
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center bg-gray-50 rounded-xl p-0.5 border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all" onClick={e => e.stopPropagation()}>
      <input 
        type="number" 
        step="0.01"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className="w-16 h-8 text-center bg-transparent font-black text-gray-800 text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        onClick={e => e.stopPropagation()}
        placeholder="0"
      />
    </div>
  );
};
