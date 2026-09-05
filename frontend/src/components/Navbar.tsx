import React from 'react';
import {
  ShieldCheck,
  Activity,
  BrainCircuit,
  FileCheck2,
  Award,
  Play,
  Network,
  Terminal,
  Server,
  ZapOff,
  UserCheck,
  LogIn,
  LogOut,
  Shield,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ComponentData } from '../types';

export type TabId =
  | 'dashboard'
  | 'topology'
  | 'invariants'
  | 'chaos'
  | 'traffic'
  | 'radar'
  | 'audit'
  | 'studio'
  | 'health'
  | 'demo';

interface NavbarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  components: ComponentData[];
  onOpenLogin: () => void;
  onRunJudgeDemo: () => void;
  demoLoading: boolean;
  hasDemoResult: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  components,
  onOpenLogin,
  onRunJudgeDemo,
  demoLoading,
  hasDemoResult,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const failedComps = components.filter((c) => c.status !== 'HEALTHY');
  const isHealthy = failedComps.length === 0;

  const tabs: { id: TabId; label: string; description: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: 'War Room Topology',
      description: 'Component grid & paths',
      icon: <Activity className="w-4 h-4" />,
      badge: `${components.length} Nodes`,
    },
    {
      id: 'topology',
      label: 'Network Graph',
      description: 'Live interactive canvas',
      icon: <Network className="w-4 h-4" />,
    },
    {
      id: 'invariants',
      label: 'Invariant Prover',
      description: 'Formal policy engine',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: '4 Active',
    },
    {
      id: 'chaos',
      label: 'Chaos & Fail-Safe',
      description: 'Targeted fault injection',
      icon: <ZapOff className="w-4 h-4" />,
    },
    {
      id: 'traffic',
      label: 'Packet Inspector',
      description: 'Traffic verification & stats',
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: 'radar',
      label: 'ML Anomaly Radar',
      description: 'IsolationForest telemetry',
      icon: <BrainCircuit className="w-4 h-4" />,
    },
    {
      id: 'audit',
      label: 'Audit Ledger',
      description: 'SHA-256 tamper-proof chain',
      icon: <FileCheck2 className="w-4 h-4" />,
    },
    {
      id: 'studio',
      label: 'API Studio',
      description: 'REST test harness',
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      id: 'health',
      label: 'System Health',
      description: '7 Subsystems real-time',
      icon: <Server className="w-4 h-4" />,
    },
    {
      id: 'demo',
      label: 'Judge Showcase',
      description: 'Full 23-step verification',
      icon: <Award className="w-4 h-4" />,
      badge: hasDemoResult ? 'PASSED' : undefined,
    },
  ];

  return (
    <aside className="w-full md:w-72 bg-white border-r border-slate-200 shadow-sm flex flex-col justify-between shrink-0 min-h-screen sticky top-0 z-30" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      {/* Top Header Section */}
      <div className="p-4 sm:p-5 flex flex-col space-y-4">
        {/* Brand Header */}
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => setActiveTab('dashboard')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-cyan-600 to-teal-500 flex items-center justify-center font-black text-white shadow-md shadow-indigo-100 text-base transition-transform group-hover:scale-105">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                Invariant<span className="text-indigo-600">Hold</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
              Runtime Security Platform
            </p>
          </div>
        </div>

        {/* System Health Status Indicator */}
        <div
          className={`p-3 rounded-xl border text-xs font-mono transition flex items-center justify-between ${
            isHealthy
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-ping'
              }`}
            />
            <span className="font-bold text-[11px] tracking-wide">
              {isHealthy ? 'SYSTEM HEALTHY' : `ISOLATED (${failedComps.length} FAILING)`}
            </span>
          </div>
          {isHealthy ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          )}
        </div>

        {/* User Session & Role Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
          {isAuthenticated && user ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2 truncate">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                    {user.username.split('@')[0]}
                  </p>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                      user.role === 'ADMIN'
                        ? 'bg-rose-100 text-rose-700'
                        : user.role === 'SECURITY_ANALYST'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {user.role === 'SECURITY_ANALYST' ? 'ANALYST' : user.role}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={onOpenLogin}
                  className="text-[10px] font-bold px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg transition"
                  title="Switch Role"
                >
                  Switch
                </button>
                <button
                  onClick={logout}
                  className="p-1 text-slate-400 hover:text-rose-600 transition rounded"
                  title="Log out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">Guest Session</span>
              </div>
              <button
                onClick={onOpenLogin}
                className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                <LogIn className="w-3 h-3" />
                <span>SIGN IN</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Grid / List (Vertical - No Horizontal Sliders) */}
        <nav className="flex flex-col space-y-1 pt-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
            Navigation Menu
          </p>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition text-left ${
                  isActive
                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </div>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold font-mono ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Section */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col space-y-3">
        {/* Run Judge Showcase CTA */}
        <button
          onClick={onRunJudgeDemo}
          disabled={demoLoading}
          className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-sm flex items-center justify-center space-x-2 transition active:scale-98 disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{demoLoading ? 'RUNNING DEMO...' : 'RUN JUDGE DEMO'}</span>
        </button>

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>FastAPI + SQLite</span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Port 8000</span>
          </span>
        </div>
      </div>
    </aside>
  );
};
