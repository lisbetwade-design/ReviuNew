import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface TrackingScriptModalProps {
  onClose: () => void;
}

export function TrackingScriptModal({ onClose }: TrackingScriptModalProps) {
  const [copied, setCopied] = useState(false);

  const trackingScript = `<!-- Add this script to your prototype/website to enable automatic page tracking -->
<script>
(function() {
  // Track page changes and send to parent window
  function notifyPageChange() {
    const currentUrl = window.location.pathname + window.location.hash + window.location.search;
    window.parent.postMessage({
      type: 'reviuPageChange',
      url: currentUrl
    }, '*');
  }

  // Send initial page
  notifyPageChange();

  // Track navigation for Single Page Apps
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      notifyPageChange();
    }
  }).observe(document, { subtree: true, childList: true });

  // Track hash changes
  window.addEventListener('hashchange', notifyPageChange);

  // Track popstate (back/forward navigation)
  window.addEventListener('popstate', notifyPageChange);
})();
</script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(trackingScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Automatic Page Tracking</h2>
            <p className="text-sm text-gray-600 mt-1">Enable automatic page detection for cross-origin content</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">How It Works</h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>Reviu automatically detects page changes in two ways:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Same-origin content:</strong> Automatically tracked (no setup needed)</li>
                <li><strong>Cross-origin content:</strong> Add this script to your prototype for automatic tracking</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Integration Script</h3>
            <p className="text-sm text-gray-600 mb-3">
              Add this script to your prototype's HTML (before the closing <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag):
            </p>

            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                <code>{trackingScript}</code>
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Supported Frameworks</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>This script works with:</p>
              <ul className="list-disc list-inside ml-2">
                <li>Static HTML websites</li>
                <li>React, Vue, Angular (SPAs)</li>
                <li>Next.js, Nuxt.js</li>
                <li>Any website with client-side routing</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Note</h3>
            <p className="text-sm text-blue-800">
              If you can't add scripts to your prototype (e.g., Figma embeds, restricted platforms),
              comments will be associated with the entire design rather than specific pages.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-[#2563EB] text-white rounded-lg font-medium hover:bg-[#1d4ed8] transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
