import React, { useState } from 'react';
import { Lock, Shield, AlertCircle, X, LogIn } from 'lucide-react';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';
import { Role } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, quickLogin, isLoading, authError, clearAuthError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'quick' | 'custom'>('quick');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    const ok = await login(username, password);
    if (ok) {
      onClose();
    }
  };

  const handleQuick = async (role: Role) => {
    const ok = await quickLogin(role);
    if (ok) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">SOC Access &amp; Authentication</h3>
              <p className="text-xs text-slate-500 font-medium">Role-Based Access Control (RBAC)</p>
            </div>
          </div>
          <button
            onClick={() => {
              clearAuthError();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 m-4 rounded-xl">
          <button
            type="button"
            onClick={() => {
              clearAuthError();
              setActiveTab('quick');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'quick'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            1-Click Demo Presets
          </button>
          <button
            type="button"
            onClick={() => {
              clearAuthError();
              setActiveTab('custom');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'custom'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Custom Credentials
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pt-2">
          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="leading-snug">{authError}</span>
            </div>
          )}

          {activeTab === 'quick' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-3">
                Select a simulated identity to sign in with cryptographically verified roles:
              </p>

              {(['ADMIN', 'SECURITY_ANALYST', 'VIEWER'] as Role[]).map((role) => {
                const cred = DEMO_CREDENTIALS[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleQuick(role)}
                    disabled={isLoading}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50/40 hover:border-indigo-300 transition group disabled:opacity-50 shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition">
                          {cred.label}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                            role === 'ADMIN'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : role === 'SECURITY_ANALYST'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {role === 'SECURITY_ANALYST' ? 'ANALYST' : role}
                        </span>
                      </div>
                      <LogIn className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{cred.description}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">Username: {cred.username}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username or Email</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or admin@invarianthold.io"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (e.g. admin123)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Default developer passwords: <code>admin123</code>, <code>analyst123</code>, <code>viewer123</code>
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 mt-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'SIGNING IN...' : 'SIGN IN'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
