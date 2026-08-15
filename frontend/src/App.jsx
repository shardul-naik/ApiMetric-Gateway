import React, { useState, useEffect } from 'react';
import API from './api';
import axios from 'axios';
import { Key, Activity, Clock, Server, Lock, Mail, LogOut, Copy, Check, AlertCircle, Play, ShieldAlert, Users, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('role') || 'user');
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [keys, setKeys] = useState([]);
  const [copiedKey, setCopiedKey] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [apiResponse, setApiResponse] = useState(null);

  const [adminSummary, setAdminSummary] = useState({
    total_system_users: 0,
    total_keys_issued: 0,
    total_system_requests: 0,
    global_avg_latency_ms: 0,
    user_activity: [],
    status_breakdown: {}
  });

  useEffect(() => {
    if (token) {
      if (userRole === 'admin') {
        fetchAdminSummary();
      } else {
        fetchKeys();
      }
    }
  }, [token, userRole]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'register-user') {
        await API.post('/auth/register', { email, password });
        setAuthMode('login');
        setAuthError('Registration successful! Please log in.');
      } else if (authMode === 'register-admin') {
        await API.post('/auth/register-admin', { email, password }, {
          headers: { 'admin-key': adminKeyInput }
        });
        setAuthMode('login');
        setAuthError('Admin account created! Please log in.');
      } else {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);
        const res = await API.post('/auth/login', formData);

        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('role', res.data.role);
        setToken(res.data.access_token);
        setUserRole(res.data.role);
      }
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken('');
    setUserRole('user');
    setKeys([]);
  };

  const fetchKeys = async () => {
    try {
      const res = await API.get('/keys/');
      setKeys(res.data);
      if (res.data.length > 0 && !selectedKey) {
        setSelectedKey(res.data[0].key);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const generateKey = async () => {
    try {
      const res = await API.post('/keys/generate');
      setSelectedKey(res.data.key);
      fetchKeys();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminSummary = async () => {
    try {
      const res = await API.get('/analytics/admin-summary');
      setAdminSummary(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const revokeUserKey = async (keyId) => {
    try {
      await API.put(`/keys/revoke/${keyId}`);
      fetchAdminSummary();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to revoke key');
    }
  };

  const testEndpoint = async (endpoint) => {
    if (!selectedKey) {
      alert('Please select or generate an API Key first.');
      return;
    }
    try {
      const res = await axios.get(`http://localhost:8000${endpoint}`, {
        headers: { 'X-API-Key': selectedKey }
      });
      setApiResponse(res.data);
    } catch (err) {
      setApiResponse(err.response?.data || { error: 'Request Failed' });
    }
  };

  const copyToClipboard = (keyStr) => {
    navigator.clipboard.writeText(keyStr);
    setCopiedKey(keyStr);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <Activity className="w-8 h-8 text-indigo-500" />
            <span className="text-2xl font-bold tracking-wider text-white">APIMetric Gateway</span>
          </div>

          <div className="flex mb-6 border-b border-slate-700 text-xs font-semibold">
            <button
              className={`flex-1 pb-3 text-center ${authMode === 'login' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400'}`}
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
            >
              Sign In
            </button>
            <button
              className={`flex-1 pb-3 text-center ${authMode === 'register-user' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400'}`}
              onClick={() => { setAuthMode('register-user'); setAuthError(''); }}
            >
              User Register
            </button>
            <button
              className={`flex-1 pb-3 text-center ${authMode === 'register-admin' ? 'border-b-2 border-amber-500 text-amber-400' : 'text-slate-400'}`}
              onClick={() => { setAuthMode('register-admin'); setAuthError(''); }}
            >
              Admin Register
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-indigo-950/50 border border-indigo-500/30 rounded-lg flex items-center space-x-2 text-indigo-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="developer@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {authMode === 'register-admin' && (
              <div>
                <label className="block text-xs uppercase tracking-wider text-amber-400 mb-1">Admin Secret Key</label>
                <div className="relative">
                  <ShieldAlert className="absolute left-3 top-3 w-5 h-5 text-amber-500" />
                  <input
                    type="password"
                    required
                    value={adminKeyInput}
                    onChange={(e) => setAdminKeyInput(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/50 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-amber-500"
                    placeholder="adminsecret123"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className={`w-full font-semibold py-2.5 rounded-lg transition duration-200 shadow-lg ${authMode === 'register-admin'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                }`}
            >
              {authMode === 'login' ? 'Sign In' : authMode === 'register-user' ? 'Create User Account' : 'Create Admin Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (userRole === 'admin') {
    const userChartData = adminSummary.user_activity.map(u => ({
      user: u.email.split('@')[0],
      requests: u.total_requests
    }));

    const statusChartData = Object.keys(adminSummary.status_breakdown || {}).map(code => ({
      status: `HTTP ${code}`,
      count: adminSummary.status_breakdown[code]
    }));

    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <nav className="border-b border-amber-500/30 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShieldAlert className="w-7 h-7 text-amber-500" />
              <span className="text-xl font-bold tracking-wider text-white">
                APIMetric <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded ml-2">ADMIN ANALYTICS CONSOLE</span>
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl flex items-center space-x-4">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Users</p>
                <h3 className="text-2xl font-bold text-white mt-1">{adminSummary.total_system_users}</h3>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl flex items-center space-x-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active API Keys</p>
                <h3 className="text-2xl font-bold text-white mt-1">{adminSummary.total_keys_issued}</h3>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Global Requests</p>
                <h3 className="text-2xl font-bold text-white mt-1">{adminSummary.total_system_requests}</h3>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl flex items-center space-x-4">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Global Avg Latency</p>
                <h3 className="text-2xl font-bold text-white mt-1">{adminSummary.global_avg_latency_ms} <span className="text-sm font-normal text-slate-400">ms</span></h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-md font-bold text-white mb-4">Requests Executed per User</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="user" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} />
                    <Bar dataKey="requests" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-md font-bold text-white mb-4">Global HTTP Status Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="status" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">User Key Control Table</h2>
            <div className="space-y-6">
              {adminSummary.user_activity.map((u) => (
                <div key={u.user_id} className="bg-slate-900 border border-slate-700/60 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="font-mono text-xs text-amber-400 font-semibold mr-2">User #{u.user_id}</span>
                      <span className="text-white font-semibold text-sm">{u.email}</span>
                    </div>
                    <div className="flex space-x-4 text-xs">
                      <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                        {u.total_requests} requests
                      </span>
                      <span className="text-slate-400">{u.avg_latency_ms} ms avg</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {u.keys.length === 0 ? (
                      <p className="text-xs text-slate-500">No active keys for this user.</p>
                    ) : (
                      u.keys.map((k) => (
                        <div key={k.id} className="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800/80">
                          <span className="font-mono text-xs text-indigo-300">{k.key}</span>
                          <div className="flex items-center space-x-3">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${k.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400'}`}>
                              {k.is_active ? 'Active' : 'Revoked'}
                            </span>
                            {k.is_active && (
                              <button
                                onClick={() => revokeUserKey(k.id)}
                                className="flex items-center space-x-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Revoke</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="w-7 h-7 text-indigo-500" />
            <span className="text-xl font-bold tracking-wider text-white">APIMetric User Portal</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <span>My API Keys</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Generate and copy your credentials to access microservices.</p>
            </div>
            <button
              onClick={generateKey}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-4 py-2 rounded-lg transition shadow-lg shadow-indigo-600/20"
            >
              + Generate New Key
            </button>
          </div>

          <div className="space-y-3">
            {keys.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No active API keys generated yet.</p>
            ) : (
              keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between bg-slate-900 border border-slate-700/60 p-4 rounded-lg">
                  <div className="font-mono text-sm text-indigo-300 tracking-wide">{k.key}</div>
                  <div className="flex items-center space-x-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${k.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400'}`}>
                      {k.is_active ? 'Active' : 'Revoked'}
                    </span>
                    <button
                      onClick={() => copyToClipboard(k.key)}
                      className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition"
                      title="Copy API Key"
                    >
                      {copiedKey === k.key ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Play className="w-5 h-5 text-emerald-400" />
              <span>API Execution Console</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select an API key from your list, trigger service endpoints, and view live JSON payloads.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Select API Key --</option>
              {keys.map((k) => (
                <option key={k.id} value={k.key}>{k.key}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-700/60 p-4 rounded-lg flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-semibold text-white text-sm">Weather API</h4>
                <p className="text-xs text-slate-400">GET /api/v1/weather</p>
              </div>
              <button
                onClick={() => testEndpoint('/api/v1/weather')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-indigo-400 font-medium text-xs py-2 rounded border border-slate-700 transition"
              >
                Execute Weather Service
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-700/60 p-4 rounded-lg flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-semibold text-white text-sm">Stock API</h4>
                <p className="text-xs text-slate-400">GET /api/v1/stock</p>
              </div>
              <button
                onClick={() => testEndpoint('/api/v1/stock')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium text-xs py-2 rounded border border-slate-700 transition"
              >
                Execute Stock Service
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-700/60 p-4 rounded-lg flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-semibold text-white text-sm">Currency API</h4>
                <p className="text-xs text-slate-400">GET /api/v1/currency</p>
              </div>
              <button
                onClick={() => testEndpoint('/api/v1/currency')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 font-medium text-xs py-2 rounded border border-slate-700 transition"
              >
                Execute Currency Service
              </button>
            </div>
          </div>

          {apiResponse && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300">
              <p className="text-slate-500 mb-2">// Response Payload</p>
              <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}