import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Shield,
  Activity,
  Info,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { PredictionReport, PredictedRiskItem } from '../types';

export const PredictiveEngine: React.FC = () => {
  const [report, setReport] = useState<PredictionReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<PredictedRiskItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PredictionReport>('/predictions');
      setReport(data);
      if (data.predictions && data.predictions.length > 0) {
        setSelectedItem(data.predictions[0]);
      }
    } catch (err: any) {
      console.error('Failed to load predictions:', err);
      setError(err.message || 'Could not fetch predictive risk telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions();
    const timer = setInterval(fetchPredictions, 12000);
    return () => clearInterval(timer);
  }, [fetchPredictions]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-rose-600 text-white';
      case 'HIGH':
        return 'bg-amber-600 text-white';
      case 'MEDIUM':
        return 'bg-yellow-500 text-slate-900';
      default:
        return 'bg-emerald-600 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Predictive Invariant Failure Engine
                </h1>
                <p className="text-xs text-slate-500">
                  Telemetry Trend Velocity &bull; Early Warning Horizon &bull; Transparent Scoring
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-mono text-slate-600 border border-slate-200">
              <Shield className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              <span>STRICTLY ADVISORY &bull; ZERO TRAFFIC MODIFICATION</span>
            </div>
            <button
              onClick={fetchPredictions}
              disabled={loading}
              className="inline-flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Safety Invariant Notice Banner */}
        <div className="mt-5 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start space-x-3 text-xs text-indigo-950">
          <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <span className="font-semibold">Core Safety Invariant:</span>
            <p className="text-indigo-800 leading-relaxed">
              Predictive alerts are strictly advisory early warnings. The prediction engine analyzes degradation slope, latency variance, and error acceleration without altering active packet routing. Only proven invariants can engage fail-safe actions.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchPredictions} className="font-medium underline hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Assessed</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {report?.total_assessed ?? (report?.predictions?.length || 0)}
            </span>
            <span className="text-xs text-slate-500 font-medium">Components</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">High / Critical Risk</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-2xl font-bold font-mono ${
              (report?.high_risk_count ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}>
              {report?.high_risk_count ?? 0}
            </span>
            <span className="text-xs text-slate-500 font-medium">Needing Attention</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Forecast Horizon</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-600 font-mono">
              T+30m
            </span>
            <span className="text-xs text-slate-500 font-medium">Continuous Window</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Engine Model</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-800 truncate">
              {report?.model_type || 'Transparent Weighted'}
            </span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
              AUDITABLE
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Predictions List & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Component Predictions List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
              <Activity className="w-4 h-4 mr-2 text-indigo-600" />
              Predicted Failure Risk by Component
            </h2>
            <span className="text-xs text-slate-400">Sorted by Predicted Risk Score</span>
          </div>

          {(!report?.predictions || report.predictions.length === 0) && !loading && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-medium text-slate-800">All Components Statistically Stable</p>
              <p className="text-xs text-slate-400 mt-1">No anomalous degradation trajectory detected.</p>
            </div>
          )}

          {report?.predictions?.map((item) => {
            const isSelected = selectedItem?.component_id === item.component_id;
            return (
              <div
                key={item.component_id}
                onClick={() => setSelectedItem(item)}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-600 shadow-md ring-1 ring-indigo-600/20'
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-bold text-slate-900">{item.component_name}</span>
                      <span className="text-[11px] font-mono text-slate-400">({item.component_id})</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {item.recommended_preventive_action || 'Maintain nominal operational limits.'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getRiskBadge(item.risk_level)}`}>
                      {item.risk_level}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700">
                      Score: {(item.predicted_risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Mini Risk Progress Bar */}
                <div className="mt-3">
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        item.risk_level === 'CRITICAL'
                          ? 'bg-rose-600'
                          : item.risk_level === 'HIGH'
                          ? 'bg-amber-500'
                          : item.risk_level === 'MEDIUM'
                          ? 'bg-yellow-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, item.predicted_risk_score * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: In-Depth Diagnostic Panel */}
        <div className="lg:col-span-5">
          {selectedItem ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 sticky top-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Component Diagnostic</span>
                  <h3 className="text-lg font-bold text-slate-900 font-mono">{selectedItem.component_name}</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRiskBadge(selectedItem.risk_level)}`}>
                  {selectedItem.risk_level} RISK
                </span>
              </div>

              {/* Predicted Probability & Confidence */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">Failure Likelihood</span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    {(selectedItem.predicted_risk_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">Forecast Horizon</span>
                  <span className="text-xl font-bold font-mono text-indigo-600">
                    {selectedItem.horizon_minutes || 30} min
                  </span>
                </div>
              </div>

              {/* Transparent Contributing Factors */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                  <Sliders className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  Telemetry Feature Weights
                </span>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2 text-xs">
                  {selectedItem.contributing_factors && Object.keys(selectedItem.contributing_factors).length > 0 ? (
                    Object.entries(selectedItem.contributing_factors).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between font-mono">
                        <span className="text-slate-600 capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-slate-900">{typeof v === 'number' ? v.toFixed(3) : String(v)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 text-[11px]">Telemetry within nominal baseline limits.</div>
                  )}
                </div>
              </div>

              {/* Advisory Preventive Action */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950">
                <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Advisory Preventive Posture</span>
                </div>
                <p className="leading-relaxed text-amber-800">
                  {selectedItem.recommended_preventive_action ||
                    'Pre-provision redundant capacity and monitor latency degradation before invariant threshold violation.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
              Select a component to inspect predictive telemetry breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
