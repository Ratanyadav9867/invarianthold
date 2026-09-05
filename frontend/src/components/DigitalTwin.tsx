import React, { useState } from 'react';
import {
  Boxes,
  Play,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import { ComponentData, SimulationResult } from '../types';

interface DigitalTwinProps {
  components: ComponentData[];
}

export const DigitalTwin: React.FC<DigitalTwinProps> = ({ components }) => {
  const [scenarioType, setScenarioType] = useState<'COMPONENT_FAIL' | 'ZONE_ISOLATION' | 'TRAFFIC_SPIKE' | 'LATENCY_DEGRADATION' | 'CONTROL_BYPASS'>('COMPONENT_FAIL');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([components[0]?.id || 'AUTH-01']);
  const [selectedZone, setSelectedZone] = useState<string>(components[0]?.zone || 'APP');
  const [spikeMultiplier, setSpikeMultiplier] = useState<number>(3.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const zones = Array.from(new Set(components.map((c) => c.zone).filter(Boolean)));

  const toggleComponent = (id: string) => {
    if (selectedComponents.includes(id)) {
      setSelectedComponents(selectedComponents.filter((c) => c !== id));
    } else {
      setSelectedComponents([...selectedComponents, id]);
    }
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      let targetNodes = selectedComponents;
      let params: Record<string, any> = {};

      if (scenarioType === 'ZONE_ISOLATION') {
        targetNodes = components.filter((c) => c.zone === selectedZone).map((c) => c.id);
        params = { zone: selectedZone };
      } else if (scenarioType === 'TRAFFIC_SPIKE') {
        params = { multiplier: spikeMultiplier };
      }

      const res = await api.post<SimulationResult>('/simulation/what-if', {
        scenario_type: scenarioType,
        target_nodes: targetNodes,
        parameters: params,
      });

      setSimulationResult(res);
    } catch (err: any) {
      console.error('Simulation failed:', err);
      setError(err.message || 'Simulation execution failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Digital Twin &amp; What-If Simulation
              </h1>
              <p className="text-xs text-slate-500">
                In-Memory Ephemeral Sandbox &bull; Pre-Production Impact Testing &bull; Zero DB Writes
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-mono font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              LIVE DATABASE STATE: UNTOUCHED
            </span>
          </div>
        </div>

        <div className="mt-4 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start space-x-3 text-xs text-indigo-950">
          <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed text-indigo-800">
            The Digital Twin clones network topology, active routes, and security invariants entirely in memory. It tests catastrophic failures and stress scenarios without risking production live traffic.
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

      {/* Scenario Configurator & Action Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Step 1</span>
            <h2 className="text-base font-bold text-slate-900">Select Simulation Scenario</h2>
          </div>

          {/* Scenario Type Radio Selector */}
          <div className="space-y-2">
            {[
              { id: 'COMPONENT_FAIL', label: 'Component Outage', desc: 'Simulate instant failure of critical nodes' },
              { id: 'ZONE_ISOLATION', label: 'Zone Isolation', desc: 'Sever communication to an entire network zone' },
              { id: 'TRAFFIC_SPIKE', label: 'Volumetric Traffic Spike', desc: 'Stress test routing capacity under surge' },
              { id: 'LATENCY_DEGRADATION', label: 'Latency Degradation', desc: 'Inject upstream jitter & slow responses' },
              { id: 'CONTROL_BYPASS', label: 'Control Degradation', desc: 'Simulate WAF/mTLS control offline' },
            ].map((sc) => (
              <label
                key={sc.id}
                onClick={() => setScenarioType(sc.id as any)}
                className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                  scenarioType === sc.id
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="scenario"
                  checked={scenarioType === sc.id}
                  onChange={() => {}}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="ml-3">
                  <span className="text-xs font-bold text-slate-900 block">{sc.label}</span>
                  <span className="text-[11px] text-slate-500">{sc.desc}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Dynamic Parameter Selector */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Step 2: Parameters</span>

            {scenarioType === 'COMPONENT_FAIL' && (
              <div className="space-y-2">
                <span className="text-xs text-slate-600 font-medium">Select Target Node(s):</span>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                  {components.map((c) => {
                    const selected = selectedComponents.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleComponent(c.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                          selected
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
            )}

            {scenarioType === 'ZONE_ISOLATION' && (
              <div className="space-y-2">
                <span className="text-xs text-slate-600 font-medium">Select Target Zone:</span>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scenarioType === 'TRAFFIC_SPIKE' && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Surge Multiplier:</span>
                  <span className="font-mono font-bold text-indigo-600">{spikeMultiplier}x Baseline</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="10.0"
                  step="0.5"
                  value={spikeMultiplier}
                  onChange={(e) => setSpikeMultiplier(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Simulating Against Twin...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run In-Memory What-If Simulation</span>
              </>
            )}
          </button>
        </div>

        {/* Simulation Output Area */}
        <div className="lg:col-span-7 space-y-4">
          {simulationResult ? (
            <div className="space-y-4">
              {/* Twin Results Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Simulation Report</span>
                    <h3 className="text-base font-bold text-slate-900 font-mono">
                      Scenario: {simulationResult.scenario}
                    </h3>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-mono font-bold rounded-full border border-emerald-200">
                    ISOLATION VERIFIED
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Total Nodes</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {simulationResult.twin_summary?.total_nodes || components.length}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Affected Paths</span>
                    <span className="text-lg font-bold font-mono text-rose-600">
                      {simulationResult.affected_paths?.length || 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Preserved Paths</span>
                    <span className="text-lg font-bold font-mono text-emerald-600">
                      {simulationResult.preserved_paths?.length || 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Est. Blast Radius</span>
                    <span className="text-lg font-bold font-mono text-indigo-600">
                      {simulationResult.blast_radius_estimate}%
                    </span>
                  </div>
                </div>

                {/* Path Impact List */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Affected Paths</span>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {simulationResult.affected_paths?.length > 0 ? (
                      simulationResult.affected_paths.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-slate-900">{p.path_name || p.path_id}</span>
                            <p className="text-[11px] text-slate-500">{p.impact}</p>
                          </div>
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-md">
                            {p.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                        No critical paths breached during this scenario.
                      </div>
                    )}
                  </div>
                </div>

                {/* Recommendations */}
                {simulationResult.recommendations && simulationResult.recommendations.length > 0 && (
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center space-x-1.5 font-bold text-indigo-900">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Pre-emptive Hardening Recommendations</span>
                    </div>
                    <ul className="space-y-1 text-indigo-900 list-disc list-inside">
                      {simulationResult.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 space-y-3">
              <Layers className="w-12 h-12 mx-auto text-slate-300" />
              <h4 className="text-base font-bold text-slate-700">No Simulation Executed Yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Configure your failure parameters on the left and click "Run In-Memory What-If Simulation" to observe predicted cascade behavior without affecting production.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
