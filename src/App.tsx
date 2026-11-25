import { AnimatePresence, motion } from 'motion/react';
import { AppShell } from './components/AppShell';
import { AuthPortal } from './components/AuthPortal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { AssetIntelligence } from './modules/AssetIntelligence';
import { CommandCenter } from './modules/CommandCenter';
import { DataIntake } from './modules/DataIntake';
import { InvestigationCenter } from './modules/InvestigationCenter';
import { MaintenanceManagement } from './modules/MaintenanceManagement';
import { MemoryGraph } from './modules/MemoryGraph';
import { ReportsAnalytics } from './modules/ReportsAnalytics';

function WorkspaceRouter() {
  const { user, authLoading, activeModule } = useWorkspace();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#101418] text-[#F4F5F6] flex items-center justify-center">
        <div className="text-xs font-mono text-[#9AA5B1]">Initializing NEXORA workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPortal />;
  }

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeModule}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeModule === 'command-center' && <CommandCenter />}
          {activeModule === 'assets' && <AssetIntelligence />}
          {activeModule === 'memory-graph' && <MemoryGraph />}
          {activeModule === 'investigation-center' && <InvestigationCenter />}
          {activeModule === 'data-intake' && <DataIntake />}
          {activeModule === 'maintenance' && <MaintenanceManagement />}
          {activeModule === 'reports' && <ReportsAnalytics />}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <WorkspaceRouter />
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
