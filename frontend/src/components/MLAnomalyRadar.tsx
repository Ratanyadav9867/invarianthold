import React, { useState } from 'react';
import {
  BrainCircuit,
  Cpu,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { AIData } from '../types';
import { api } from '../api/client';

interface MLAnomalyRadarProps {
  aiData: AIData | null;
  onRefreshScenario: (scenario: string) => Promise<void>;
  loading: boolean;
}

export const MLAnomalyRadar: React.FC<MLAnomalyRadarProps> = ({
  aiData,
  onRefreshScenario,
  loading,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>('NORMAL');
  const [explaining, setExplaining] = useState<boolean>(false);
  const [aiExplanation, setAiExplanation] = useState<any | null>(null);

  const handleScenarioChange = async (sc: string) => {
    setSelectedScenario(sc);
    await onRefreshScenario(sc);
  };

  const handleGenerateExplanation = async () => {
    setExplaining(true);
    try {
      const res = await api.post('/ai/explain', {});
      setAiExplanation(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setExplaining(false);
    }
  };

  const analysis = aiData?.telemetry_analysis;
  const risk = aiData?.risk_assessment;
  const isAnomaly = analysis?.is_anomaly ?? false;

  return (
    <div className="space-y-6">
      {/* Title & Scenario Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 font-mono flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-indigo-600" />
            <span>ML ANOMALY RADAR & ADVISORY ENGINE</span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            scikit-learn Isolation Forest model (n_estimators=100, contamination=0.03) evaluating 8 reproducible telemetry vectors. Strictly advisory.
          </p>
        </div>

        <div className="flex items-center space-x-1.5">
          {['NORMAL', 'SINGLE_FAILURE', 'BURST_ANOMALY', 'DDOS_ATTACK'].map((sc) => (
            <button
              key={sc}
              onClick={() => handleScenarioChange(sc)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition ${
                selectedScenario === sc
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {sc.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Primary ML Assessment Scorecard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Anomaly Detection Verdict */}
        <div
          className={`p-5 rounded-2xl border shadow-xs transition flex flex-col justify-between ${
            isAnomaly
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold font-mono text-slate-500">
                ISOLATION FOREST VERDICT
              </span>
              <Cpu className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black mt-2 font-mono">
              {isAnomaly ? 'ANOMALY DETECTED' : 'NORMAL BEHAVIOR'}
            </div>
            <p className="text-xs mt-1">
              Score: <span className="font-bold font-mono">{analysis?.anomaly_score.toFixed(4) || '0.0000'}</span>{' '}
              (Threshold: 0.1500)
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] font-mono">
            Algorithm: <span className="font-bold">IsolationForest</span>
          </div>
        </div>

        {/* Dynamic Composite Risk Score */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-bold font-mono">
                COMPOSITE SYSTEM RISK
              </span>
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-3xl font-black mt-2 font-mono text-slate-900">
              {risk?.risk_score.toFixed(1) || '0.0'}{' '}
              <span className="text-sm font-normal text-slate-400">/ 100</span>
            </div>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black font-mono mt-1 ${
                risk?.risk_level === 'CRITICAL'
                  ? 'bg-rose-100 text-rose-800'
                  : risk?.risk_level === 'HIGH'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {risk?.risk_level || 'LOW'} RISK LEVEL
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500 font-mono">
            Weighted composite: Topology (50%) + ML (30%) + Criticality (20%)
          </div>
        </div>

        {/* Strict Advisory Principle Guardrail */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-[10px] uppercase font-bold font-mono">CRITICAL SAFETY INVARIANT</span>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-amber-950 mt-2 font-mono">
              Strict Advisory Isolation
            </div>
            <p className="text-xs text-amber-900 mt-1 leading-relaxed">
              Machine Learning outputs provide real-time telemetry prioritization and early warning alerts. ML models
              CANNOT override or loosen formal deterministic security invariants.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200 text-[10px] text-amber-800 font-mono font-bold">
            Formal Invariant Hierarchy: DETERMINISTIC ENGINE &gt; ML RADAR
          </div>
        </div>
      </div>

      {/* Feature Attribution Matrix */}
      {analysis && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 font-mono flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>Telemetry Vector Attribution ({Object.keys(analysis.contributing_metrics || {}).length} Dimensions)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Real-time Feature Values</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            {Object.entries(analysis.contributing_metrics || {}).map(([key, val]) => (
              <div key={key} className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase block truncate">{key.replace(/_/g, ' ')}</span>
                <div className="text-base font-bold text-slate-900 mt-1">
                  {typeof val === 'number' ? val.toFixed(2) : String(val)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Root Cause Explanation Generator */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-mono flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Cryptographic &amp; Formal Decision Explainability</span>
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Generates audit-ready mathematical explanations for path routing, isolation verdicts, and invariant bounds.
            </p>
          </div>

          <button
            onClick={handleGenerateExplanation}
            disabled={explaining}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-mono font-bold shadow-xs flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${explaining ? 'animate-spin' : ''}`} />
            <span>{explaining ? 'GENERATING EXPLANATION...' : 'EXPLAIN CURRENT STATE'}</span>
          </button>
        </div>

        {aiExplanation && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 uppercase font-bold">Analysis Synthesis</span>
              <span className="text-emerald-700 font-bold">AUDIT READY</span>
            </div>
            <p className="text-slate-800 leading-relaxed text-sm">{aiExplanation.explanation}</p>
            {aiExplanation.rationale && (
              <div className="text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                <strong>Enforcement Rationale: </strong>
                {aiExplanation.rationale}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
