import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
} from 'lucide-react';
import { InvariantData, PathData, ComponentData } from '../types';

interface InvariantProverProps {
  invariants: InvariantData[];
  paths: PathData[];
  components?: ComponentData[];
  onVerifyInvariants: () => Promise<any>;
  loading?: boolean;
}

export const InvariantProver: React.FC<InvariantProverProps> = ({
  invariants,
  paths,
  onVerifyInvariants,
}) => {
  const [selectedInv, setSelectedInv] = useState<InvariantData | null>(invariants[0] || null);
  const [verifying, setVerifying] = useState(false);
  const [verifySummary, setVerifySummary] = useState<any | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await onVerifyInvariants();
      setVerifySummary(res);
    } finally {
      setVerifying(false);
    }
  };

  const getVerdictBadge = (status: string) => {
    switch (status) {
      case 'GUARANTEED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>GUARANTEED</span>
          </span>
        );
      case 'REROUTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-cyan-100 text-cyan-800 border border-cyan-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>REROUTED (GUARANTEED)</span>
          </span>
        );
      case 'VIOLATED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5" />
            <span>VIOLATED</span>
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
            <Lock className="w-3.5 h-3.5" />
            <span>TARGETED BLOCK</span>
          </span>
        );
      case 'NO_POLICY':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>NO POLICY (UNSAFE)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{status}</span>
          </span>
        );
    }
  };

  const currentActiveInv = selectedInv || invariants[0];
  const boundPaths = currentActiveInv
    ? paths.filter((p) => p.applicable_invariant_id === currentActiveInv.id)
    : [];
  const anyBroken = boundPaths.some((p) => p.status === 'BLOCKED' || p.status === 'VIOLATED');
  const overallVerdict = anyBroken ? 'BLOCKED' : 'GUARANTEED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 font-mono flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>DETERMINISTIC INVARIANT PROVER</span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Cryptographically binding formal security constraints. Machine learning is advisory; only invariant proofs
            authorise traffic.
          </p>
        </div>

        <button
          onClick={handleVerify}
          disabled={verifying}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-mono font-bold rounded-xl shadow-xs flex items-center space-x-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
          <span>{verifying ? 'PROVING...' : 'RUN INVARIANT VERIFIER'}</span>
        </button>
      </div>

      {/* Verification Result Banner if available */}
      {verifySummary && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between font-mono text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <strong className="text-emerald-950 block text-sm">Deterministic Invariant Verification Complete</strong>
              <span>
                Guaranteed Paths: {verifySummary.guaranteed} / {verifySummary.total_paths} &bull; Safe Traffic Preserved:{' '}
                {verifySummary.safe_path_preservation_pct}%
              </span>
            </div>
          </div>
          <button onClick={() => setVerifySummary(null)} className="text-emerald-700 hover:text-emerald-950 text-sm">
            &times;
          </button>
        </div>
      )}

      {/* Invariants Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {invariants.map((inv) => {
          const invPaths = paths.filter((p) => p.applicable_invariant_id === inv.id);
          const hasBroken = invPaths.some((p) => p.status === 'BLOCKED' || p.status === 'VIOLATED');
          const isSelected = currentActiveInv?.id === inv.id;

          return (
            <div
              key={inv.id}
              onClick={() => setSelectedInv(inv)}
              className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between shadow-xs ${
                isSelected ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/40' : ''
              } ${
                hasBroken
                  ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300'
                  : 'bg-white border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-mono font-bold">
                    {inv.id}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      inv.severity === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {inv.severity}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 font-mono leading-snug">{inv.name}</h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{inv.description}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">{invPaths.length} dependent path(s)</span>
                <span
                  className={`text-[10px] font-mono font-bold ${
                    hasBroken ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {hasBroken ? 'BLOCKED' : 'GUARANTEED'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deep Inspection Panel for Selected Invariant */}
      {currentActiveInv && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900 font-mono">{currentActiveInv.name}</h3>
                <span className="text-xs text-slate-500 font-mono">({currentActiveInv.id})</span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-1">{currentActiveInv.description}</p>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono text-slate-500">Current Security Verdict:</span>
              {getVerdictBadge(overallVerdict)}
            </div>
          </div>

          {/* Policy Breakdown Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {/* Required Controls */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Mandated Controls (Non-Bypassable)</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentActiveInv.required_controls.map((ctrl, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded font-bold"
                  >
                    {ctrl}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 pt-1">
                Every packet along evaluated hops must traverse these enforcement types.
              </p>
            </div>

            {/* Scope: Source and Destination Zones */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>Boundary Protection Scope</span>
              </span>
              <div className="text-[11px] text-slate-700 space-y-1 pt-1">
                <div>
                  <span className="text-slate-500">Source Zones: </span>
                  <span className="text-amber-800 font-bold">{currentActiveInv.source_zones.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Target Zones: </span>
                  <span className="text-amber-800 font-bold">{currentActiveInv.destination_zones.join(', ')}</span>
                </div>
              </div>
            </div>

            {/* Forbidden Conditions */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Prohibited Vectors</span>
              </span>
              <div className="flex flex-wrap gap-1 pt-1">
                {currentActiveInv.forbidden_conditions.map((fc, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-[10px] font-bold"
                  >
                    {fc}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bound Paths Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 font-mono uppercase mb-2">
              Monitored Traffic Paths for {currentActiveInv.id} ({boundPaths.length})
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px]">
                    <th className="py-2.5 px-3">PATH ID</th>
                    <th className="py-2.5 px-3">FLOW NAME</th>
                    <th className="py-2.5 px-3">VERDICT</th>
                    <th className="py-2.5 px-3">ACTIVE HOPS</th>
                    <th className="py-2.5 px-3">MATHEMATICAL REASON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {boundPaths.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{p.id}</td>
                      <td className="py-2.5 px-3">{p.name}</td>
                      <td className="py-2.5 px-3">{getVerdictBadge(p.status)}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[200px]">
                        {p.current_hops.join(' → ')}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500">{p.decision_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
