import React from 'react';
import { Input } from './ui/input';

export const CurrencyInput = ({ value, onChange, ...props }) => {
  const display = value ? new Intl.NumberFormat('id-ID').format(value) : '';
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, '');
        onChange(parseInt(raw) || 0);
      }}
    />
  );
};
