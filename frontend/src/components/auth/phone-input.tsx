'use client';

import { useId } from 'react';
import { REGIONS, type RegionInfo } from '@/lib/client/regions';
import { AFRICAN_COUNTRY_ORDER, type AfricanCountryCode } from '@/lib/geo-africa';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/cn';

const REGION_ORDER = AFRICAN_COUNTRY_ORDER;

/**
 * Phone is the identity across the African markets, so this is the most-used input on the
 * site. The region picker only supplies the default country code — a buyer who types `+254`
 * wins. Local format is 7xxxxxxxx; a leading 0 is stripped server-side.
 */
export function PhoneInput({
  value,
  onChange,
  region,
  onRegionChange,
  label = 'Phone number',
  error,
  autoComplete = 'tel',
  disabled,
  required = true,
}: {
  value: string;
  onChange: (next: string) => void;
  region: AfricanCountryCode;
  onRegionChange: (next: AfricanCountryCode) => void;
  label?: string;
  error?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const id = useId();
  const selected: RegionInfo = REGIONS[region];

  return (
    <Field label={label} htmlFor={id} error={error} hint={`Format: ${selected.phoneHint}`} required={required}>
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
        <select
          aria-label="Country"
          value={region}
          disabled={disabled}
          onChange={(event) => onRegionChange(event.target.value as AfricanCountryCode)}
          className="h-[46px] min-w-0 w-full rounded-xl border border-ink-200 bg-white px-2 text-sm"
        >
          {REGION_ORDER.map((code) => (
            <option key={code} value={code}>
              {REGIONS[code].name} +{REGIONS[code].dialCode}
            </option>
          ))}
        </select>
        <input
          id={id}
          name="phone"
          value={value}
          disabled={disabled}
          required={required}
          inputMode="tel"
          autoComplete={autoComplete}
          placeholder={selected.examplePhone}
          onChange={(event) => onChange(event.target.value)}
          className={cn('field-input', error && 'border-clay-400')}
        />
      </div>
    </Field>
  );
}
