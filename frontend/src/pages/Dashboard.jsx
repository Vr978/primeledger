import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAccounts, withdraw, getTransactions, getStats, getFrequentRecipients, transfer, createCheckoutSession, depositDirect, verifyStripeSession } from '../services/api';

const PIE_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1', '#f97316'];

export default function Dashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [frequentRecipients, setFrequentRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTransaction, setShowTransaction] = useState(null);
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('OTHER');
  const [txDescription, setTxDescription] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickTo, setQuickTo] = useState('');
  const [message, setMessage] = useState('');

  const cardBg = theme === 'dark' ? 'bg-[#1a1a2e] border-gray-800' : 'bg-white border-gray-200';

  useEffect(() => { 
    fetchAll();
    // Check if returning from Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('deposit') === 'success') {
      const sessionId = params.get('session_id');
      if (sessionId) {
        // Verify payment and credit wallet
        verifyStripeSession(sessionId).then(() => {
          showMsg('Deposit successful! Your wallet has been credited.');
          fetchAll(); // Refresh to show new balance
        }).catch(() => {
          showMsg('Payment received — wallet will be updated shortly.');
        });
      } else {
        showMsg('Deposit successful!');
      }
      window.history.replaceState({}, '', '/');
    } else if (params.get('deposit') === 'cancelled') {
      showMsg('Deposit cancelled.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const fetchAll = async () => {
    try {
      const [accRes, txRes, statsRes, freqRes] = await Promise.all([
        getAccounts(), getTransactions(), getStats().catch(() => ({ data: null })), getFrequentRecipients().catch(() => ({ data: [] }))
      ]);
      setAccounts(accRes.data);
      setTransactions(txRes.data.slice(0, 5));
      setStats(statsRes.data);
      setFrequentRecipients(freqRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleTransaction = async (e) => {
    e.preventDefault();
    try {
      if (showTransaction.type === 'deposit') {
        // Try Stripe checkout first, fall back to direct deposit
        try {
          const res = await createCheckoutSession(parseFloat(txAmount));
          if (res.data.url) {
            window.location.href = res.data.url; // Redirect to Stripe
            return;
          }
        } catch (stripeErr) {
          // Stripe not configured, use direct deposit
          await depositDirect(parseFloat(txAmount));
        }
      } else {
        // Pay = withdraw with merchant name as description
        await withdraw(showTransaction.accountId, parseFloat(txAmount), txCategory, txDescription);
      }
      setShowTransaction(null); setTxAmount(''); setTxDescription(''); setTxCategory('OTHER'); fetchAll();
      showMsg(`${showTransaction.type === 'deposit' ? 'Money added' : 'Payment'} successful!`);
    } catch (err) { showMsg(typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message || err.response?.data?.error || 'Failed'); }
  };

  const handleQuickTransfer = async (e) => {
    e.preventDefault();
    if (!accounts.length) return;
    try {
      await transfer(accounts[0].id, quickTo, parseFloat(quickAmount), 'Quick transfer');
      setQuickAmount(''); setQuickTo(''); fetchAll(); showMsg('Transfer sent!');
    } catch (err) { showMsg(typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message || 'Failed'); }
  };

  const showMsg = (t) => { setMessage(t); setTimeout(() => setMessage(''), 3000); };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  if (accounts.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <span className="text-6xl">👋</span>
        <h2 className="text-2xl font-bold mt-4">Welcome, {user?.name}!</h2>
        <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Your wallet is being set up. Please refresh in a moment.</p>
      </div>
    );
  }

  const pieData = stats?.expenseByCategory ? Object.entries(stats.expenseByCategory).map(([name, value]) => ({ name, value: parseFloat(value) })) : [];
  const totalExpense = pieData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-6">
      {message && <div className="bg-green-900/30 border border-green-800 text-green-300 px-4 py-3 rounded-xl">{message}</div>}

      {/* Row 1: Cards + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Wallet */}
        <div className="lg:col-span-2">
          <h3 className="font-semibold text-lg mb-4">My Wallet</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {accounts.map((acc, i) => (
              <div key={acc.id} className={`min-w-[300px] rounded-2xl p-5 relative overflow-hidden ${i === 0 ? 'bg-gradient-to-br from-red-500 to-red-700 text-white' : theme === 'dark' ? 'bg-[#1a1a2e] border border-gray-700 text-white' : 'bg-white border border-gray-200'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-xs ${i === 0 ? 'text-white/60' : 'text-gray-400'}`}>Balance</p>
                    <p className="text-2xl font-bold mt-1">${parseFloat(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <img src="/assets/Primeledger_white.png" alt="PL" className="w-10 h-10 object-contain opacity-80 rounded-full" />
                </div>
                <div className="flex justify-between items-end mt-6">
                  <div>
                    <p className={`text-xs ${i === 0 ? 'text-white/60' : 'text-gray-400'}`}>ACCOUNT HOLDER</p>
                    <p className="text-sm font-medium mt-0.5">{acc.ownerName}</p>
                  </div>
                  <p className={`font-mono text-sm ${i === 0 ? 'text-white/80' : 'text-gray-400'}`}>{acc.accountNumber}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setShowTransaction({ type: 'deposit', accountId: acc.id })} className="text-xs bg-white/10 px-3 py-1 rounded-full hover:bg-white/20">+ Add Money</button>
                  <button onClick={() => setShowTransaction({ type: 'pay', accountId: acc.id })} className="text-xs bg-white/10 px-3 py-1 rounded-full hover:bg-white/20">💳 Pay</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div>
          <h3 className="font-semibold text-lg mb-4">Recent Transaction</h3>
          <div className={`rounded-2xl border p-4 ${cardBg}`}>
            {transactions.length === 0 ? <p className="text-gray-500 text-sm text-center py-4">No transactions yet</p> : (
              <div className="space-y-3">
                {transactions.slice(0, 4).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {tx.type === 'DEPOSIT' ? '↓' : tx.type === 'TRANSFER_IN' ? '←' : '↑'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.description || tx.type.replace('_', ' ')}</p>
                        <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' ? '+' : '-'}${parseFloat(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Weekly Activity + Expense Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-2xl border p-5 ${cardBg}`}>
          <h3 className="font-semibold mb-4">Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.weeklyActivity || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
              <XAxis dataKey="day" tick={{ fill: theme === 'dark' ? '#999' : '#666', fontSize: 12 }} />
              <YAxis tick={{ fill: theme === 'dark' ? '#999' : '#666', fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="deposits" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="withdrawals" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Add Money</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-full"></span> Payments</span>
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${cardBg}`}>
          <h3 className="font-semibold mb-4">Expense Statistics</h3>
          {pieData.length === 0 ? <p className="text-gray-500 text-sm text-center py-8">Make payments to see expense stats</p> : (
            <div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `$${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>{item.name} {((item.value/totalExpense)*100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Quick Transfer + Balance History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-2xl border p-5 ${cardBg}`}>
          <h3 className="font-semibold mb-4">Quick Transfer</h3>
          {frequentRecipients.length > 0 && (
            <div className="flex gap-3 mb-4">
              {frequentRecipients.map((r, i) => (
                <button key={i} onClick={() => setQuickTo(r.accountNumber)} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs ${quickTo === r.accountNumber ? 'bg-red-500/20 border border-red-500' : theme === 'dark' ? 'bg-[#0e0e1e]' : 'bg-gray-100'}`}>
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">{r.accountNumber.slice(-2)}</div>
                  <span className="text-gray-400 font-mono">{r.accountNumber.slice(-6)}</span>
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleQuickTransfer} className="flex gap-2">
            <input type="text" placeholder="Account Number" value={quickTo} onChange={e => setQuickTo(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border outline-none ${theme === 'dark' ? 'bg-[#0e0e1e] border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`} required />
            <input type="number" step="0.01" min="0.01" placeholder="Amount" value={quickAmount} onChange={e => setQuickAmount(e.target.value)}
              className={`w-24 px-3 py-2 rounded-lg text-sm border outline-none ${theme === 'dark' ? 'bg-[#0e0e1e] border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`} required />
            <button type="submit" className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600">Send</button>
          </form>
          <p className="text-xs text-gray-500 mt-2">Demo: PL-2026-000001</p>
        </div>

        <div className={`rounded-2xl border p-5 ${cardBg}`}>
          <h3 className="font-semibold mb-4">Balance History</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={stats?.balanceHistory || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme === 'dark' ? '#999' : '#666' }} tickFormatter={d => d?.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: theme === 'dark' ? '#999' : '#666' }} />
              <Tooltip />
              <Line type="monotone" dataKey="balance" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Modals */}
      {showTransaction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className={`p-6 rounded-2xl w-full max-w-md border ${theme === 'dark' ? 'bg-[#1a1a2e] border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className="text-lg font-bold mb-4">
              {showTransaction.type === 'deposit' ? '+ Add Money' : '💳 Pay'}
            </h3>
            <form onSubmit={handleTransaction} className="space-y-4">
              {showTransaction.type === 'pay' && (
                <input type="text" placeholder="Pay to (e.g. Netflix, Walmart, Uber)" value={txDescription} onChange={e => setTxDescription(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${theme === 'dark' ? 'bg-[#0e0e1e] border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`} required />
              )}
              <input type="number" step="0.01" min="0.50" placeholder="Amount" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border outline-none text-2xl font-bold ${theme === 'dark' ? 'bg-[#0e0e1e] border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`} required />
              {showTransaction.type === 'pay' && (
                <select value={txCategory} onChange={e => setTxCategory(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${theme === 'dark' ? 'bg-[#0e0e1e] border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`}>
                  <option value="GROCERIES">Groceries</option>
                  <option value="RENT">Rent</option>
                  <option value="BILLS">Bills</option>
                  <option value="ENTERTAINMENT">Entertainment</option>
                  <option value="TRAVEL">Travel</option>
                  <option value="HEALTHCARE">Healthcare</option>
                  <option value="INVESTMENT">Investment</option>
                  <option value="OTHER">Other</option>
                </select>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowTransaction(null); setTxAmount(''); setTxDescription(''); setTxCategory('OTHER'); }} className="flex-1 py-3 border border-gray-600 rounded-xl text-gray-400">Cancel</button>
                <button type="submit" className={`flex-1 py-3 text-white rounded-xl font-medium ${showTransaction.type === 'deposit' ? 'bg-green-600' : 'bg-red-500'}`}>
                  {showTransaction.type === 'deposit' ? 'Add via Stripe' : 'Pay Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
