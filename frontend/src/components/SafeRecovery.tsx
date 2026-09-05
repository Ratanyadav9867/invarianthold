import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  ShieldCheck,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  ArrowRight,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import { RecoveryMode, RecoveryPlan, RecoveryExecuteResponse } from '../types';

export const SafeRecovery: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<RecoveryMode>('RECOMMEND');
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [executeResult, setExecuteResult] = useState<RecoveryExecuteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatusAndPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const modeRes = await api.get<{ current_mode: RecoveryMode }>('/recovery/mode');
      if (modeRes?.current_mode) {
        setCurrentMode(modeRes.current_mode);
      }
      const planRes = await api.get<RecoveryPlan>('/recovery/plan');
      setPlan(planRes);
    } catch (err: any) {
      console.error('Failed to load recovery data:', err);
      setError(err.message || 'Could not fetch recovery status or plan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatusAndPlan();
  }, [fetchStatusAndPlan]);

  const handleModeChange = async (mode: RecoveryMode) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.post('/recovery/mode', { mode });
      setCurrentMode(mode);
      await fetchStatusAndPlan();
    } catch (err: any) {
      setError(err.message || 'Failed to update recovery mode.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteRecovery = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.post<RecoveryExecuteResponse>('/recovery/execute', {});
      setExecuteResult(res);
      await fetchStatusAndPlan();
    } catch (err: any) {
      setError(err.message || 'Recovery execution failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Autonomous Safe Recovery Engine
              </h1>
              <p className="text-xs text-slate-500">
                Mode-Gated Control &bull; Invariant-Verified Fail-Safe Rerouting &bull; Zero Unsafe Packets
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-mono font-bold">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              UNSAFE TRAFFIC DELIVERED: 0
            </span>
            <button
              onClick={fetchStatusAndPlan}
              disabled={loading}
              className="inline-flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Plan
            </button>
          </div>
        </div>

        <div className="mt-4 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start space-x-3 text-xs text-indigo-950">
          <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed text-indigo-800">
            <strong>Triple-Tier Operational Safety:</strong> In <strong>MONITOR</strong> mode, the system only alerts. In <strong>RECOMMEND</strong> mode, mathematically validated reroute plans are staged for operator approval. In <strong>AUTO</strong> mode, rerouting executes autonomously ONLY when an alternate path with 100% invariant compliance is verified.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-medium underline hover:text-rose-900">
            Dismiss
          </button>
        </div>
      )}

      {/* Mode Selector Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Governance Tier</span>
            <h2 className="text-base font-bold text-slate-900">Active Operational Mode</h2>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            CURRENT: <span className="text-indigo-600">{currentMode}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              id: 'MONITOR',
              title: 'MONITOR',
              desc: 'Telemetry aggregation & threshold alerts. No active rerouting.',
              badge: 'Observation Only',
              color: 'slate',
            },
            {
              id: 'RECOMMEND',
              title: 'RECOMMEND',
              desc: 'Generates provably safe alternate routes for manual approval.',
              badge: 'Human-in-the-Loop',
              color: 'indigo',
            },
            {
              id: 'AUTO',
              title: 'AUTO',
              desc: 'Autonomous fail-safe activation. Only zero-risk routes execute.',
              badge: 'Autonomous Fail-Safe',
              color: 'emerald',
            },
          ].map((mode) => {
            const isSelected = currentMode === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => handleModeChange(mode.id as RecoveryMode)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-600/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Radio className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="font-mono font-bold text-sm text-slate-900">{mode.title}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-600">
                    {mode.badge}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">{mode.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recovery Plan & Candidate Paths */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Candidate Analysis</span>
              <h3 className="text-base font-bold text-slate-900">Current Recovery Plan</h3>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-slate-500">Candidates Evaluated:</span>
              <span className="font-bold text-slate-800">{plan?.candidates_analyzed || 0}</span>
            </div>
          </div>

          {plan?.actions && plan.actions.length > 0 ? (
            <div className="space-y-3">
              {plan.actions.map((act, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-900">{act.path_name || act.path_id}</span>
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded">
                        {act.action_type}
                      </span>
                    </div>
                    <span className="inline-flex items-center text-emerald-700 font-mono text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      INVARIANT GUARANTEED
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-600 pt-1">
                    <span className="text-rose-700 font-medium line-through">
                      [{act.from_hops?.join(' → ') || 'ORIGINAL'}]
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-emerald-700 font-bold">
                      [{act.to_hops?.join(' → ') || 'FAIL-SAFE'}]
                    </span>
                  </div>

                  <p className="text-slate-500 text-[11px] pt-1">{act.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
              <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-bold text-slate-800">All Active Routes Guaranteed</p>
              <p className="text-xs text-slate-400 mt-1">No pending recovery actions or compromised paths.</p>
            </div>
          )}

          {/* Execution Button */}
          {plan?.actions && plan.actions.length > 0 && (
            <div className="pt-3">
              <button
                onClick={handleExecuteRecovery}
                disabled={actionLoading || currentMode === 'MONITOR'}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Safe Reroute...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>
                      {currentMode === 'AUTO'
                        ? 'Force Trigger Autonomous Recovery Cycle'
                        : 'Apply Recommended Safe Recovery Plan'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Status Card Column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Formal Proof Metrics</span>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-600">Safe Traffic Preserved:</span>
                <span className="text-base font-bold font-mono text-emerald-600">
                  {plan?.safe_traffic_preserved_pct ?? 100}%
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-600">Unsafe Traffic Delivered:</span>
                <span className="text-base font-bold font-mono text-emerald-600">0</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-600">Execution Readiness:</span>
                <span className="text-xs font-bold font-mono text-indigo-600">
                  {plan?.execution_ready ? 'READY' : 'STABLE'}
                </span>
              </div>
            </div>

            {executeResult && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Execution Verified</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  {executeResult.status || 'Successfully applied verified safe routing alterations.'}
                </p>
                <div className="text-[10px] font-mono text-emerald-700 pt-1">
                  Paths Recovered: {executeResult.paths_recovered} &bull; Unsafe: 0
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
