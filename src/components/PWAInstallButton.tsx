import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#284742] hover:bg-[#1e3632] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Install Bairum Group App"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[#284742] text-xs font-bold shadow-2xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Add Bairum Group App to Home Screen"
        >
          <Share className="w-3.5 h-3.5 shrink-0" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="/apple-touch-icon.png"
                    alt="Bairum Group"
                    className="w-10 h-10 rounded-xl border border-slate-200 shrink-0 object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-slate-900 truncate">
                      Install Bairum Group
                    </h3>
                    <p className="text-xs text-slate-500">Add to iPhone / iPad Home Screen</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ol className="space-y-2 text-xs text-slate-700 leading-relaxed bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70">
                <li>
                  1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                </li>
                <li>
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li className="text-slate-500 pt-1 border-t border-slate-200/70">
                  Note: If you already have an older iPhone shortcut, remove it and re-add once to display the new Bairum Group icon.
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full min-h-[44px] rounded-xl bg-[#284742] hover:bg-[#1e3632] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
