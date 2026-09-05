import React, { useState } from 'react';
import {
  Terminal,
  Play,
  Copy,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface EndpointPreset {
  name: string;
  method: 'GET' | 'POST';
  url: string;
  description: string;
  defaultBody?: string;
  requiresAuth: boolean;
}

const PRESETS: EndpointPreset[] = [
  {
    name: 'Health Check',
    method: 'GET',
    url: '/health',
    description: 'System-wide health probe checking all 7 operational subsystems',
    requiresAuth: false,
  },
  {
    name: 'List Components',
    method: 'GET',
    url: '/api/components',
    description: 'Returns all 8 operational and security enforcement points',
    requiresAuth: false,
  },
  {
    name: 'Inject Failure (Chaos)',
    method: 'POST',
    url: '/api/failures/inject',
    description: 'Fails targeted components and triggers immediate fail-safe isolation',
    defaultBody: JSON.stringify({ component_ids: ['ENC-01'], failure_type: 'PRIMARY_ENCRYPTION_FAIL' }, null, 2),
    requiresAuth: true,
  },
  {
    name: 'Execute Safe Reroute',
    method: 'POST',
    url: '/api/reroute',
    description: 'Migrates blocked flows to compliant alternate paths verified by Invariant Engine',
    defaultBody: JSON.stringify({ path_id: null }, null, 2),
    requiresAuth: true,
  },
  {
    name: 'Simulate Traffic',
    method: 'POST',
    url: '/api/traffic/simulate',
    description: 'Simulates synthetic packets and calculates zero-leakage safety proof',
    defaultBody: JSON.stringify({ packet_count: 500 }, null, 2),
    requiresAuth: true,
  },
  {
    name: 'Verify Invariant Policies',
    method: 'POST',
    url: '/api/invariants/verify',
    description: 'Mathematically verifies all paths against security invariants',
    requiresAuth: false,
  },
  {
    name: 'ML Anomaly Telemetry',
    method: 'GET',
    url: '/api/ai/anomalies?scenario=NORMAL',
    description: 'Fetches scikit-learn Isolation Forest telemetry and risk score',
    requiresAuth: false,
  },
  {
    name: 'Verify SHA-256 Ledger',
    method: 'POST',
    url: '/api/audit/verify',
    description: 'Validates forward-chained cryptographic block integrity',
    requiresAuth: false,
  },
  {
    name: 'Explain Security State',
    method: 'POST',
    url: '/api/ai/explain',
    description: 'Synthesizes decision explanations for all isolated and active paths',
    defaultBody: JSON.stringify({}, null, 2),
    requiresAuth: true,
  },
  {
    name: 'Reset Environment Baseline',
    method: 'POST',
    url: '/api/demo/reset',
    description: 'Resets database to clean baseline with 8 healthy components and zero failures',
    requiresAuth: true,
  },
];

export const ApiStudio: React.FC = () => {
  const { token, isAuthenticated } = useAuth();
  const [selectedPreset, setSelectedPreset] = useState<EndpointPreset>(PRESETS[0]);
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [url, setUrl] = useState<string>('/health');
  const [requestBody, setRequestBody] = useState<string>('');
  const [includeAuth, setIncludeAuth] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<any | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleSelectPreset = (preset: EndpointPreset) => {
    setSelectedPreset(preset);
    setMethod(preset.method);
    setUrl(preset.url);
    setRequestBody(preset.defaultBody || '');
    setResponseBody(null);
    setResponseStatus(null);
    setExecutionTimeMs(null);
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setResponseStatus(null);
    setResponseBody(null);
    setExecutionTimeMs(null);

    const startTime = performance.now();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (includeAuth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const options: RequestInit = {
        method,
        headers,
      };

      if (method === 'POST' && requestBody.trim()) {
        try {
          options.body = JSON.stringify(JSON.parse(requestBody));
        } catch {
          options.body = requestBody;
        }
      }

      const res = await fetch(url, options);
      const endTime = performance.now();
      setExecutionTimeMs(Math.round(endTime - startTime));
      setResponseStatus(res.status);

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const json = await res.json();
        setResponseBody(json);
      } else {
        const text = await res.text();
        setResponseBody(text);
      }
    } catch (err: any) {
      const endTime = performance.now();
      setExecutionTimeMs(Math.round(endTime - startTime));
      setResponseStatus(0);
      setResponseBody({ error: err.message || 'Network error executing request' });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyResponse = () => {
    if (!responseBody) return;
    navigator.clipboard.writeText(JSON.stringify(responseBody, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-slate-900 font-mono flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-indigo-600" />
          <span>INTERACTIVE API STUDIO</span>
        </h2>
        <p className="text-xs text-slate-500 font-mono mt-0.5">
          Execute real HTTP requests against live FastAPI backend endpoints with token injection and status introspection.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Presets List (1 col) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 font-mono uppercase mb-3">Endpoint Presets</h3>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {PRESETS.map((p, idx) => {
              const isSelected = selectedPreset.name === p.name;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectPreset(p)}
                  className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between text-xs font-mono shadow-xs ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50/70 text-indigo-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="truncate mr-2">
                    <span className="font-bold block truncate text-slate-900">{p.name}</span>
                    <span className="text-[10px] text-slate-500 truncate block">{p.url}</span>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-black flex-shrink-0 ${
                      p.method === 'GET'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {p.method}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Request Composer & Response Panel (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Request Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className={`font-mono text-xs font-bold px-3 py-2 rounded-xl border focus:outline-none ${
                  method === 'GET'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>

              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:border-indigo-400 focus:outline-none"
                placeholder="/api/components"
              />

              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold font-mono shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isExecuting ? 'SENDING...' : 'EXECUTE'}</span>
              </button>
            </div>

            {/* Auth Injection Toggle */}
            <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-500">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAuth}
                  onChange={(e) => setIncludeAuth(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                />
                <span>Include Authorization: Bearer JWT</span>
              </label>

              <span className="text-[11px]">
                {isAuthenticated ? (
                  <span className="text-emerald-700 font-bold">✓ Token Loaded</span>
                ) : (
                  <span className="text-amber-700">⚠ Not signed in (401 on protected routes)</span>
                )}
              </span>
            </div>

            {/* Request Body editor if POST */}
            {method === 'POST' && (
              <div className="pt-2">
                <label className="block text-[11px] font-mono text-slate-500 font-bold mb-1">
                  Request Payload (JSON)
                </label>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:border-indigo-400 focus:outline-none"
                  placeholder="{}"
                />
              </div>
            )}
          </div>

          {/* Response Output Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 font-mono shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-slate-800 uppercase">HTTP Response</span>
                {responseStatus !== null && (
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      responseStatus >= 200 && responseStatus < 300
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : responseStatus === 401 || responseStatus === 403
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    STATUS {responseStatus}
                  </span>
                )}
                {executionTimeMs !== null && (
                  <span className="text-xs text-slate-500 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-indigo-600" />
                    <span>{executionTimeMs} ms</span>
                  </span>
                )}
              </div>

              {responseBody && (
                <button
                  onClick={copyResponse}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'COPIED' : 'COPY JSON'}</span>
                </button>
              )}
            </div>

            {responseBody ? (
              <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 text-xs overflow-x-auto max-h-[420px] font-mono leading-relaxed">
                {typeof responseBody === 'object' ? JSON.stringify(responseBody, null, 2) : responseBody}
              </pre>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                Select an endpoint preset above and click &quot;EXECUTE&quot; to inspect real HTTP output.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
