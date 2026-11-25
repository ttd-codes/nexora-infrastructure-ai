import React, { useEffect, useState } from 'react';
import {
  Bell,
  Box,
  FileBarChart2,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { markNotificationRead } from '../services/firestoreService';
import { ActiveModule } from '../types/nexora';
import { ApiDocsModal } from './ApiDocsModal';
import { CommandPalette } from './CommandPalette';

const NAV_ITEMS: Array<{ id: ActiveModule; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'command-center', label: 'Command Center', icon: LayoutDashboard },
  { id: 'assets', label: 'Asset Intelligence', icon: Box },
  { id: 'memory-graph', label: 'Memory Graph', icon: GitBranch },
  { id: 'investigation-center', label: 'Investigation Center', icon: ShieldAlert },
  { id: 'data-intake', label: 'Smart Data Intake', icon: Upload },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'reports', label: 'Reports & Analytics', icon: FileBarChart2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    profile,
    activeModule,
    setActiveModule,
    setSelectedAssetId,
    notifications,
    reseedDemoWorkspace,
    seeding,
    logout,
    openAssetDetail,
    openInvestigation,
    toasts,
    dismissToast,
  } = useWorkspace();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [apiDocsOpen, setApiDocsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentTitle = NAV_ITEMS.find((i) => i.id === activeModule)?.label || 'Command Center';

  const handleNavClick = (id: ActiveModule) => {
    if (id !== 'assets') setSelectedAssetId(null);
    setActiveModule(id);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#101418] text-[#F4F5F6] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#1B2229] border-r border-white/10 shrink-0">
        <div className="h-14 px-5 flex items-center border-b border-white/10">
          <button
            type="button"
            onClick={() => handleNavClick('command-center')}
            className="font-display text-base font-bold tracking-tight text-[#F4F5F6] whitespace-nowrap"
          >
            NEXORA
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#242C34] text-[#F4F5F6] font-medium'
                    : 'text-[#9AA5B1] hover:text-[#F4F5F6] hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#F5B942]' : ''}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={() => setApiDocsOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#9AA5B1] hover:text-[#F4F5F6] rounded-md hover:bg-white/[0.03] transition-colors whitespace-nowrap"
          >
            <Server className="w-3.5 h-3.5 text-[#55C6D9] shrink-0" />
            <span>REST API Reference</span>
          </button>
          <button
            type="button"
            onClick={reseedDemoWorkspace}
            disabled={seeding}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#9AA5B1] hover:text-[#F4F5F6] rounded-md hover:bg-white/[0.03] transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${seeding ? 'animate-spin' : ''}`} />
            <span>{seeding ? 'Seeding Campus...' : 'Restore Sample Data'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] bg-[#1B2229] border-r border-white/10 flex flex-col z-10">
            <div className="h-14 px-5 flex items-center justify-between border-b border-white/10">
              <span className="font-display text-base font-bold text-[#F4F5F6]">NEXORA</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="text-[#9AA5B1] p-1"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md whitespace-nowrap ${
                      active ? 'bg-[#242C34] text-[#F4F5F6] font-medium' : 'text-[#9AA5B1]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#F5B942]' : ''}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 px-4 md:px-6 bg-[#1B2229] border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 text-[#9AA5B1] hover:text-[#F4F5F6]"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[#9AA5B1] truncate">
              <span className="hidden sm:inline">Campus Workspace</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="text-sm font-medium text-[#F4F5F6] truncate">{currentTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-[#9AA5B1] hover:text-[#F4F5F6] bg-[#101418] border border-white/10 rounded-md transition-colors whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden md:inline font-mono text-[10px] text-[#9AA5B1]">Ctrl+K</kbd>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 text-[#9AA5B1] hover:text-[#F4F5F6] bg-[#101418] border border-white/10 rounded-md transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#F5B942] text-[#101418] font-mono text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#1B2229] border border-white/10 rounded-lg z-40 overflow-hidden shadow-xl">
                  <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#F4F5F6]">Alerts &amp; Memory Updates</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-[#9AA5B1] hover:text-[#F4F5F6]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/10">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-xs text-[#9AA5B1] text-center">No notifications.</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 space-y-1.5 text-xs ${n.read ? 'opacity-65' : 'bg-[#242C34]/50'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-[#F4F5F6]">{n.title}</span>
                            {!n.read && (
                              <button
                                type="button"
                                onClick={() => markNotificationRead(n.id)}
                                className="text-[11px] text-[#55C6D9] hover:underline shrink-0"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                          <p className="text-[#9AA5B1] leading-relaxed">{n.message}</p>
                          {(n.recommendationId || n.assetId) && (
                            <button
                              type="button"
                              onClick={() => {
                                markNotificationRead(n.id);
                                setNotifOpen(false);
                                if (n.recommendationId) openInvestigation(n.recommendationId);
                                else if (n.assetId) openAssetDetail(n.assetId);
                              }}
                              className="text-[11px] text-[#F5B942] hover:underline"
                            >
                              Inspect Details →
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User & Sign Out */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="hidden md:block text-right">
                <div className="text-xs font-medium text-[#F4F5F6] leading-none">
                  {profile?.displayName || 'Engineer'}
                </div>
                <div className="text-[11px] text-[#9AA5B1] capitalize mt-0.5">
                  {profile?.role || 'engineer'}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="p-2 text-[#9AA5B1] hover:text-[#F4F5F6] bg-[#101418] border border-white/10 rounded-md transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 p-4 md:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4 sm:px-0">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`bg-[#242C34] border rounded-md p-3.5 flex items-start justify-between gap-3 shadow-lg ${
                t.tone === 'error'
                  ? 'border-[#E05252]/60'
                  : t.tone === 'warning'
                  ? 'border-[#F5B942]/60'
                  : t.tone === 'success'
                  ? 'border-[#3DD68C]/60'
                  : 'border-[#55C6D9]/60'
              }`}
            >
              <div className="space-y-0.5 text-xs">
                <div className="font-semibold text-[#F4F5F6]">{t.title}</div>
                {t.detail && <div className="text-[#9AA5B1]">{t.detail}</div>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-[#9AA5B1] hover:text-[#F4F5F6]"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <ApiDocsModal open={apiDocsOpen} onClose={() => setApiDocsOpen(false)} />
    </div>
  );
}
