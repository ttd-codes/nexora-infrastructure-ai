import { GitBranch, Layers, ShieldAlert, Upload } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

export function AuthPortal() {
  const { loginWithGoogle, authLoading } = useWorkspace();

  return (
    <div className="min-h-screen bg-[#101418] text-[#F4F5F6] flex flex-col justify-between p-6 md:p-12">
      <header className="flex items-center justify-between gap-8 max-w-6xl w-full mx-auto pb-6 border-b border-white/10">
        <span className="font-display text-lg font-bold tracking-tight text-[#F4F5F6] whitespace-nowrap shrink-0">
          NEXORA
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#9AA5B1]">
          <span className="whitespace-nowrap shrink-0">Infrastructure Memory</span>
          <span className="whitespace-nowrap shrink-0">Recurrence Engine</span>
          <span className="whitespace-nowrap shrink-0">Multimodal Intake</span>
        </nav>
        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={authLoading}
          className="px-4 py-2 text-xs font-semibold bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f6c45f] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          Sign In with Google
        </button>
      </header>

      <main className="max-w-6xl w-full mx-auto py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          <div className="text-xs font-mono text-[#55C6D9]">
            Infrastructure Memory &amp; Intelligence Platform
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold text-[#F4F5F6] tracking-tight leading-[1.12] max-w-2xl">
            Remember Every Failure. Understand Every Pattern. Maintain Before It Matters.
          </h1>
          <p className="text-base text-[#9AA5B1] leading-relaxed max-w-xl">
            NEXORA transforms fragmented maintenance registers, PDF service reports, equipment photos, and technician voice notes into a connected, searchable, evidence-backed asset memory.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={authLoading}
              className="px-6 py-3 text-sm font-semibold bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f6c45f] transition-colors disabled:opacity-50"
            >
              {authLoading ? 'Checking Session...' : 'Launch Campus Workspace'}
            </button>
            <span className="text-xs text-[#9AA5B1]">
              Includes pre-loaded fictional college campus demonstration dataset
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#1B2229] border border-white/10 rounded-lg p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#F4F5F6]">
              Connected Engineering Capabilities
            </h2>
            <div className="divide-y divide-white/10">
              <div className="py-3 flex items-start gap-3">
                <Upload className="w-4 h-4 text-[#F5B942] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-[#F4F5F6]">Multimodal AI Intake</div>
                  <p className="text-xs text-[#9AA5B1] mt-0.5">
                    Extracts structured records from handwritten logbooks, PDFs, photos, and audio memos with human validation.
                  </p>
                </div>
              </div>
              <div className="py-3 flex items-start gap-3">
                <GitBranch className="w-4 h-4 text-[#55C6D9] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-[#F4F5F6]">Infrastructure Memory Graph</div>
                  <p className="text-xs text-[#9AA5B1] mt-0.5">
                    Traces assets, sub-components, incidents, repair outcomes, and source documents interactively.
                  </p>
                </div>
              </div>
              <div className="py-3 flex items-start gap-3">
                <ShieldAlert className="w-4 h-4 text-[#F5B942] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-[#F4F5F6]">Explainable Pattern Detection</div>
                  <p className="text-xs text-[#9AA5B1] mt-0.5">
                    Separates observed facts, interpretations, and missing telemetry—without unsupported predictive claims.
                  </p>
                </div>
              </div>
              <div className="pt-3 flex items-start gap-3">
                <Layers className="w-4 h-4 text-[#3DD68C] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-[#F4F5F6]">Enterprise Asset &amp; Report Suite</div>
                  <p className="text-xs text-[#9AA5B1] mt-0.5">
                    Full asset lifecycle tracking, timelines, configurable detection rules, and CSV/PDF reporting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#9AA5B1]">
        <span>NEXORA Infrastructure Memory &amp; Intelligence Platform</span>
        <span>Protected workspace powered by verified Google Authentication</span>
      </footer>
    </div>
  );
}
