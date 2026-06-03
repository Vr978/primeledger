import { useState, useEffect } from 'react';
import { getAccounts, transfer } from '../services/api';

export default function Transfer() {
  const [accounts, setAccounts] = useState([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    getAccounts().then(res => {
      setAccounts(res.data);
      if (res.data.length > 0) setFromAccountId(String(res.data[0].id));
    }).catch(() => {});
  }, []);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await transfer(parseInt(fromAccountId), toAccountNumber, parseFloat(amount), description);
      setMessage({ type: 'success', text: `Sent $${amount} to ${toAccountNumber}` });
      setAmount('');
      setDescription('');
      setToAccountNumber('');
      const res = await getAccounts();
      setAccounts(res.data);
    } catch (err) {
      const errData = err.response?.data;
      let errMsg = 'Transfer failed';
      if (typeof errData === 'string') errMsg = errData;
      else if (errData?.message) errMsg = errData.message;
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-[#1a1a2e] rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">💸</span>
        </div>
        <h2 className="text-xl font-bold text-white">Create an Account First</h2>
        <p className="text-gray-400 mt-2">You need at least one account to transfer.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white mb-6">Transfer Funds</h2>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-xl border ${message.type === 'success' ? 'bg-green-900/30 border-green-800 text-green-300' : 'bg-red-900/30 border-red-800 text-red-300'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-[#1a1a2e] rounded-2xl border border-gray-800 p-6">
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">From Account</label>
            <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full px-4 py-3 bg-[#0e0e1e] border border-gray-700 rounded-xl text-white outline-none">
              {accounts.map(acc => (
                <option key={acc.id} value={String(acc.id)}>
                  {acc.accountNumber} — ${parseFloat(acc.balance).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">To Account Number</label>
            <input type="text" placeholder="PL-2026-000001" value={toAccountNumber} onChange={(e) => setToAccountNumber(e.target.value)}
              className="w-full px-4 py-3 bg-[#0e0e1e] border border-gray-700 rounded-xl text-white font-mono placeholder-gray-600 outline-none focus:ring-2 focus:ring-red-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Amount</label>
            <input type="number" step="0.01" min="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-[#0e0e1e] border border-gray-700 rounded-xl text-white text-2xl font-bold placeholder-gray-600 outline-none focus:ring-2 focus:ring-red-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
            <input type="text" placeholder="What's this for?" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-[#0e0e1e] border border-gray-700 rounded-xl text-white placeholder-gray-600 outline-none" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-3 rounded-xl font-semibold hover:from-red-700 hover:to-red-600 transition-all disabled:opacity-50 mt-2">
            {loading ? 'Sending...' : 'Send Transfer'}
          </button>
        </form>
      </div>

      <div className="mt-6 bg-[#1a1a2e] border border-gray-800 rounded-2xl p-4">
        <p className="text-gray-400 text-sm font-medium">💡 Demo Transfer</p>
        <p className="text-gray-500 text-xs mt-1">Send money to: <span className="font-mono text-white">PL-2026-000001</span> (Admin)</p>
      </div>
    </div>
  );
}
