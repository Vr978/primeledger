import { useState, useEffect } from 'react';
import { getTransactions } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function Transactions() {
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => { fetchTransactions(); }, []);

  const fetchTransactions = async () => {
    try {
      const res = await getTransactions();
      setTransactions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'ALL' ? transactions : transactions.filter(t => t.type === filter);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'DEPOSIT': return '↓';
      case 'WITHDRAW': return '↑';
      case 'TRANSFER_IN': return '←';
      case 'TRANSFER_OUT': return '→';
      default: return '•';
    }
  };

  // Group transactions by date
  const groupedByDate = filtered.reduce((groups, tx) => {
    const date = new Date(tx.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
    return groups;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${theme === 'dark' ? 'bg-[#1a1a2e]' : 'bg-gray-200'}`}>
          <span className="text-2xl">📋</span>
        </div>
        <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>No Transactions Yet</h2>
        <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Make your first deposit to see history here.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Operations</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`px-3 py-2 rounded-xl text-sm outline-none border ${theme === 'dark' ? 'bg-[#1a1a2e] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}
        >
          <option value="ALL">All</option>
          <option value="DEPOSIT">Deposits</option>
          <option value="WITHDRAW">Withdrawals</option>
          <option value="TRANSFER_IN">Received</option>
          <option value="TRANSFER_OUT">Sent</option>
        </select>
      </div>

      {/* Transaction List */}
      <div className={`rounded-2xl border ${theme === 'dark' ? 'bg-[#1a1a2e] border-gray-800' : 'bg-white border-gray-200'}`}>
        {Object.entries(groupedByDate).map(([date, txs]) => (
          <div key={date}>
            <p className={`text-xs font-medium uppercase px-4 pt-4 pb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{date}</p>
            <div className={`divide-y ${theme === 'dark' ? 'divide-gray-800' : 'divide-gray-100'}`}>
              {txs.map((tx) => (
                <div key={tx.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${theme === 'dark' ? 'bg-[#0e0e1e] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                      {getTypeIcon(tx.type)}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{tx.description || tx.category}</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{tx.counterpartyAccountNumber || tx.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-semibold text-sm ${tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' ? '+' : '-'}${parseFloat(tx.amount).toFixed(2)}
                    </span>
                    <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
