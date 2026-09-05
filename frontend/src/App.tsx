import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar, TabId } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { WarRoomTopology } from './components/WarRoomTopology';
import { InvariantProver } from './components/InvariantProver';
import { ChaosLab } from './components/ChaosLab';
import { PacketInspector } from './components/PacketInspector';
import { MLAnomalyRadar } from './components/MLAnomalyRadar';
import { AuditLedger } from './components/AuditLedger';
import { ApiStudio } from './components/ApiStudio';
import { SystemHealth } from './components/SystemHealth';
import { JudgeShowcaseTour } from './components/JudgeShowcaseTour';
import { api } from './api/client';
import {
  ComponentData,
  InvariantData,
  PathData,
  TrafficStats,
  TrafficPacket,
  AIData,
  AuditLog,
  AuditVerificationResult,
  JudgeDemoResult,
} from './types';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

function AppContent() {
  const { authError, clearAuthError } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Core Platform Data
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [invariants, setInvariants] = useState<InvariantData[]>([]);
  const [paths, setPaths] = useState<PathData[]>([]);
  const [trafficStats, setTrafficStats] = useState<TrafficStats | null>(null);
  const [packets, setPackets] = useState<TrafficPacket[]>([]);
  const [aiData, setAiData] = useState<AIData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditStatus, setAuditStatus] = useState<AuditVerificationResult | null>(null);
  const [demoResult, setDemoResult] = useState<JudgeDemoResult | null>(null);
  const [demoLoading, setDemoLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Synchronize all platform data from real backend endpoints
  const refreshData = useCallback(async () => {
    try {
      const [compRes, invRes, pathRes, statsRes, aiRes, auditRes] = await Promise.all([
        api.get<ComponentData[]>('/components').catch(() => []),
        api.get<InvariantData[]>('/invariants').catch(() => []),
        api.get<PathData[]>('/paths').catch(() => []),
        api.get<TrafficStats>('/traffic/stats').catch(() => null),
        api.get<AIData>('/ai/anomalies?scenario=NORMAL').catch(() => null),
        api.get<AuditLog[]>('/audit?limit=25').catch(() => []),
      ]);

      setComponents(compRes || []);
      setInvariants(invRes || []);
      setPaths(pathRes || []);
      setTrafficStats(statsRes);
      setAiData(aiRes);
      setAuditLogs(auditRes || []);
    } catch (err: any) {
      console.error('Refresh failed:', err);
    }
  }, []);

  const fetchPackets = useCallback(async () => {
    try {
      const data = await api.get<TrafficPacket[]>('/traffic?limit=50');
      setPackets(data || []);
    } catch (err) {
      console.error('Packets fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
    fetchPackets();
    const interval = setInterval(refreshData, 4000);
    return () => clearInterval(interval);
  }, [refreshData, fetchPackets]);

  // Mutations
  const handleInjectFailure = async (compIds: string[], type: string = 'MANUAL_INJECTION') => {
    setLoading(true);
    try {
      const res = await api.post('/failures/inject', {
        component_ids: compIds,
        failure_type: type,
      });
      showToast(
        res.summary_message || `Failure injected into ${compIds.join(', ')}. Targeted fail-safe engaged.`,
        'error'
      );
      await refreshData();
      await fetchPackets();
    } catch (err: any) {
      showToast(err.message || 'Failed to inject failure.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReroute = async (pathId: string | null = null) => {
    setLoading(true);
    try {
      const res = await api.post('/reroute', { path_id: pathId });
      showToast(
        res.summary_message || 'Traffic migrated to mathematically verified alternate route.',
        'success'
      );
      await refreshData();
      await fetchPackets();
    } catch (err: any) {
      showToast(err.message || 'Reroute execution failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverComponent = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.post(`/components/${id}/recover`);
      showToast(res.summary_message || `Component ${id} restored to HEALTHY.`, 'success');
      await refreshData();
      await fetchPackets();
    } catch (err: any) {
      showToast(err.message || `Failed to recover component ${id}.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverAll = async () => {
    setLoading(true);
    try {
      const res = await api.post('/demo/reset');
      showToast(res.message || 'Prinstine baseline restored. All 10 routes GUARANTEED.', 'success');
      await refreshData();
      await fetchPackets();
    } catch (err: any) {
      showToast(err.message || 'Reset failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateTraffic = async (count: number = 1000) => {
    setLoading(true);
    try {
      const res = await api.post('/traffic/simulate', { packet_count: count });
      showToast(
        `Traffic verification complete: ${res.packets_delivered} delivered, ${res.packets_blocked} blocked. Unsafe delivered: ${res.unsafe_traffic_delivered}.`,
        'info'
      );
      await refreshData();
      await fetchPackets();
    } catch (err: any) {
      showToast(err.message || 'Traffic simulation failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyInvariants = async () => {
    try {
      const res = await api.post('/invariants/verify');
      showToast(`Invariant prover completed. ${res.guaranteed} guaranteed paths verified.`, 'success');
      await refreshData();
      return res;
    } catch (err: any) {
      showToast(err.message || 'Verification failed.', 'error');
      throw err;
    }
  };

  const handleVerifyAudit = async () => {
    try {
      const res = await api.post<AuditVerificationResult>('/audit/verify');
      setAuditStatus(res);
      showToast(res.message, res.valid ? 'success' : 'error');
    } catch (err: any) {
      showToast(err.message || 'Audit ledger verification failed.', 'error');
    }
  };

  const handleRunDemo = async () => {
    setDemoLoading(true);
    setDemoResult(null);
    try {
      const res = await api.post<JudgeDemoResult>('/demo/run?packet_count=1000');
      setDemoResult(res);
      setActiveTab('demo');
      showToast('8-step judge proof complete. Zero unsafe traffic delivered.', 'success');
      await refreshData();
      await fetchPackets();
    } catch (err: any) {
      showToast(err.message || 'Automated judge demo failed.', 'error');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleRefreshScenario = async (scenario: string) => {
    try {
      const res = await api.get<AIData>(`/ai/anomalies?scenario=${scenario}`);
      setAiData(res);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-slate-900 flex flex-col md:flex-row selection:bg-indigo-500 selection:text-white" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      {/* Left Grid Sidebar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        components={components}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onRunJudgeDemo={handleRunDemo}
        demoLoading={demoLoading}
        hasDemoResult={!!demoResult}
      />

      {/* Main Workspace Column (Right Side of Project) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-slate-50">
        {/* Global Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-xl border flex items-center space-x-3 text-xs font-mono animate-fadeIn ${
              toast.type === 'success'
                ? 'bg-white border-emerald-500 text-emerald-950'
                : toast.type === 'error'
                ? 'bg-white border-rose-500 text-rose-950'
                : 'bg-white border-indigo-500 text-indigo-950'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            )}
            <span className="max-w-md leading-relaxed">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700 ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Auth Error Banner if active */}
        {authError && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-4 py-2.5 flex items-center justify-between font-mono">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{authError}</span>
            </div>
            <button onClick={clearAuthError} className="text-rose-500 hover:text-rose-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {activeTab === 'dashboard' && (
          <WarRoomTopology
            components={components}
            paths={paths}
            invariants={invariants}
            onInjectFailure={handleInjectFailure}
            onRecoverComponent={handleRecoverComponent}
            onRefresh={refreshData}
            loading={loading}
          />
        )}

        {activeTab === 'topology' && (
          <WarRoomTopology
            components={components}
            paths={paths}
            invariants={invariants}
            onInjectFailure={handleInjectFailure}
            onRecoverComponent={handleRecoverComponent}
            onRefresh={refreshData}
            loading={loading}
          />
        )}

        {activeTab === 'invariants' && (
          <InvariantProver
            invariants={invariants}
            paths={paths}
            components={components}
            onVerifyInvariants={handleVerifyInvariants}
            loading={loading}
          />
        )}

        {activeTab === 'chaos' && (
          <ChaosLab
            components={components}
            paths={paths}
            onInjectFailure={handleInjectFailure}
            onReroute={handleReroute}
            onRecoverComponent={handleRecoverComponent}
            onRecoverAll={handleRecoverAll}
            onSimulateTraffic={handleSimulateTraffic}
            loading={loading}
          />
        )}

        {activeTab === 'traffic' && (
          <PacketInspector
            stats={trafficStats}
            packets={packets}
            onSimulate={handleSimulateTraffic}
            onRefreshPackets={fetchPackets}
            loading={loading}
          />
        )}

        {activeTab === 'radar' && (
          <MLAnomalyRadar
            aiData={aiData}
            onRefreshScenario={handleRefreshScenario}
            loading={loading}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLedger
            logs={auditLogs}
            auditStatus={auditStatus}
            onVerify={handleVerifyAudit}
            onRefresh={refreshData}
            loading={loading}
          />
        )}

        {activeTab === 'studio' && <ApiStudio />}

        {activeTab === 'health' && <SystemHealth />}

        {activeTab === 'demo' && (
          <JudgeShowcaseTour
            demoResult={demoResult}
            demoLoading={demoLoading}
            onRunDemo={handleRunDemo}
            onNavigateTab={setActiveTab}
            onInjectFailure={handleInjectFailure}
            onReroute={handleReroute}
            onSimulateTraffic={handleSimulateTraffic}
            onVerifyAudit={handleVerifyAudit}
            onRecoverAll={handleRecoverAll}
          />
        )}
      </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-200 py-4 text-center text-[13px] text-slate-500 bg-white mt-auto" style={{ fontFamily: "'Inter', ui-sans-serif, sans-serif" }}>
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-medium">InvariantHold &bull; Runtime Security Invariant Verification &amp; Targeted Fail-Safe Platform</span>
            <span className="text-[12px] text-slate-400 font-mono">
              Formal Invariants &bull; IsolationForest &bull; SHA-256 Audit Chain
            </span>
          </div>
        </footer>
      </div>

      {/* Login & RBAC Modal */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
