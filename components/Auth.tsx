import React, { useState } from 'react';
import { Shield, ShieldCheck, Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { AuthResponse, UserRole } from '../types';

interface AuthProps {
  onLogin: (data: AuthResponse) => void;
}

const API_URL = '/api';

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'register' | 'reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState(''); // For resetting
  const [newPassword, setNewPassword] = useState('');
  const [isHuman, setIsHuman] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState(''); // Display after register

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = view === 'register' ? '/register' : view === 'reset' ? '/reset-password' : '/login';
    const body: any = { username };
    
    if (view === 'login') body.password = password;
    if (view === 'register') { body.password = password; body.isHuman = isHuman; }
    if (view === 'reset') { body.recoveryKey = recoveryKey; body.newPassword = newPassword; }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (view === 'register' && data.recoveryKey) {
        setGeneratedRecoveryKey(data.recoveryKey);
        localStorage.setItem('tavern_token', data.token); 
        localStorage.setItem('tavern_temp_user', JSON.stringify(data.user));
      } else if (view === 'reset') {
        setView('login');
        setError('Password reset successful. Please log in.');
        setPassword('');
      } else {
        onLogin(data);
      }
    } catch (err: any) {
      setError(err.message);
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('Unexpected token')) {
          setError("Cannot connect to Tavern Server. Ensure the server container is running on port 3003.");
      }
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = () => {
      const token = localStorage.getItem('tavern_token');
      const userStr = localStorage.getItem('tavern_temp_user');
      if (token && userStr) {
          onLogin({ token, user: JSON.parse(userStr) });
      }
  };

  if (generatedRecoveryKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-emerald-500/50 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative">
          <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold text-white mb-2">Registration Successful!</h2>
          <p className="text-slate-400 text-sm mb-6">
            Save this recovery key securely. It is the <strong>only way</strong> to reset your password if lost.
          </p>
          <div className="bg-black/50 p-4 rounded border border-emerald-900/50 font-mono text-emerald-400 text-lg break-all select-all mb-6">
            {generatedRecoveryKey}
          </div>
          <button 
            onClick={completeRegistration}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-white transition-colors"
          >
            I have saved my key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-wood.png')] opacity-20 pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-950/0 via-slate-950/50 to-slate-950 pointer-events-none"></div>

      <div className="z-10 bg-slate-900/90 backdrop-blur-sm p-8 rounded-2xl border border-amber-900/30 shadow-[0_0_50px_rgba(245,158,11,0.1)] max-w-md w-full relative">
        <div className="flex flex-col items-center mb-8">
          <Shield className="w-16 h-16 text-amber-500 mb-4" />
          <h1 className="text-3xl font-serif font-bold text-amber-50 tracking-[0.2em]">TAVERNLINK</h1>
          <p className="text-slate-400 text-sm tracking-widest uppercase mt-2">Secure Communication for Adventurers</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'reset' && (
             <div className="bg-amber-900/20 text-amber-200 p-3 rounded text-sm mb-4 border border-amber-900/50 flex gap-2">
                 <KeyRound className="w-5 h-5 shrink-0" />
                 Enter your Username and Recovery Key to set a new password.
             </div>
          )}

          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg p-3 text-slate-200 outline-none transition-all"
              placeholder="Username"
              required
            />
          </div>

          {view === 'reset' ? (
            <>
                <div>
                    <input
                    type="text"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg p-3 text-slate-200 outline-none transition-all font-mono"
                    placeholder="Recovery Key"
                    required
                    />
                </div>
                <div>
                    <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg p-3 text-slate-200 outline-none transition-all"
                    placeholder="New Password"
                    required
                    />
                </div>
            </>
          ) : (
            <div>
                <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg p-3 text-slate-200 outline-none transition-all"
                placeholder="Password"
                required
                />
            </div>
          )}

          {view === 'register' && (
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-950/50 rounded-lg border border-slate-800 hover:border-amber-500/50 transition-colors">
              <input
                type="checkbox"
                checked={isHuman}
                onChange={(e) => setIsHuman(e.target.checked)}
                className="accent-amber-500 w-5 h-5 rounded"
              />
              <span className="text-sm text-slate-300 select-none">I am not a construct (Bot Check)</span>
            </label>
          )}

          {error && <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (view === 'register' ? 'Begin Adventure' : view === 'reset' ? 'Reset Password' : 'Enter Tavern')}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-center">
            {view === 'login' && (
                <>
                    <button onClick={() => { setView('register'); setError(''); }} className="text-sm text-slate-500 hover:text-amber-400 transition-colors">
                        New to the realm? Register
                    </button>
                    <button onClick={() => { setView('reset'); setError(''); }} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                        Lost your key? (Reset Password)
                    </button>
                </>
            )}
            {(view === 'register' || view === 'reset') && (
                <button onClick={() => { setView('login'); setError(''); }} className="text-sm text-slate-500 hover:text-amber-400 transition-colors flex items-center justify-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                </button>
            )}
        </div>
      </div>
      
      <div className="absolute bottom-4 left-0 w-full text-center flex flex-col gap-1 text-[10px] text-slate-600 pointer-events-none">
          <div className="font-bold">App by Ultima Nobis</div>
          <div>2026 Open Source MIT License</div>
      </div>
    </div>
  );
};