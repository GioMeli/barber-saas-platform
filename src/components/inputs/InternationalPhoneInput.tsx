import React from 'react';
import { Input } from '@/components/ui/input';
import { DIAL_OPTIONS, countryFlag, isLikelyE164, normalizeE164, resolveDefaultDial, splitInternationalPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string | null;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
  autoComplete?: string;
  showValidation?: boolean;
};

export function InternationalPhoneInput({
  value,
  onChange,
  defaultCountry,
  placeholder = '99 123456',
  disabled,
  required,
  className,
  id,
  name,
  autoComplete = 'tel',
  showValidation = true,
}: Props) {
  const fallbackDial = React.useMemo(() => {
    const browserRegion = typeof navigator !== 'undefined' ? navigator.language.split('-')[1] : undefined;
    return resolveDefaultDial(defaultCountry || browserRegion);
  }, [defaultCountry]);
  const split = React.useMemo(() => splitInternationalPhone(value, fallbackDial), [value, fallbackDial]);
  const [dial, setDial] = React.useState(split.dial);
  const [customDial, setCustomDial] = React.useState(split.dial === 'custom' ? split.customDial || '+' : '+');
  const [national, setNational] = React.useState(split.national);

  React.useEffect(() => {
    const next = splitInternationalPhone(value, fallbackDial);
    setDial(next.dial);
    setNational(next.national);
    if (next.dial === 'custom') setCustomDial(next.customDial || '+');
  }, [value, fallbackDial]);

  const emit = (nextDial: string, nextNational: string, nextCustom = customDial) => {
    const prefix = nextDial === 'custom' ? normalizeE164(nextCustom) : nextDial;
    const cleanPrefix = prefix === '+' ? '+' : normalizeE164(prefix);
    const cleanNational = nextNational.replace(/\D/g, '');
    onChange(cleanNational ? `${cleanPrefix}${cleanNational}` : '');
  };

  const invalid = Boolean(value) && !isLikelyE164(value);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="grid grid-cols-[minmax(112px,0.42fr)_minmax(0,1fr)] gap-2">
        <select
          aria-label="Country calling code"
          className="h-11 min-w-0 rounded-xl border border-input bg-background px-2.5 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
          value={dial}
          disabled={disabled}
          onChange={(event) => {
            const nextDial = event.target.value;
            setDial(nextDial);
            emit(nextDial, national);
          }}
        >
          {DIAL_OPTIONS.map((option) => (
            <option key={`${option.iso}-${option.dial}`} value={option.dial}>
              {countryFlag(option.iso)} {option.dial}
            </option>
          ))}
          <option value="custom">🌐 Other</option>
        </select>
        <Input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          className="h-11 rounded-xl"
          placeholder={placeholder}
          value={national}
          onChange={(event) => {
            const nextNational = event.target.value.replace(/[^\d\s().-]/g, '');
            setNational(nextNational);
            emit(dial, nextNational);
          }}
        />
      </div>
      {dial === 'custom' && (
        <Input
          aria-label="Custom international calling code"
          className="h-9 rounded-xl"
          placeholder="+999"
          value={customDial}
          disabled={disabled}
          onChange={(event) => {
            const next = `+${event.target.value.replace(/\D/g, '').slice(0, 4)}`;
            setCustomDial(next);
            emit('custom', national, next);
          }}
        />
      )}
      {showValidation && invalid && (
        <p className="text-xs font-medium text-destructive">Use an international number including country code (E.164), for example +35799123456.</p>
      )}
    </div>
  );
}

export default InternationalPhoneInput;
