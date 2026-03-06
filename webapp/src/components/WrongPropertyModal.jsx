import React from 'react';
import { X, AlertTriangle, Building2, ShoppingCart, Key } from 'lucide-react';

/**
 * Modal shown when user tries to download PPTX for a property
 * that doesn't match their licensed property.
 */
function WrongPropertyModal({
  isOpen,
  onClose,
  licensedFor,
  attempting,
  onSwitchProperty,
  onAddProperty,
  onEnterNewKey
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
            <h2 className="text-xl font-bold text-gray-900">License Mismatch</h2>
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
            Your license is tied to a different property than the one you're trying to download.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-[#ebf8ff] rounded">
                <Building2 className="w-4 h-4 text-[#3182ce]" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Licensed For</p>
                <p className="font-semibold text-gray-900">{licensedFor || 'Unknown'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-red-100 rounded">
                <Building2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Attempting to Download</p>
                <p className="font-semibold text-gray-900">{attempting || 'Unknown'}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Each license is valid for one property name. Choose an option below to continue.
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          {/* Switch to licensed property */}
          <button
            onClick={onSwitchProperty}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#3182ce] hover:bg-[#2c5282] text-white rounded-xl font-semibold transition-colors"
          >
            <Building2 className="w-5 h-5" />
            Switch to "{licensedFor}"
          </button>

          {/* Add this property (paid) */}
          <button
            onClick={onAddProperty}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#1a365d] to-[#3182ce] hover:from-[#152a4d] hover:to-[#2c5282] text-white rounded-xl font-semibold transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            Add "{attempting}" ($295)
          </button>

          {/* Enter different license key */}
          <button
            onClick={onEnterNewKey}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors"
          >
            <Key className="w-5 h-5" />
            Enter a Different License Key
          </button>
        </div>
      </div>
    </div>
  );
}

export default WrongPropertyModal;
