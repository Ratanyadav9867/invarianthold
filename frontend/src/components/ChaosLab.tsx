import { useState } from 'react';
import {
  ZapOff,
  GitBranch,
  RotateCcw,
  Activity,
  Play,
  AlertTriangle,
  Server,
  Layers,
} from 'lucide-react';
import { ComponentData, PathData } from '../types';
import { useAuth } from '../context/AuthContext';

interface ChaosLabProps {
  components: ComponentData[];
  paths: PathData[];
  loading?: boolean;
  onInjectFailure: (compIds: string[], type?: string) => Promise<void>;
  onReroute: (pathId?: string | null) => Promise<void>;
  onRecoverComponent: (id: string) => Promise<void>;
  onRecoverAll: () => Promise<void>;
  onSimulateTraffic: (count?: number) => Promise<void>;
}

export const ChaosLab: React.FC<ChaosLabProps> = ({
  components,
  paths,
  loading: _loading,
  onInjectFailure,
  onReroute,
  onRecoverComponent,
  onRecoverAll,
  onSimulateTraffic,
}) => {
  const { canMutate } = useAuth();
  const [selectedCompId, setSelectedCompId] = useState<string>('ENC-01');
  const [failureType, setFailureType] = useState<string>('HARDWARE_FAILURE');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [simPackets, setSimPackets] = useState<number>(1000);

  const safePaths = paths.filter((p) => p.status === 'GUARANTEED' || p.status === 'REROUTED');
  const blockedPaths = paths.filter((p) => p.status === 'BLOCKED' || p.status === 'VIOLATED');
  const safePct = paths.length > 0 ? ((safePaths.length / paths.length) * 100).toFixed(1) : '100.0';

  const executeAction = async (name: string, fn: () => Promise<void>) => {
    setActionInProgress(name);
    try {
      await fn();
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-slate-900 font-mono flex items-center space-x-2">
          <ZapOff className="w-5 h-5 text-rose-600" />
          <span>CHAOS & TARGETED FAIL-SAFE LAB</span>
        </h2>
        <p className="text-xs text-slate-500 font-mono mt-0.5">
          Inject real adversary or infrastructure failures into enforcement points. Observe targeted isolation of broken flows while healthy flows remain operational with zero spillover.
        </p>
      </div>

      {/* Primary Action Workbench */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Preset 1: Fail ENC-01 */}
        <button
          onClick={() =>
            executeAction('fail-enc01', () => onInjectFailure(['ENC-01'], 'PRIMARY_ENCRYPTION_FAIL'))
          }
          disabled={!canMutate || !!actionInProgress}
          className="p-4 bg-white hover:bg-rose-50/50 border border-slate-200 hover:border-rose-300 rounded-2xl text-left transition group shadow-xs disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-xs font-bold font-mono text-rose-700">
            <span>FAIL ENC-01 (PRIMARY)</span>
            <ZapOff className="w-4 h-4" />
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1.5 leading-relaxed">
            Isolates 3 PCI flows. Preserves 7 safe web, auth & DB flows (70.0% safe preservation).
          </p>
          <span className="inline-block mt-3 text-[10px] font-mono font-bold text-rose-700 group-hover:underline">
            {actionInProgress === 'fail-enc01' ? 'INJECTING...' : 'RUN SCENARIO →'}
          </span>
        </button>

        {/* Preset 2: Total Encryption Outage */}
        <button
          onClick={() =>
            executeAction('fail-both-enc', () =>
              onInjectFailure(['ENC-01', 'ENC-02'], 'TOTAL_ENCRYPTION_OUTAGE')
            )
          }
          disabled={!canMutate || !!actionInProgress}
          className="p-4 bg-white hover:bg-rose-50/50 border border-slate-200 hover:border-rose-300 rounded-2xl text-left transition group shadow-xs disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-xs font-bold font-mono text-rose-700">
            <span>FAIL ENC-01 + ENC-02</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1.5 leading-relaxed">
            Total encryption failure. Proves that when NO compliant route exists, traffic remains BLOCKED.
          </p>
          <span className="inline-block mt-3 text-[10px] font-mono font-bold text-rose-700 group-hover:underline">
            {actionInProgress === 'fail-both-enc' ? 'INJECTING...' : 'RUN SCENARIO →'}
          </span>
        </button>

        {/* Preset 3: Fail Edge Firewall */}
        <button
          onClick={() =>
            executeAction('fail-fw', () => onInjectFailure(['FW-01'], 'EDGE_FIREWALL_FAILURE'))
          }
          disabled={!canMutate || !!actionInProgress}
          className="p-4 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-2xl text-left transition group shadow-xs disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-xs font-bold font-mono text-amber-700">
            <span>FAIL FW-01 (FIREWALL)</span>
            <Layers className="w-4 h-4" />
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1.5 leading-relaxed">
            Perimeter firewall outage affecting boundary ingress. Isolated immediately without uninspected traffic.
          </p>
          <span className="inline-block mt-3 text-[10px] font-mono font-bold text-amber-700 group-hover:underline">
            {actionInProgress === 'fail-fw' ? 'INJECTING...' : 'RUN SCENARIO →'}
          </span>
        </button>

        {/* Preset 4: Cascading Failure Burst */}
        <button
          onClick={() =>
            executeAction('fail-burst', () =>
              onInjectFailure(['ENC-01', 'DLP-01', 'IDS-01'], 'CASCADING_BURST')
            )
          }
          disabled={!canMutate || !!actionInProgress}
          className="p-4 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-2xl text-left transition group shadow-xs disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-xs font-bold font-mono text-indigo-700">
            <span>CASCADING BURST</span>
            <Activity className="w-4 h-4" />
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1.5 leading-relaxed">
            Multi-node failure burst triggering ML Isolation Forest radar and raising risk score to CRITICAL.
          </p>
          <span className="inline-block mt-3 text-[10px] font-mono font-bold text-indigo-700 group-hover:underline">
            {actionInProgress === 'fail-burst' ? 'INJECTING...' : 'RUN SCENARIO →'}
          </span>
        </button>
      </div>

      {/* Interactive Control & Mitigation Ribbon */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Reroute Button */}
          <button
            onClick={() => executeAction('reroute', () => onReroute(null))}
            disabled={!canMutate || !!actionInProgress}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold font-mono shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <GitBranch className="w-4 h-4" />
            <span>{actionInProgress === 'reroute' ? 'REROUTING...' : 'AUTO-REROUTE TO SAFE ALTERNATE'}</span>
          </button>

          {/* Reset Baseline */}
          <button
            onClick={() => executeAction('reset', onRecoverAll)}
            disabled={!canMutate || !!actionInProgress}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold font-mono shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>{actionInProgress === 'reset' ? 'RECOVERING...' : 'RECOVER ALL BASELINE'}</span>
          </button>
        </div>

        {/* Traffic Simulation Trigger (clean buttons, no sliders) */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-slate-500 font-bold">Simulate:</span>
          <div className="flex items-center space-x-1">
            {[100, 500, 1000].map((count) => (
              <button
                key={count}
                onClick={() => setSimPackets(count)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition ${
                  simPackets === count
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {count}p
              </button>
            ))}
          </div>
          <button
            onClick={() => executeAction('simulate', () => onSimulateTraffic(simPackets))}
            disabled={!!actionInProgress}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{actionInProgress === 'simulate' ? 'SENDING...' : 'INJECT TRAFFIC'}</span>
          </button>
        </div>
      </div>

      {/* Targeted Custom Node Injection Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 font-mono mb-3 flex items-center space-x-2">
          <Server className="w-4 h-4 text-indigo-600" />
          <span>Granular Node Fault Injection</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-mono text-slate-500 font-bold mb-1">Target Component</label>
            <select
              value={selectedCompId}
              onChange={(e) => setSelectedCompId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400"
            >
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-500 font-bold mb-1">Failure Signature</label>
            <select
              value={failureType}
              onChange={(e) => setFailureType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400"
            >
              <option value="HARDWARE_FAILURE">Hardware Kernel Panic / Crash</option>
              <option value="LATENCY_DEGRADATION">Memory Saturation / Latency Spike</option>
              <option value="CERT_EXPIRATION">Security Certificate Expiration</option>
              <option value="POLICY_CORRUPTION">Policy Table Corruption</option>
            </select>
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={() =>
                executeAction('custom-inject', () => onInjectFailure([selectedCompId], failureType))
              }
              disabled={!canMutate || !!actionInProgress}
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold font-mono transition shadow-xs disabled:opacity-50"
            >
              FAIL NODE
            </button>
            <button
              onClick={() =>
                executeAction('custom-recover', () => onRecoverComponent(selectedCompId))
              }
              disabled={!canMutate || !!actionInProgress}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono transition shadow-xs disabled:opacity-50"
            >
              RECOVER
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Path Impact & Zero Spillover Ledger */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-mono">
              Live Path Status & Targeted Fail-Safe Evidence ({paths.length} Paths)
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Safe paths preserved: <span className="text-emerald-600 font-bold">{safePaths.length}</span> &bull;
              Targeted isolations: <span className="text-rose-600 font-bold">{blockedPaths.length}</span> &bull;
              Safe preservation rate: <span className="text-indigo-600 font-bold">{safePct}%</span>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px]">
                <th className="py-2.5 px-3">PATH ID</th>
                <th className="py-2.5 px-3">FLOW</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">ACTIVE HOPS</th>
                <th className="py-2.5 px-3">DECISION RATIONALE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {paths.map((p) => {
                const isGuaranteed = p.status === 'GUARANTEED';
                const isRerouted = p.status === 'REROUTED';

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{p.id}</td>
                    <td className="py-2.5 px-3">{p.name}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          isGuaranteed
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isRerouted
                            ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[200px]">
                      {p.current_hops.join(' → ')}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-500">{p.decision_reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
