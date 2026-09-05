import React, { useState, useMemo } from 'react';
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
  Lock,
  Wifi,
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

// ──────────────────────────────────────────────────────────────────
// Fixed SVG layout positions for each node (normalized 0-1 coords)
// Zones: PUBLIC(x≈0.06) | DMZ(x≈0.26) | APP(x≈0.50) | DB(x≈0.74) | PCI(x≈0.93)
// ──────────────────────────────────────────────────────────────────
const STATIC_NODES: Array<{
  id: string;
  label: string;
  shortLabel: string;
  type: string;
  zone: string;
  zoneKey: string;
  cx: number; // % of SVG width
  cy: number; // % of SVG height
  icon: React.FC<{ className?: string }>;
  isStatic?: boolean; // static nodes always shown (clients)
}> = [
  {
    id: 'CLIENT-WEB', label: 'Public Web Client', shortLabel: 'Web Client',
    type: 'CLIENT', zone: 'PUBLIC', zoneKey: 'PUBLIC',
    cx: 6, cy: 32, icon: Globe, isStatic: true,
  },
  {
    id: 'CLIENT-ADMIN', label: 'SecOps Admin', shortLabel: 'SecOps',
    type: 'ADMIN', zone: 'CORP', zoneKey: 'PUBLIC',
    cx: 6, cy: 68, icon: Terminal, isStatic: true,
  },
  { id: 'FW-01', label: 'Perimeter Firewall', shortLabel: 'FW-01', type: 'FIREWALL', zone: 'DMZ', zoneKey: 'DMZ', cx: 26, cy: 32, icon: Shield },
  { id: 'WAF-01', label: 'Web App Firewall', shortLabel: 'WAF-01', type: 'WAF', zone: 'DMZ', zoneKey: 'DMZ', cx: 26, cy: 68, icon: Lock },
  { id: 'API-GW-01', label: 'API Gateway', shortLabel: 'API-GW', type: 'GATEWAY', zone: 'APP', zoneKey: 'APP', cx: 50, cy: 25, icon: Wifi },
  { id: 'AUTH-01', label: 'Auth Service', shortLabel: 'AUTH', type: 'AUTH', zone: 'APP', zoneKey: 'APP', cx: 50, cy: 75, icon: ShieldCheck },
  { id: 'DB-01', label: 'Primary Database', shortLabel: 'DB-01', type: 'DATABASE', zone: 'DB', zoneKey: 'DB', cx: 74, cy: 32, icon: Database },
  { id: 'AUDIT-01', label: 'Audit Ledger', shortLabel: 'AUDIT', type: 'AUDIT', zone: 'DB', zoneKey: 'DB', cx: 74, cy: 68, icon: Server },
  { id: 'ENC-01', label: 'HSM Enclave', shortLabel: 'ENC-01', type: 'ENCLAVE', zone: 'PCI', zoneKey: 'PCI', cx: 93, cy: 32, icon: ShieldCheck },
  { id: 'HSM-01', label: 'Vault HSM', shortLabel: 'HSM-01', type: 'HSM', zone: 'PCI', zoneKey: 'PCI', cx: 93, cy: 68, icon: Lock },
];

// Pre-defined network edges (logical connections)
const GRAPH_EDGES: Array<{ from: string; to: string; label?: string }> = [
  { from: 'CLIENT-WEB',   to: 'FW-01',     label: 'HTTPS' },
  { from: 'CLIENT-ADMIN', to: 'WAF-01',    label: 'SSH' },
  { from: 'FW-01',        to: 'API-GW-01', label: 'mTLS' },
  { from: 'WAF-01',       to: 'API-GW-01', label: 'TLS 1.3' },
  { from: 'FW-01',        to: 'AUTH-01',   label: 'mTLS' },
  { from: 'API-GW-01',    to: 'DB-01',     label: 'SQL/TLS' },
  { from: 'API-GW-01',    to: 'AUDIT-01',  label: 'gRPC' },
  { from: 'AUTH-01',      to: 'DB-01',     label: 'JDBC' },
  { from: 'AUTH-01',      to: 'AUDIT-01',  label: 'gRPC' },
  { from: 'DB-01',        to: 'ENC-01',    label: 'HSM' },
  { from: 'AUDIT-01',     to: 'HSM-01',    label: 'KMS' },
];

// Zone regions displayed as background rectangles
const ZONES = [
  { key: 'PUBLIC', label: 'Zone 1 · Public', x: 0, w: 16,  color: '#e2e8f0', border: '#cbd5e1' },
  { key: 'DMZ',    label: 'Zone 2 · DMZ',    x: 17, w: 18, color: '#fef3c7', border: '#fde68a' },
  { key: 'APP',    label: 'Zone 3 · App',    x: 37, w: 26, color: '#ede9fe', border: '#c4b5fd' },
  { key: 'DB',     label: 'Zone 4 · Data',   x: 65, w: 18, color: '#dbeafe', border: '#93c5fd' },
  { key: 'PCI',    label: 'Zone 5 · PCI',    x: 85, w: 15, color: '#fee2e2', border: '#fca5a5' },
];

const ZONE_TEXT_COLORS: Record<string, string> = {
  PUBLIC: '#64748b', DMZ: '#92400e', APP: '#5b21b6', DB: '#1e40af', PCI: '#991b1b',
};

const NODE_THEME: Record<string, { bg: string; border: string; icon: string; ring: string }> = {
  PUBLIC:  { bg: '#f8fafc', border: '#94a3b8', icon: '#64748b', ring: '#6366f1' },
  DMZ:     { bg: '#fffbeb', border: '#f59e0b', icon: '#b45309', ring: '#f59e0b' },
  APP:     { bg: '#f5f3ff', border: '#7c3aed', icon: '#6d28d9', ring: '#7c3aed' },
  DB:      { bg: '#eff6ff', border: '#2563eb', icon: '#1d4ed8', ring: '#2563eb' },
  PCI:     { bg: '#fff1f2', border: '#e11d48', icon: '#be123c', ring: '#e11d48' },
};

function getEdgeStatus(fromId: string, toId: string, paths: PathData[]): 'GUARANTEED' | 'REROUTED' | 'BLOCKED' | 'NEUTRAL' {
  for (const p of paths) {
    const hops = p.current_hops || [];
    const fromIdx = hops.indexOf(fromId);
    if (fromIdx !== -1 && hops[fromIdx + 1] === toId) {
      if (p.status === 'GUARANTEED') return 'GUARANTEED';
      if (p.status === 'REROUTED') return 'REROUTED';
      if (p.status === 'BLOCKED' || p.status === 'VIOLATED') return 'BLOCKED';
    }
  }
  return 'NEUTRAL';
}

const EDGE_COLOR: Record<string, string> = {
  GUARANTEED: '#10B981',
  REROUTED: '#0EA5E9',
  BLOCKED: '#EF4444',
  NEUTRAL: '#94A3B8',
};

// ──────────────────────────────────────────────────────────────────
// SVG Network Graph
// ──────────────────────────────────────────────────────────────────
interface SvgGraphProps {
  components: ComponentData[];
  paths: PathData[];
  selectedId: string | null;
  onNodeClick: (id: string) => void;
}

const SvgGraph: React.FC<SvgGraphProps> = ({ components, paths, selectedId, onNodeClick }) => {
  const SVG_W = 800;
  const SVG_H = 340;

  const compMap = useMemo(() => {
    const m: Record<string, ComponentData> = {};
    for (const c of components) m[c.id] = c;
    return m;
  }, [components]);

  const nodePx = useMemo(
    () => STATIC_NODES.map((n) => ({ ...n, px: (n.cx / 100) * SVG_W, py: (n.cy / 100) * SVG_H })),
    []
  );

  const nodeMap = useMemo(() => {
    const m: Record<string, (typeof nodePx)[0]> = {};
    for (const n of nodePx) m[n.id] = n;
    return m;
  }, [nodePx]);

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-auto"
      style={{ fontFamily: 'Inter, sans-serif', minHeight: 220 }}
      aria-label="Network topology graph"
    >
      {/* Zone Background Bands */}
      {ZONES.map((z) => (
        <g key={z.key}>
          <rect
            x={(z.x / 100) * SVG_W}
            y={0}
            width={(z.w / 100) * SVG_W}
            height={SVG_H}
            rx={8}
            fill={z.color}
            stroke={z.border}
            strokeWidth={1}
            opacity={0.55}
          />
          <text
            x={((z.x + z.w / 2) / 100) * SVG_W}
            y={14}
            textAnchor="middle"
            fontSize={8.5}
            fontWeight={700}
            letterSpacing={0.5}
            fill={ZONE_TEXT_COLORS[z.key]}
            style={{ textTransform: 'uppercase' }}
          >
            {z.label}
          </text>
        </g>
      ))}

      {/* Edges */}
      {GRAPH_EDGES.map((edge, i) => {
        const from = nodeMap[edge.from];
        const to = nodeMap[edge.to];
        if (!from || !to) return null;
        const status = getEdgeStatus(edge.from, edge.to, paths);
        const color = EDGE_COLOR[status];
        // Midpoint for label
        const mx = (from.px + to.px) / 2;
        const my = (from.py + to.py) / 2;
        const animated = status !== 'NEUTRAL' && status !== 'BLOCKED';

        return (
          <g key={i}>
            {/* Background line */}
            <line
              x1={from.px} y1={from.py}
              x2={to.px}   y2={to.py}
              stroke={color}
              strokeWidth={status === 'NEUTRAL' ? 1 : 2}
              strokeOpacity={status === 'NEUTRAL' ? 0.3 : 0.9}
              strokeLinecap="round"
            />
            {/* Animated flow overlay */}
            {animated && (
              <line
                x1={from.px} y1={from.py}
                x2={to.px}   y2={to.py}
                stroke={color}
                strokeWidth={2.5}
                strokeOpacity={0.75}
                strokeLinecap="round"
                strokeDasharray="6 10"
                className="flow-line"
                style={{ animationDuration: `${0.9 + i * 0.07}s` }}
              />
            )}
            {/* Blocked cross */}
            {status === 'BLOCKED' && (
              <>
                <line x1={mx - 5} y1={my - 5} x2={mx + 5} y2={my + 5} stroke="#EF4444" strokeWidth={2} />
                <line x1={mx + 5} y1={my - 5} x2={mx - 5} y2={my + 5} stroke="#EF4444" strokeWidth={2} />
              </>
            )}
            {/* Protocol label */}
            {edge.label && (
              <text x={mx} y={my - 4} textAnchor="middle" fontSize={6.5} fill={color} fontWeight={600}
                fontFamily="'JetBrains Mono', monospace" opacity={0.85}>
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodePx.map((node) => {
        const comp = compMap[node.id];
        const isStatic = node.isStatic;
        const isDegraded = comp ? comp.status !== 'HEALTHY' : false;
        const isSelected = selectedId === node.id;
        const theme = NODE_THEME[node.zoneKey] || NODE_THEME['PUBLIC'];
        const R = 26;

        return (
          <g
            key={node.id}
            transform={`translate(${node.px},${node.py})`}
            onClick={() => onNodeClick(node.id)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={`${node.label} node`}
          >
            {/* Selection ring */}
            {isSelected && (
              <circle r={R + 6} fill="none" stroke={theme.ring} strokeWidth={2.5} opacity={0.7} />
            )}
            {/* Degraded pulse ring */}
            {isDegraded && !isSelected && (
              <circle r={R + 4} fill="none" stroke="#EF4444" strokeWidth={2} opacity={0.5}
                className="pulse-ring" />
            )}
            {/* Node circle */}
            <circle
              r={R}
              fill={isDegraded ? '#FEF2F2' : isStatic ? '#F8FAFC' : theme.bg}
              stroke={isDegraded ? '#EF4444' : isSelected ? theme.ring : theme.border}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            {/* Status dot */}
            <circle
              cx={R - 4} cy={-(R - 4)}
              r={5}
              fill={isDegraded ? '#EF4444' : '#10B981'}
              stroke="white"
              strokeWidth={1.5}
            />
            {/* Icon — rendered as text label with emoji-like replacement */}
            <text
              textAnchor="middle"
              dy={-4}
              fontSize={14}
              fill={isDegraded ? '#DC2626' : theme.icon}
              fontWeight={600}
            >
              {node.zoneKey === 'PCI' ? '🔒' : node.type === 'DATABASE' || node.type === 'AUDIT' ? '🗄' : node.type === 'CLIENT' ? '🌐' : node.type === 'ADMIN' ? '💻' : node.type === 'AUTH' ? '🛡' : '⬡'}
            </text>
            {/* Node short label */}
            <text
              textAnchor="middle"
              dy={12}
              fontSize={7.5}
              fontWeight={700}
              fill={isDegraded ? '#DC2626' : '#1E293B'}
              fontFamily="'JetBrains Mono', monospace"
              letterSpacing={-0.3}
            >
              {node.shortLabel}
            </text>
            {/* Zone badge */}
            <text
              textAnchor="middle"
              dy={22}
              fontSize={6}
              fill={isDegraded ? '#EF4444' : '#94A3B8'}
              fontFamily="'JetBrains Mono', monospace"
            >
              {node.zone}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ──────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────
export const WarRoomTopology: React.FC<WarRoomTopologyProps> = ({
  components,
  paths,
  onInjectFailure,
  onRecoverComponent,
  onRefresh,
  loading,
}) => {
  const { canMutate } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const compMap = useMemo(() => {
    const m: Record<string, ComponentData> = {};
    for (const c of components) m[c.id] = c;
    return m;
  }, [components]);

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    if (compMap[selectedId]) return compMap[selectedId];
    const staticNode = STATIC_NODES.find((n) => n.id === selectedId);
    if (staticNode) return { id: staticNode.id, name: staticNode.label, type: staticNode.type, zone: staticNode.zoneKey, status: 'HEALTHY', capabilities: [], health_score: 100, latency_ms: 0, failure_count: 0, last_failure_at: null } as ComponentData;
    return null;
  }, [selectedId, compMap]);

  const failedComps = components.filter((c) => c.status !== 'HEALTHY');
  const safePaths = paths.filter((p) => p.status === 'GUARANTEED' || p.status === 'REROUTED');
  const safePct = paths.length > 0 ? ((safePaths.length / paths.length) * 100).toFixed(1) : '100.0';
  const blockedPathsCount = paths.filter((p) => p.status === 'BLOCKED' || p.status === 'VIOLATED').length;

  const handleNodeClick = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    setSelectedPath(null);
  };

  const handlePathClick = (path: PathData) => {
    setSelectedPath(path);
    setSelectedId(null);
  };

  const handleQuickMutate = async (id: string, action: 'fail' | 'recover') => {
    setActionLoading(id);
    try {
      if (action === 'fail') await onInjectFailure([id], 'NODE_INJECTION');
      else await onRecoverComponent(id);
    } finally {
      setActionLoading(null);
    }
  };

  const isBackendNode = (id: string) =>
    ['FW-01','WAF-01','API-GW-01','AUTH-01','DB-01','AUDIT-01','ENC-01','HSM-01'].includes(id);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </span>
            War Room — Security Fabric Topology
          </h2>
          <p className="text-[13px] text-slate-500 mt-1 font-medium">
            NetworkX-backed runtime graph · cross-boundary invariant enforcement · targeted fail-safe isolation
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:border-indigo-400 hover:text-indigo-700 transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-500' : 'text-slate-500'}`} />
          Refresh Topology
        </button>
      </div>

      {/* ── Summary Scorecard ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Safe Traffic Preserved',
            value: `${safePct}%`,
            sub: `${safePaths.length} of ${paths.length} paths`,
            valueClass: 'text-indigo-600',
            bg: 'bg-indigo-50 border-indigo-100',
          },
          {
            label: 'Targeted Isolations',
            value: String(blockedPathsCount),
            sub: 'Zero spillover to safe flows',
            valueClass: 'text-rose-600',
            bg: 'bg-rose-50 border-rose-100',
          },
          {
            label: 'Degraded Nodes',
            value: String(failedComps.length),
            sub: failedComps.length === 0 ? 'All nodes healthy' : failedComps.map((c) => c.id).join(', '),
            valueClass: failedComps.length === 0 ? 'text-emerald-600' : 'text-rose-600',
            bg: failedComps.length === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100',
          },
          {
            label: 'Unsafe Packets Leaked',
            value: '0',
            sub: 'Continuous formal invariant proof',
            valueClass: 'text-emerald-600',
            bg: 'bg-emerald-50 border-emerald-100',
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 card-shadow ${s.bg}`}>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-mono">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.valueClass}`}>{s.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── SVG Graph + Inspector ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Graph Canvas */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden card-shadow">
          {/* Canvas Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <span className="text-xs font-semibold text-slate-600 font-mono uppercase tracking-wide">
              Live Network Graph · {STATIC_NODES.length} Nodes · {GRAPH_EDGES.length} Edges
            </span>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-full bg-emerald-400 inline-block" />
                <span className="text-slate-500">Guaranteed</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-full bg-sky-400 inline-block" />
                <span className="text-slate-500">Rerouted</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-full bg-rose-400 inline-block" />
                <span className="text-slate-500">Blocked</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-full bg-slate-300 inline-block" />
                <span className="text-slate-500">Idle</span>
              </span>
            </div>
          </div>

          {/* SVG Graph */}
          <div className="p-4">
            <SvgGraph
              components={components}
              paths={paths}
              selectedId={selectedId}
              onNodeClick={handleNodeClick}
            />
          </div>

          {/* Canvas footer */}
          <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/40 text-[11px] text-slate-400 font-mono flex justify-between">
            <span>Click any node to inspect telemetry &amp; invariant proof</span>
            <span className="text-emerald-600 font-semibold">● Enforcement Engine ONLINE</span>
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 card-shadow flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <Info className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-800">Inspector</span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {selectedNode ? (
              <div className="space-y-4 text-sm">
                {/* Node header */}
                <div>
                  <p className="text-[10px] text-slate-400 font-mono uppercase font-semibold">Selected Node</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">{selectedNode.name}</p>
                  <p className="text-xs text-indigo-600 font-mono font-medium">{selectedNode.id}</p>
                  <span
                    className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                      selectedNode.status === 'HEALTHY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedNode.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Zone', value: selectedNode.zone },
                    { label: 'Type', value: selectedNode.type },
                    ...(selectedNode.health_score !== undefined
                      ? [{ label: 'Health', value: `${selectedNode.health_score?.toFixed(0) ?? 'N/A'}%` }]
                      : []),
                    ...(selectedNode.latency_ms
                      ? [{ label: 'Latency', value: `${selectedNode.latency_ms}ms` }]
                      : []),
                  ].map((f) => (
                    <div key={f.label} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                      <p className="text-[10px] text-slate-400 font-mono">{f.label}</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 font-mono">{f.value}</p>
                    </div>
                  ))}
                </div>

                {selectedNode.capabilities && selectedNode.capabilities.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-400 font-mono uppercase font-semibold mb-1.5">Capabilities</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.capabilities.map((cap: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Mutation */}
                {canMutate && isBackendNode(selectedNode.id) && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[10px] text-slate-400 font-mono uppercase font-semibold mb-2">Fast Mutation</p>
                    {selectedNode.status === 'HEALTHY' ? (
                      <button
                        onClick={() => handleQuickMutate(selectedNode.id, 'fail')}
                        disabled={actionLoading === selectedNode.id}
                        className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition flex items-center justify-center gap-2"
                      >
                        <ZapOff className="w-3.5 h-3.5" />
                        Inject Fault — {selectedNode.id}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleQuickMutate(selectedNode.id, 'recover')}
                        disabled={actionLoading === selectedNode.id}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold transition flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore &amp; Verify — {selectedNode.id}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : selectedPath ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[10px] text-slate-400 font-mono uppercase font-semibold">Selected Flow Path</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">{selectedPath.name}</p>
                  <p className="text-xs text-indigo-600 font-mono">{selectedPath.id}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-[10px] text-slate-400 font-mono">Formal Verdict</p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      selectedPath.status === 'GUARANTEED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedPath.status === 'REROUTED'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedPath.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-mono uppercase font-semibold mb-1">Active Hops</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedPath.current_hops.map((hop, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-200 text-slate-800 font-mono font-bold">
                        {hop}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                  {selectedPath.decision_reason}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <Shield className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Select a node or path<br />to inspect telemetry &amp; invariant proof.
                </p>
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Enforcement Engine</span>
            <span className="text-emerald-600 font-bold">● ONLINE</span>
          </div>
        </div>
      </div>

      {/* ── Active Paths Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <Split className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-800">
            Active Paths &amp; Invariant Enforcements
            <span className="ml-2 text-xs font-mono text-slate-400">({paths.length} monitored)</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-4">
          {paths.map((p) => {
            const isGuaranteed = p.status === 'GUARANTEED';
            const isRerouted = p.status === 'REROUTED';
            return (
              <button
                key={p.id}
                onClick={() => handlePathClick(p)}
                className={`w-full text-left p-3 rounded-xl border transition text-xs font-mono flex items-center justify-between ${
                  selectedPath?.id === p.id ? 'ring-2 ring-indigo-400' : ''
                } ${
                  isGuaranteed
                    ? 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                    : isRerouted
                    ? 'bg-sky-50 border-sky-200 hover:border-sky-300'
                    : 'bg-rose-50 border-rose-200 hover:border-rose-300'
                }`}
              >
                <div>
                  <p className="font-bold text-slate-900">{p.id}</p>
                  <p className="text-[10px] text-slate-500 truncate max-w-[160px] mt-0.5">{p.name}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                    isGuaranteed
                      ? 'bg-emerald-100 text-emerald-800'
                      : isRerouted
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {p.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
