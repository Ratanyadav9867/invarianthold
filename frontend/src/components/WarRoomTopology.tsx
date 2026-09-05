import React, { useState } from 'react';
import {
  Globe,
  Terminal,
  Server,
  Database,
  Shield,
  ShieldCheck,
  ZapOff,
  RotateCcw,
  RefreshCw,
  Info,
  Split,
} from 'lucide-react';
import { ComponentData, PathData, InvariantData } from '../types';
import { useAuth } from '../context/AuthContext';

interface WarRoomTopologyProps {
  components: ComponentData[];
  paths: PathData[];
  invariants?: InvariantData[];
  onInjectFailure: (compIds: string[], type?: string) => Promise<void>;
  onRecoverComponent: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  loading: boolean;
}

export const WarRoomTopology: React.FC<WarRoomTopologyProps> = ({
  components,
  paths,
  onInjectFailure,
  onRecoverComponent,
  onRefresh,
  loading,
}) => {
  const { canMutate } = useAuth();
  const [selectedNode, setSelectedNode] = useState<ComponentData | any | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Stats calculation
  const failedComps = components.filter((c) => c.status !== 'HEALTHY');
  const safePaths = paths.filter((p) => p.status === 'GUARANTEED' || p.status === 'REROUTED');
  const safePct = paths.length > 0 ? ((safePaths.length / paths.length) * 100).toFixed(1) : '100.0';
  const blockedPathsCount = paths.filter((p) => p.status === 'BLOCKED' || p.status === 'VIOLATED').length;

  const handleNodeClick = (comp: ComponentData | any) => {
    setSelectedNode(comp);
    setSelectedPath(null);
  };

  const handlePathClick = (path: PathData) => {
    setSelectedPath(path);
    setSelectedNode(null);
  };

  const handleQuickMutate = async (id: string, action: 'fail' | 'recover') => {
    setActionLoading(id);
    try {
      if (action === 'fail') {
        await onInjectFailure([id], 'NODE_INJECTION');
      } else {
        await onRecoverComponent(id);
      }
      // Re-select component after mutation
      const updated = components.find((c) => c.id === id);
      if (updated) setSelectedNode(updated);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with quick stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 font-mono flex items-center space-x-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <span>WAR ROOM & SECURITY FABRIC TOPOLOGY</span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            NetworkX-backed runtime graph mapping cross-boundary invariants and targeted isolation boundaries.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-mono flex items-center space-x-1.5 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
            <span>REFRESH TOPOLOGY</span>
          </button>
        </div>
      </div>

      {/* Summary Scorecard Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Preserved Safe Traffic</span>
          <div className="text-2xl font-black text-indigo-600 mt-1">{safePct}%</div>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            {safePaths.length} of {paths.length} active paths
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Targeted Isolations</span>
          <div className="text-2xl font-black text-rose-600 mt-1">{blockedPathsCount}</div>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">Zero spillover to safe flows</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Degraded Components</span>
          <div
            className={`text-2xl font-black mt-1 ${
              failedComps.length === 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {failedComps.length}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            {failedComps.length === 0 ? 'All 8 nodes healthy' : failedComps.map((c) => c.id).join(', ')}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Unsafe Packets Leaked</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">0</div>
          <p className="text-[11px] text-emerald-700 font-mono mt-0.5">Continuous formal invariant proof</p>
        </div>
      </div>

      {/* Main Graph Grid & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Topology Visual Canvas (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 min-h-[500px] flex flex-col justify-between relative shadow-xs overflow-x-auto">
          {/* Zone Columns Header */}
          <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-mono font-bold text-slate-600 border-b border-slate-200 pb-2.5 mb-4">
            <div className="px-2 py-1 rounded-lg bg-slate-100">ZONE 1: CLIENTS</div>
            <div className="px-2 py-1 rounded-lg bg-slate-100">ZONE 2: DMZ GATEWAYS</div>
            <div className="px-2 py-1 rounded-lg bg-slate-100">ZONE 3: APPLICATION</div>
            <div className="px-2 py-1 rounded-lg bg-slate-100">ZONE 4: DATABASE</div>
            <div className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
              ZONE 5: PCI ENCLAVE
            </div>
          </div>

          {/* Graphical Node Matrix */}
          <div className="grid grid-cols-5 gap-3 sm:gap-4 my-auto py-4">
            {/* Col 1: Internet & Admin Clients */}
            <div className="flex flex-col space-y-4 items-center justify-center">
              <div
                onClick={() =>
                  handleNodeClick({
                    id: 'CLIENT-WEB',
                    name: 'Public Internet Client',
                    type: 'CLIENT',
                    zone: 'PUBLIC',
                    status: 'HEALTHY',
                    capabilities: ['HTTP_TRAFFIC', 'TLS_HANDSHAKE'],
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-400 cursor-pointer transition text-center shadow-xs"
              >
                <Globe className="w-5 h-5 mx-auto text-indigo-600 mb-1" />
                <div className="text-[11px] font-bold text-slate-800 font-mono">Public Web</div>
                <span className="text-[9px] text-slate-500 font-mono">Zone: PUBLIC</span>
              </div>

              <div
                onClick={() =>
                  handleNodeClick({
                    id: 'CLIENT-ADMIN',
                    name: 'Corporate Admin Workstation',
                    type: 'ADMIN',
                    zone: 'CORPORATE',
                    status: 'HEALTHY',
                    capabilities: ['SSH_ACCESS', 'MFA_AUTHENTICATED'],
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-400 cursor-pointer transition text-center shadow-xs"
              >
                <Terminal className="w-5 h-5 mx-auto text-cyan-600 mb-1" />
                <div className="text-[11px] font-bold text-slate-800 font-mono">SecOps Admin</div>
                <span className="text-[9px] text-slate-500 font-mono">Zone: CORP</span>
              </div>
            </div>

            {/* Col 2: DMZ (FW-01, WAF-01) */}
            <div className="flex flex-col space-y-4 items-center justify-center">
              {components
                .filter((c) => c.zone === 'DMZ')
                .map((comp) => {
                  const isDegraded = comp.status !== 'HEALTHY';
                  const isSelected = selectedNode?.id === comp.id;

                  return (
                    <div
                      key={comp.id}
                      onClick={() => handleNodeClick(comp)}
                      className={`w-full p-3 rounded-xl border cursor-pointer transition relative text-center shadow-xs ${
                        isSelected ? 'ring-2 ring-indigo-500' : ''
                      } ${
                        isDegraded
                          ? 'bg-rose-50 border-rose-300 animate-pulse text-rose-900'
                          : 'bg-white border-slate-200 hover:border-indigo-400 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {comp.id}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${isDegraded ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                      <Server className={`w-5 h-5 mx-auto my-1 ${isDegraded ? 'text-rose-600' : 'text-slate-700'}`} />
                      <div className="text-[11px] font-bold font-mono truncate">{comp.name}</div>
                      <span className="text-[9px] text-slate-500 font-mono">{comp.type}</span>
                    </div>
                  );
                })}
            </div>

            {/* Col 3: APP (API-GW-01, AUTH-01) */}
            <div className="flex flex-col space-y-4 items-center justify-center">
              {components
                .filter((c) => c.zone === 'APP')
                .map((comp) => {
                  const isDegraded = comp.status !== 'HEALTHY';
                  const isSelected = selectedNode?.id === comp.id;

                  return (
                    <div
                      key={comp.id}
                      onClick={() => handleNodeClick(comp)}
                      className={`w-full p-3 rounded-xl border cursor-pointer transition relative text-center shadow-xs ${
                        isSelected ? 'ring-2 ring-indigo-500' : ''
                      } ${
                        isDegraded
                          ? 'bg-rose-50 border-rose-300 animate-pulse text-rose-900'
                          : 'bg-white border-slate-200 hover:border-indigo-400 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {comp.id}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${isDegraded ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                      <Server className={`w-5 h-5 mx-auto my-1 ${isDegraded ? 'text-rose-600' : 'text-slate-700'}`} />
                      <div className="text-[11px] font-bold font-mono truncate">{comp.name}</div>
                      <span className="text-[9px] text-slate-500 font-mono">{comp.type}</span>
                    </div>
                  );
                })}
            </div>

            {/* Col 4: DB (DB-01, AUDIT-01) */}
            <div className="flex flex-col space-y-4 items-center justify-center">
              {components
                .filter((c) => c.zone === 'DB')
                .map((comp) => {
                  const isDegraded = comp.status !== 'HEALTHY';
                  const isSelected = selectedNode?.id === comp.id;

                  return (
                    <div
                      key={comp.id}
                      onClick={() => handleNodeClick(comp)}
                      className={`w-full p-3 rounded-xl border cursor-pointer transition relative text-center shadow-xs ${
                        isSelected ? 'ring-2 ring-indigo-500' : ''
                      } ${
                        isDegraded
                          ? 'bg-rose-50 border-rose-300 animate-pulse text-rose-900'
                          : 'bg-white border-slate-200 hover:border-indigo-400 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {comp.id}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${isDegraded ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                      <Database className={`w-5 h-5 mx-auto my-1 ${isDegraded ? 'text-rose-600' : 'text-slate-700'}`} />
                      <div className="text-[11px] font-bold font-mono truncate">{comp.name}</div>
                      <span className="text-[9px] text-slate-500 font-mono">{comp.type}</span>
                    </div>
                  );
                })}
            </div>

            {/* Col 5: PCI ENCLAVE (ENC-01, HSM-01) */}
            <div className="flex flex-col space-y-4 items-center justify-center">
              {components
                .filter((c) => c.zone === 'PCI')
                .map((comp) => {
                  const isDegraded = comp.status !== 'HEALTHY';
                  const isSelected = selectedNode?.id === comp.id;

                  return (
                    <div
                      key={comp.id}
                      onClick={() => handleNodeClick(comp)}
                      className={`w-full p-3 rounded-xl border cursor-pointer transition relative text-center shadow-xs ${
                        isSelected ? 'ring-2 ring-indigo-500' : ''
                      } ${
                        isDegraded
                          ? 'bg-rose-50 border-rose-300 animate-pulse text-rose-900'
                          : 'bg-rose-50/40 border-rose-200 hover:border-rose-400 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                          {comp.id}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${isDegraded ? 'bg-rose-600' : 'bg-emerald-500'}`}
                        />
                      </div>
                      <ShieldCheck className={`w-5 h-5 mx-auto my-1 ${isDegraded ? 'text-rose-600' : 'text-rose-700'}`} />
                      <div className="text-[11px] font-bold font-mono truncate">{comp.name}</div>
                      <span className="text-[9px] text-rose-600 font-mono font-semibold">PCI ENCLAVE</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Canvas Footer Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 text-[10px] font-mono text-slate-500">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Healthy Enforcer</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Isolated/Degraded</span>
              </span>
            </div>
            <span className="text-slate-400">Click any component or path below to inspect policy proof</span>
          </div>
        </div>

        {/* Right Side Inspector (1 col) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-mono flex items-center space-x-2 border-b border-slate-200 pb-2 mb-3">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>Inspector Panel</span>
            </h3>

            {selectedNode ? (
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Selected Node</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center justify-between">
                    <span>{selectedNode.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        selectedNode.status === 'HEALTHY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedNode.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-600 font-semibold">{selectedNode.id}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 text-[10px]">Zone</span>
                    <div className="font-bold text-slate-800">{selectedNode.zone}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 text-[10px]">Type</span>
                    <div className="font-bold text-slate-800">{selectedNode.type}</div>
                  </div>
                </div>

                {selectedNode.capabilities && (
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Capabilities</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedNode.capabilities.map((cap: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Chaos Buttons for Selected Node */}
                {canMutate && selectedNode.id && selectedNode.id.startsWith('FW') ||
                selectedNode.id.startsWith('WAF') ||
                selectedNode.id.startsWith('API') ||
                selectedNode.id.startsWith('AUTH') ||
                selectedNode.id.startsWith('DB') ||
                selectedNode.id.startsWith('AUDIT') ||
                selectedNode.id.startsWith('ENC') ||
                selectedNode.id.startsWith('HSM') ? (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">
                      Fast Mutation Controls
                    </span>
                    {selectedNode.status === 'HEALTHY' ? (
                      <button
                        onClick={() => handleQuickMutate(selectedNode.id, 'fail')}
                        disabled={actionLoading === selectedNode.id}
                        className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold transition flex items-center justify-center space-x-2"
                      >
                        <ZapOff className="w-3.5 h-3.5" />
                        <span>Inject Fault into {selectedNode.id}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleQuickMutate(selectedNode.id, 'recover')}
                        disabled={actionLoading === selectedNode.id}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition flex items-center justify-center space-x-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore & Verify {selectedNode.id}</span>
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ) : selectedPath ? (
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Selected Flow Path</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedPath.name}</div>
                  <span className="text-[11px] text-indigo-600 font-semibold">{selectedPath.id}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400">Formal Verdict</span>
                  <div className="font-bold text-sm mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-black ${
                        selectedPath.status === 'GUARANTEED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedPath.status === 'REROUTED'
                          ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedPath.status}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Active Hops</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedPath.current_hops.map((hop, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-300 text-slate-800 font-bold"
                      >
                        {hop}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {selectedPath.decision_reason}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs font-mono">
                <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>Select any node or flow path to view telemetry & formal invariant proof.</p>
              </div>
            )}
          </div>

          <div className="text-[10px] font-mono text-slate-400 border-t border-slate-200 pt-2 flex items-center justify-between">
            <span>Enforcement Engine</span>
            <span className="text-emerald-700 font-bold">ONLINE</span>
          </div>
        </div>
      </div>

      {/* Monitored Paths Ribbon */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 font-mono mb-3 flex items-center space-x-2">
          <Split className="w-4 h-4 text-indigo-600" />
          <span>Active Paths & Invariant Enforcements ({paths.length})</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {paths.map((p) => {
            const isGuaranteed = p.status === 'GUARANTEED';
            const isRerouted = p.status === 'REROUTED';

            return (
              <div
                key={p.id}
                onClick={() => handlePathClick(p)}
                className={`p-3 rounded-xl border cursor-pointer transition text-xs font-mono flex items-center justify-between shadow-xs ${
                  selectedPath?.id === p.id ? 'ring-2 ring-indigo-500' : ''
                } ${
                  isGuaranteed
                    ? 'bg-slate-50/70 border-slate-200 hover:border-emerald-400 text-slate-800'
                    : isRerouted
                    ? 'bg-cyan-50 border-cyan-200 hover:border-cyan-400 text-cyan-900'
                    : 'bg-rose-50 border-rose-200 hover:border-rose-400 text-rose-900'
                }`}
              >
                <div>
                  <div className="font-bold">{p.id}</div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[170px]">{p.name}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    isGuaranteed
                      ? 'bg-emerald-100 text-emerald-800'
                      : isRerouted
                      ? 'bg-cyan-100 text-cyan-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {p.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
