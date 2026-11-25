import { useEffect, useState } from 'react';
import { Server, X } from 'lucide-react';

interface ApiDocsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ApiDocsModal({ open, onClose }: ApiDocsModalProps) {
  const [docs, setDocs] = useState<{
    info?: { title: string; version: string; description: string };
    paths?: Record<string, Record<string, { summary: string }>>;
  } | null>(null);
  const [health, setHealth] = useState<{ status: string; timestamp: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const safeJson = async (url: string) => {
      const res = await fetch(url);
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok || !ct.includes('application/json')) return null;
      return res.json();
    };
    safeJson('/api/docs').then(setDocs).catch(() => null);
    safeJson('/api/health').then(setHealth).catch(() => null);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="API Reference"
    >
      <div className="w-full max-w-2xl bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-[#55C6D9]" />
            <h3 className="text-base font-semibold text-[#F4F5F6]">
              REST API Specification
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9AA5B1] hover:text-[#F4F5F6] p-1"
            aria-label="Close API reference"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {docs?.info && (
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[#F4F5F6]">{docs.info.title}</div>
              <p className="text-xs text-[#9AA5B1]">{docs.info.description}</p>
            </div>
          )}

          {health && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#101418] border border-white/10 rounded text-xs">
              <span className="text-[#9AA5B1]">Backend Endpoint Status</span>
              <span className="font-mono text-[#3DD68C] tabular-nums">
                {health.status.toUpperCase()} · {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-[#9AA5B1]">Registered Endpoints</div>
            <div className="divide-y divide-white/10 border border-white/10 rounded bg-[#101418]">
              {docs?.paths &&
                Object.entries(docs.paths).map(([path, methods]) =>
                  Object.entries(methods).map(([method, meta]) => (
                    <div key={`${method}_${path}`} className="px-4 py-3 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-semibold text-[#F5B942] uppercase">
                            {method}
                          </span>
                          <span className="font-mono text-xs text-[#F4F5F6]">{path}</span>
                        </div>
                        <p className="text-xs text-[#9AA5B1]">{meta.summary}</p>
                      </div>
                    </div>
                  ))
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
