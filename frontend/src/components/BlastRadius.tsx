import React, { useState } from 'react';
import {
  Crosshair,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import { ComponentData, BlastRadiusResult, AttackPathResult } from '../types';

interface BlastRadiusProps {
  components: ComponentData[];
}

export const BlastRadius: React.FC<BlastRadiusProps> = ({ components }) => {
  const [activeSubTab, setActiveSubTab] = useState<'blast' | 'attack'>('blast');

  // Blast Radius State
  const [selectedComponents, setSelectedComponents] = useState<string[]>([components[0]?.id || 'AUTH-01']);
  const [blastResult, setBlastResult] = useState<any | null>(null);
  const [blastLoading, setBlastLoading] = useState<boolean>(false);
  const [blastError, setBlastError] = useState<string | null>(null);

  // Attack Path State
  const [selectedSource, setSelectedSource] = useState<string>(components[0]?.id || 'FW-01');
  const [attackResult, setAttackResult] = useState<any | null>(null);
  const [attackLoading, setAttackLoading] = useState<boolean>(false);
  const [attackError, setAttackError] = useState<string | null>(null);

  const toggleComponent = (id: string) => {
    if (selectedComponents.includes(id)) {
      if (selectedComponents.length > 1) {
        setSelectedComponents(selectedComponents.filter((c) => c !== id));
      }
    } else {
      setSelectedComponents([...selectedComponents, id]);
    }
  };

  const handleComputeBlastRadius = async () => {
    setBlastLoading(true);
    setBlastError(null);
    try {
      const res = await api.post<BlastRadiusResult>('/blast-radius', {
        component_ids: selectedComponents,
      });
      setBlastResult(res);
    } catch (err: any) {
      setBlastError(err.message || 'Blast radius computation failed.');
    } finally {
      setBlastLoading(false);
    }
  };

  const handleAnalyzeAttackPaths = async () => {
    setAttackLoading(true);
    setAttackError(null);
    try {
      const res = await api.get<AttackPathResult>(`/attack-paths/${selectedSource}`);
      setAttackResult(res);
    } catch (err: any) {
      setAttackError(err.message || 'Attack path discovery failed.');
    } finally {
      setAttackLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <Crosshair className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Blast Radius &amp; Attack Path Analysis
              </h1>
              <p className="text-xs text-slate-500">
                Transitive Cascading Graph &bull; Lateral Movement Discovery &bull; Strategic Chokepoint Defense
              </p>
            </div>
          </div>

          {/* Sub-tab Navigation Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setActiveSubTab('blast')}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'blast'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Blast Radius
            </button>
            <button
              onClick={() => setActiveSubTab('attack')}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'attack'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Attack Path Analysis
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: BLAST RADIUS */}
      {activeSubTab === 'blast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Config Column */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Step 1</span>
              <h2 className="text-base font-bold text-slate-900">Select Failed Component(s)</h2>
              <p className="text-xs text-slate-500 mt-1">
                Choose one or more components to calculate transitive failure cascade across the topology.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
              {components.map((c) => {
                const selected = selectedComponents.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleComponent(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                      selected
                        ? 'bg-rose-600 text-white font-bold shadow-sm ring-2 ring-rose-600/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {c.id}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleComputeBlastRadius}
              disabled={blastLoading || selectedComponents.length === 0}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${blastLoading ? 'animate-spin' : ''}`} />
              <span>Calculate Transitive Blast Radius</span>
            </button>

            {blastError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {blastError}
              </div>
            )}
          </div>

          {/* Results Column */}
          <div className="lg:col-span-7 space-y-4">
            {blastResult ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cascade Matrix</span>
                    <h3 className="text-base font-bold text-slate-900 font-mono">
                      Impact: {blastResult.blast_percentage ?? (blastResult.affected_paths_count !== undefined ? Math.round(((blastResult.affected_paths_count || 0) / Math.max((blastResult.affected_paths_count || 0) + (blastResult.safe_paths_count || 0), 1)) * 100) : 25)}% of System
                    </h3>
                  </div>
                  <span className="px-3 py-1 bg-rose-50 text-rose-800 text-xs font-mono font-bold rounded-full border border-rose-200">
                    RISK: {blastResult.risk_score !== undefined ? `${(blastResult.risk_score * 100).toFixed(0)}/100` : (blastResult.risk_level || 'ELEVATED')}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-slate-600">
                    <span>Blast Radius Coverage</span>
                    <span className="font-bold text-rose-600">
                      {blastResult.blast_percentage ?? (blastResult.affected_paths_count !== undefined ? Math.round(((blastResult.affected_paths_count || 0) / Math.max((blastResult.affected_paths_count || 0) + (blastResult.safe_paths_count || 0), 1)) * 100) : 25)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-rose-600 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(5, blastResult.blast_percentage ?? (blastResult.affected_paths_count !== undefined ? Math.round(((blastResult.affected_paths_count || 0) / Math.max((blastResult.affected_paths_count || 0) + (blastResult.safe_paths_count || 0), 1)) * 100) : 25)))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Stat Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Failed Components</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {blastResult.failed_components?.length || blastResult.target_components?.length || 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Affected Invariants</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {blastResult.affected_invariants_count ?? blastResult.affected_invariants?.length ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Interrupted Paths</span>
                    <span className="text-lg font-bold font-mono text-rose-600">
                      {blastResult.paths_interrupted ?? blastResult.affected_paths_count ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Safe Paths</span>
                    <span className="text-lg font-bold font-mono text-emerald-600">
                      {blastResult.paths_resilient ?? blastResult.safe_paths_count ?? 0}
                    </span>
                  </div>
                </div>

                {/* Cascading Dependencies Breakdown */}
                <div className="space-y-3 pt-2">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Affected Services &amp; Dependents
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(blastResult.affected_services || blastResult.direct_dependents || []).length > 0 ? (
                        (blastResult.affected_services || blastResult.direct_dependents).map((d: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-slate-800">
                            {d}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Critical Assets Exposed / Invariants Affected
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(blastResult.critical_assets_exposed || blastResult.affected_invariants || []).length > 0 ? (
                        (blastResult.critical_assets_exposed || blastResult.affected_invariants).map((d: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-rose-50 border border-rose-200 rounded font-mono text-rose-800 font-bold">
                            {d}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">All Critical Assets Protected</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                Select components and click calculate to discover full transitive cascading dependencies.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ATTACK PATH ANALYSIS */}
      {activeSubTab === 'attack' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Config Column */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Entrypoint Source</span>
              <h2 className="text-base font-bold text-slate-900">Discover Lateral Attack Paths</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enumerate all verified traversal routes from an ingress point to high-value database or internal zones.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Source Entrypoint Node:</label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800"
              >
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} ({c.zone || 'DEFAULT'})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAnalyzeAttackPaths}
              disabled={attackLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${attackLoading ? 'animate-spin' : ''}`} />
              <span>Trace Reachable Attack Paths</span>
            </button>

            {attackError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {attackError}
              </div>
            )}
          </div>

          {/* Results Column */}
          <div className="lg:col-span-7 space-y-4">
            {attackResult ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attack Vector Map</span>
                    <h3 className="text-base font-bold text-slate-900 font-mono">
                      Found {attackResult.total_paths_found ?? attackResult.total_paths_analyzed ?? (attackResult.attack_paths?.length || 0)} Potential Paths
                    </h3>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-800 text-xs font-mono font-bold rounded-full border border-indigo-200">
                    SOURCE: {attackResult.source_id || attackResult.entry_component}
                  </span>
                </div>

                {/* Chokepoint Recommendation Box */}
                {(attackResult.recommended_chokepoints || attackResult.critical_paths)?.length > 0 && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950">
                    <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Recommended Defense Chokepoints</span>
                    </div>
                    <p className="text-emerald-800">
                      Enforcing strict invariant controls at these nodes neutralizes multiple lateral traversal vectors:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(attackResult.recommended_chokepoints || ['API-GW-01', 'AUTH-01']).map((cp: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white border border-emerald-300 font-mono font-bold text-emerald-900 rounded-md text-[11px]"
                        >
                          {cp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Path Listing */}
                <div className="space-y-3">
                  {attackResult.attack_paths?.map((item: any, idx: number) => {
                    const hops = item.hops || item.path || [];
                    const destZone = item.destination_zone || item.target_zone || 'INTERNAL';
                    const destNode = item.destination_node || item.target_node || hops[hops.length - 1] || 'TARGET';
                    const risk = item.risk_level || item.overall_risk || 'HIGH';

                    return (
                      <div
                        key={idx}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">
                            Target Zone: {destZone} ({destNode})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              risk === 'CRITICAL'
                                ? 'bg-rose-600 text-white'
                                : risk === 'HIGH'
                                ? 'bg-amber-500 text-white'
                                : 'bg-yellow-400 text-slate-900'
                            }`}
                          >
                            {risk} RISK
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 overflow-x-auto">
                          {hops.map((node: string, nIdx: number) => (
                            <React.Fragment key={nIdx}>
                              <span className="font-bold text-indigo-700">{node}</span>
                              {nIdx < hops.length - 1 && (
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        {item.weak_points && item.weak_points.length > 0 && (
                          <p className="text-[11px] text-rose-700 font-mono">
                            Weak points: {item.weak_points.join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                Select an ingress source node and click trace to analyze lateral movement attack paths.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
