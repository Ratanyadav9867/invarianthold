import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Flame,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import {
  ComponentData,
  ChaosTestResult,
  ChaosBatchResult,
  ChaosSecurityReport,
} from '../types';

interface ChaosSecurityProps {
  components: ComponentData[];
}

export const ChaosSecurity: React.FC<ChaosSecurityProps> = ({ components }) => {
  const [chaosType, setChaosType] = useState<string>('CASCADE_FAILURE');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([components[0]?.id || 'AUTH-01']);
  const [intensity, setIntensity] = useState<number>(1.5);
  const [loading, setLoading] = useState<boolean>(false);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [latestResult, setLatestResult] = useState<ChaosTestResult | null>(null);
  const [batchResult, setBatchResult] = useState<ChaosBatchResult | null>(null);
  const [report, setReport] = useState<ChaosSecurityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const data = await api.get<ChaosSecurityReport>('/chaos/report');
      setReport(data);
    } catch (err) {
      console.error('Failed to load chaos report:', err);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleRunChaosTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<ChaosTestResult>('/chaos/run', {
        chaos_type: chaosType,
        components: selectedComponents,
        intensity,
        label: `Chaos-${chaosType}`,
      });
      setLatestResult(res);
      await fetchReport();
    } catch (err: any) {
      setError(err.message || 'Chaos test run failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunBatch = async (testType: string = 'PROGRESSIVE') => {
    setBatchLoading(true);
    setError(null);
    try {
      const res = await api.post<ChaosBatchResult>('/chaos/batch', {
        test_type: testType,
        components: selectedComponents,
      });
      setBatchResult(res);
      await fetchReport();
    } catch (err: any) {
      setError(err.message || 'Batch chaos suite failed.');
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleComponent = (id: string) => {
    if (selectedComponents.includes(id)) {
      if (selectedComponents.length > 1) {
        setSelectedComponents(selectedComponents.filter((c) => c !== id));
      }
    } else {
      setSelectedComponents([...selectedComponents, id]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Chaos Security Testing Studio
              </h1>
              <p className="text-xs text-slate-500">
                Digital Twin Inoculation &bull; Automated Resilience Probing &bull; Zero Production Risk
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-mono font-bold">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              RUNS IN DIGITAL TWIN (SAFE)
            </span>
          </div>
        </div>

        <div className="mt-4 p-3.5 bg-rose-50/60 border border-rose-100 rounded-xl flex items-start space-x-3 text-xs text-rose-950">
          <Info className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed text-rose-900">
            Chaos security tests intentionally introduce adversarial stress, split-brain scenarios, and sudden component kills into the isolated Digital Twin sandbox to mathematically prove that fail-closed invariants guarantee zero unsafe traffic delivery.
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

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Config Panel */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Configuration</span>
            <h2 className="text-base font-bold text-slate-900">Inject Chaos Experiment</h2>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Chaos Experiment Type:</label>
            <select
              value={chaosType}
              onChange={(e) => setChaosType(e.target.value)}
              className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800"
            >
              <option value="CASCADE_FAILURE">CASCADE_FAILURE (Simulate cascading node collapse)</option>
              <option value="RANDOM_KILL">RANDOM_KILL (Chaos monkey node termination)</option>
              <option value="LATENCY_INJECTION">LATENCY_INJECTION (Simulate network congestion &amp; jitter)</option>
              <option value="CONTROL_DEGRADATION">CONTROL_DEGRADATION (Simulate WAF/mTLS bypass)</option>
              <option value="SPLIT_BRAIN_SIMULATION">SPLIT_BRAIN_SIMULATION (Partition core nodes)</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Adversarial Intensity:</span>
              <span className="font-mono font-bold text-rose-600">{intensity}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="4.0"
              step="0.5"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Target Nodes:</label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
              {components.map((c) => {
                const isSelected = selectedComponents.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleComponent(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                      isSelected
                        ? 'bg-rose-600 text-white font-bold shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {c.id}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 space-y-2">
            <button
              onClick={handleRunChaosTest}
              disabled={loading}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>{loading ? 'Executing in Twin...' : 'Run Single Chaos Scenario'}</span>
            </button>

            <button
              onClick={() => handleRunBatch('PROGRESSIVE')}
              disabled={batchLoading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{batchLoading ? 'Running Suite...' : 'Run Progressive Batch Suite'}</span>
            </button>
          </div>
        </div>

        {/* Right Results & Report Panel */}
        <div className="lg:col-span-7 space-y-4">
          {latestResult ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Test Run Outcome</span>
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    Scenario: {latestResult.scenario}
                  </h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                    latestResult.safety_maintained
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {latestResult.safety_maintained ? 'INVARIANTS HELD FIRM' : 'SAFETY BREACHED'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 uppercase block">Paths Evaluated</span>
                  <span className="text-lg font-bold font-mono text-slate-900">
                    {latestResult.paths_evaluated}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 uppercase block">Invariants Tested</span>
                  <span className="text-lg font-bold font-mono text-slate-900">
                    {latestResult.invariants_tested}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 uppercase block">Unsafe Traffic</span>
                  <span className="text-lg font-bold font-mono text-emerald-600">
                    {latestResult.unsafe_traffic_delivered}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 uppercase block">Live Modified</span>
                  <span className="text-lg font-bold font-mono text-slate-900">
                    {latestResult.live_state_modified ? 'YES' : 'FALSE'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono space-y-1">
                <span className="text-slate-500 text-[10px] uppercase block">Detailed Verdict</span>
                <p className="text-slate-800 font-semibold">{latestResult.detailed_verdict}</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              Select chaos scenario and click Run to test system resilience in the Digital Twin.
            </div>
          )}

          {/* Batch Result Card */}
          {batchResult && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-900 font-mono">
                  Batch Suite: {batchResult.batch_id}
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-full border border-emerald-200 font-mono">
                  Score: {batchResult.aggregate_safety_score}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">Total</span>
                  <span className="font-bold text-slate-800">{batchResult.total_tests}</span>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <span className="text-[10px] text-emerald-700 block">Passed</span>
                  <span className="font-bold text-emerald-800">{batchResult.passed}</span>
                </div>
                <div className="p-2 bg-rose-50 rounded-lg">
                  <span className="text-[10px] text-rose-700 block">Failed</span>
                  <span className="font-bold text-rose-800">{batchResult.failed}</span>
                </div>
              </div>
            </div>
          )}

          {/* Invariant Resilience Matrix Card */}
          {report && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Historical Telemetry</span>
                  <h3 className="text-base font-bold text-slate-900">Invariant Resilience Matrix</h3>
                </div>
                <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  Pass Rate: {report.summary?.pass_rate_pct ?? 100}%
                </span>
              </div>

              <div className="space-y-2">
                {report.invariant_resilience_matrix && report.invariant_resilience_matrix.length > 0 ? (
                  report.invariant_resilience_matrix.map((inv, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900">{inv.name || inv.invariant_id}</span>
                        <div className="text-[11px] text-slate-500">Tested {inv.times_tested} times under stress</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-emerald-600">{inv.held_firm_pct}% Held Firm</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-xs text-slate-400 p-4">
                    Resilience matrix will populate as chaos tests run.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
