import React from 'react';
import { X, AlertTriangle, Building2, Check } from 'lucide-react';

/**
 * Modal to confirm property name before tying license to it.
 * Shown on first download after activating a license.
 */
function ConfirmPropertyModal({
  isOpen,
  onClose,
  propertyName,
  onConfirm
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Confirm Property Name</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-600">
            Your license will be permanently tied to this property name. Please confirm this is correct:
          </p>

          <div className="bg-[#ebf8ff] rounded-xl p-4 flex items-start gap-3">
            <div className="p-1.5 bg-[#bee3f8] rounded">
              <Building2 className="w-5 h-5 text-[#3182ce]" />
            </div>
            <div>
              <p className="text-xs text-[#3182ce] uppercase tracking-wide">Property Name</p>
              <p className="font-bold text-[#1a365d] text-lg">{propertyName}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> Once confirmed, this license can only be used for "{propertyName}".
              You cannot change the property name later without purchasing an additional license.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors"
          >
            <Check className="w-5 h-5" />
            Yes, this is correct - Download Report
          </button>

          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors"
          >
            Cancel - I need to change the name
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmPropertyModal;
