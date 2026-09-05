import React, { useState } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Eye,
  CheckCircle2,
  Link as LinkIcon,
  X,
  Copy,
} from 'lucide-react';
import { AuditLog, AuditVerificationResult } from '../types';

interface AuditLedgerProps {
  logs: AuditLog[];
  auditStatus: AuditVerificationResult | null;
  onVerify: () => Promise<void>;
  onRefresh: () => Promise<void>;
  loading: boolean;
}

export const AuditLedger: React.FC<AuditLedgerProps> = ({
  logs,
  auditStatus,
  onVerify,
  onRefresh,
  loading,
}) => {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await onVerify();
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 font-mono flex items-center space-x-2">
            <FileCheck2 className="w-5 h-5 text-indigo-600" />
            <span>CRYPTOGRAPHIC SHA-256 AUDIT LEDGER</span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Forward-secure hash chain linking every security verdict, failure injection, and reroute operation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-mono font-bold shadow-xs flex items-center space-x-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>

          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-mono font-bold shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'VERIFYING CHAIN...' : 'VALIDATE LEDGER INTEGRITY'}</span>
          </button>
        </div>
      </div>

      {/* Cryptographic Chain Integrity Scorecard */}
      {auditStatus && (
        <div
          className={`p-5 rounded-2xl border shadow-xs transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono ${
            auditStatus.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center space-x-3">
            {auditStatus.valid ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-rose-600 flex-shrink-0" />
            )}
            <div>
              <div className="text-sm font-bold tracking-wide flex items-center space-x-2">
                <span>{auditStatus.status}: {auditStatus.message}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Total Cryptographic Blocks: <strong>{auditStatus.total_records}</strong> &bull; Zero Tampering Detected
              </p>
            </div>
          </div>

          <div className="text-xs px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700">
            Hash Algorithm: <strong>SHA-256 (Forward-Chained)</strong>
          </div>
        </div>
      )}

      {/* Visual Hash-Chain Ribbon (Latest 3 blocks) */}
      {logs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 font-mono flex items-center space-x-2">
              <LinkIcon className="w-4 h-4 text-indigo-600" />
              <span>Live Block Chain Structure (Last {Math.min(logs.length, 3)} Blocks)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Immutable Log Order</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
            {logs.slice(0, 3).map((log, idx) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="bg-slate-50 border border-slate-200 p-4 rounded-xl cursor-pointer hover:border-indigo-400 transition space-y-2 relative shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">BLOCK #{log.id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                    {log.action}
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1">
                  <div>Actor: <span className="font-bold text-slate-800">{log.actor}</span></div>
                  <div>Target: <span className="font-bold text-slate-800">{log.target}</span></div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-[10px] space-y-1">
                  <div className="truncate text-slate-500">
                    Prev: <span className="text-slate-700 font-mono">{log.previous_hash.slice(0, 16)}...</span>
                  </div>
                  <div className="truncate text-indigo-700 font-bold">
                    Curr: <span className="font-mono">{log.current_hash.slice(0, 16)}...</span>
                  </div>
                </div>

                {idx < 2 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <span className="text-slate-300 font-bold text-base">&rarr;</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 font-mono">
            Cryptographic Audit Ledger ({logs.length} Events)
          </h3>
          <span className="text-xs font-mono text-slate-500">Immutable Audit Trail</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px]">
                <th className="py-2.5 px-3">BLOCK</th>
                <th className="py-2.5 px-3">TIMESTAMP</th>
                <th className="py-2.5 px-3">ACTOR</th>
                <th className="py-2.5 px-3">ACTION</th>
                <th className="py-2.5 px-3">TARGET</th>
                <th className="py-2.5 px-3">CURRENT HASH (SHA-256)</th>
                <th className="py-2.5 px-3">INSPECT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-mono text-xs">
                    No audit records logged yet. Run simulations, login, or inject failures to generate cryptographic events.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-bold text-slate-900">#{log.id}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {log.timestamp.split('T')[1]?.split('.')[0] || log.timestamp}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-700">{log.actor}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{log.target}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      <div className="flex items-center space-x-1.5">
                        <span className="truncate max-w-[120px]">{log.current_hash}</span>
                        <button
                          onClick={() => copyToClipboard(log.current_hash, `hash-${log.id}`)}
                          className="text-slate-400 hover:text-slate-700"
                          title="Copy SHA-256 Hash"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {copied === `hash-${log.id}` && (
                          <span className="text-[9px] text-emerald-600">COPIED</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1 text-[11px] transition"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Block Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Block #{selectedLog.id}: {selectedLog.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-700">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Timestamp</span>
                <span className="font-bold">{selectedLog.timestamp}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Actor / Role</span>
                <span className="font-bold">{selectedLog.actor}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Target Entity</span>
                <span className="font-bold text-slate-900">{selectedLog.target}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Cryptographic Hashes</span>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div>
                  <span className="text-slate-400 text-[10px] block">Previous Block Hash:</span>
                  <p className="text-slate-700 break-all font-mono text-[11px]">{selectedLog.previous_hash}</p>
                </div>
                <div>
                  <span className="text-indigo-600 text-[10px] font-bold block">Current Block Hash (SHA-256):</span>
                  <p className="text-slate-900 font-bold break-all font-mono text-[11px]">{selectedLog.current_hash}</p>
                </div>
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Payload Details (JSON)</span>
              <pre className="p-3 rounded-xl bg-slate-900 text-cyan-300 text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
