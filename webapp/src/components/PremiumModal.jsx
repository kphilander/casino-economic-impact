/**
 * Premium Modal Component
 *
 * Modal for upgrading to Pro tier with options to:
 * 1. Purchase via Stripe Checkout
 * 2. Enter an existing license key
 */

import React, { useState } from 'react';
import { X, CreditCard, Key, Check, AlertCircle, Loader2, Sparkles, Building2 } from 'lucide-react';
import { validateLicense, isValidFormat } from '../utils/licenseValidator';

export default function PremiumModal({
  isOpen,
  onClose,
  onUpgrade,
  onPurchase,
  isPurchasing = false,
  propertyName = ''
}) {
  const [activeTab, setActiveTab] = useState('purchase'); // 'purchase' | 'license'
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const handleValidateLicense = async () => {
    setError('');
    setIsValidating(true);

    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));

    const result = validateLicense(licenseKey);

    if (result.valid) {
      // Save to localStorage and upgrade
      localStorage.setItem('licenseKey', licenseKey.trim().toUpperCase());
      onUpgrade(licenseKey.trim().toUpperCase());
      onClose();
    } else {
      setError(result.error || 'Invalid license key');
    }

    setIsValidating(false);
  };

  const handlePurchase = () => {
    if (onPurchase) {
      onPurchase();
    }
  };

  const features = [
    'Download professional PPTX reports',
    'Remove evaluation watermarks',
    'Commercial use license',
    'Priority support'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a365d] to-[#3182ce] p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>

          <div className="flex items-center gap-3 text-white">
            <Sparkles size={32} />
            <div>
              <h2 className="text-2xl font-bold">Upgrade to Pro</h2>
              <p className="text-white/90 text-sm">Unlock all features</p>
            </div>
          </div>
        </div>

        {/* Property Name Confirmation Notice */}
        {propertyName && (
          <div className="px-6 pt-4 pb-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">Please confirm your property name:</p>
                <p className="text-amber-800 font-bold text-lg mt-1">{propertyName}</p>
                <p className="text-xs text-amber-700 mt-2">
                  Your license will be permanently tied to this property name.
                  Make sure it's correct before purchasing or activating.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Pro Features
          </h3>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-gray-700">
                <Check size={18} className="text-emerald-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('purchase')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'purchase'
                ? 'text-[#3182ce] border-b-2 border-[#3182ce]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard size={16} className="inline mr-2" />
            Purchase
          </button>
          <button
            onClick={() => setActiveTab('license')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'license'
                ? 'text-[#3182ce] border-b-2 border-[#3182ce]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Key size={16} className="inline mr-2" />
            Enter License Key
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'purchase' ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">$1,495</div>
                <div className="text-gray-500">First property license • 1 year</div>
                <div className="text-sm text-gray-400 mt-1">Additional properties: $295 each</div>
              </div>

              <button
                onClick={handlePurchase}
                disabled={isPurchasing}
                className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  isPurchasing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#1a365d] to-[#3182ce] hover:from-[#152a4d] hover:to-[#2c5282] shadow-lg hover:shadow-xl'
                } text-white`}
              >
                {isPurchasing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Redirecting to checkout...
                  </>
                ) : (
                  <>
                    <CreditCard size={20} />
                    Purchase with Stripe
                  </>
                )}
              </button>

              <p className="text-xs text-center text-gray-500">
                Secure payment powered by Stripe. You'll receive your license key instantly after purchase.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="license-key" className="block text-sm font-medium text-gray-700 mb-1">
                  License Key
                </label>
                <input
                  id="license-key"
                  type="text"
                  value={licenseKey}
                  onChange={(e) => {
                    setLicenseKey(e.target.value);
                    setError('');
                  }}
                  placeholder="PRO-XXXXXXXX-XXXXX"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#3182ce] focus:border-transparent transition-all font-mono ${
                    error ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleValidateLicense}
                disabled={isValidating || !isValidFormat(licenseKey)}
                className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  isValidating || !isValidFormat(licenseKey)
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg hover:shadow-xl text-white'
                }`}
              >
                {isValidating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Key size={20} />
                    Activate License
                  </>
                )}
              </button>

              <p className="text-xs text-center text-gray-500">
                Enter the license key you received after purchase.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
