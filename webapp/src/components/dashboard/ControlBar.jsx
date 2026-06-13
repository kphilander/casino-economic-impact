import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { InputField, SelectField } from '../ui/Field';
import Button from '../ui/Button';

/**
 * Sticky control bar — the high-frequency input levers (state, operation,
 * project, revenue, tax) live here for fast what-ifs. The full input set
 * (department revenue, known data, detailed tax) is one click away in the
 * "More inputs" slide-over. This replaces the separate 5-step wizard: the
 * report canvas is the only surface, inputs and output coexist.
 */
export default function ControlBar({
  stateValue, setState, stateOptions,
  propertyType, setPropertyType, propertyOptions,
  casinoName, setCasinoName,
  revenueLabel, revenueValue, onRevenueChange,
  taxValue, onTaxChange, taxPlaceholder,
  onEditInputs, onDownload, downloadLabel = 'Download Report', downloading,
}) {
  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-hairline no-print">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-end gap-3 flex-wrap">
        <div className="w-36">
          <SelectField label="State" value={stateValue} onChange={setState} options={stateOptions} />
        </div>
        <div className="w-52">
          <SelectField label="Operation" value={propertyType} onChange={setPropertyType} options={propertyOptions} />
        </div>
        <div className="flex-1 min-w-[150px]">
          <InputField label="Project name" value={casinoName} onChange={setCasinoName} type="text" placeholder="Name this analysis" />
        </div>
        <div className="w-32">
          <InputField label={revenueLabel} value={revenueValue} onChange={onRevenueChange} prefix="$" suffix="M" />
        </div>
        <div className="w-28">
          <InputField label="Tax rate" value={taxValue} onChange={onTaxChange} suffix="%" placeholder={taxPlaceholder} />
        </div>
        <div className="flex items-center gap-2 pb-0.5 ml-auto">
          <Button variant="secondary" size="md" icon={SlidersHorizontal} onClick={onEditInputs}>More inputs</Button>
          <Button variant="brass" size="md" onClick={onDownload} loading={downloading}>{downloadLabel}</Button>
        </div>
      </div>
    </div>
  );
}
