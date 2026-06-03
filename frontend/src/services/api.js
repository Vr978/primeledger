import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
const TRANSACTION_API_URL = import.meta.env.VITE_TRANSACTION_API_URL || 'http://localhost:8082';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

const transactionApi = axios.create({
  baseURL: TRANSACTION_API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor to add JWT token
const addAuthHeader = (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(addAuthHeader);
transactionApi.interceptors.request.use(addAuthHeader);

// Auth
export const register = (name, email, password) =>
  api.post('/auth/register', { name, email, password });

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const refreshToken = (refreshToken) =>
  api.post('/auth/refresh', { refreshToken });

export const logout = (refreshToken) =>
  api.post('/auth/logout', { refreshToken });

// Accounts
export const getAccounts = () => api.get('/accounts');
export const createAccount = (ownerName, accountType) =>
  api.post('/accounts', { ownerName, accountType });
export const getAccountByNumber = (number) =>
  api.get(`/accounts/by-number/${number}`);

// Payments / Deposit
export const createCheckoutSession = (amount) =>
  api.post('/payments/create-checkout-session', { amount });

export const verifyStripeSession = (sessionId) =>
  api.post('/payments/verify-session', { sessionId });

export const depositDirect = (amount) =>
  api.post('/payments/deposit-direct', { amount });

// Transactions (withdraw/transfer only - deposit goes through Stripe)
export const withdraw = (accountId, amount, category, description) =>
  transactionApi.post('/transactions/withdraw', { accountId, amount, category, description });

export const transfer = (fromAccountId, toAccountNumber, amount, description) =>
  transactionApi.post('/transactions/transfer', { fromAccountId, toAccountNumber, amount, description });

export const getTransactions = () => transactionApi.get('/transactions');
export const getCategories = () => transactionApi.get('/transactions/categories');
export const getStats = () => transactionApi.get('/transactions/stats');
export const getFrequentRecipients = () => transactionApi.get('/transactions/frequent-recipients');

// Admin
export const getAdminOverview = () => api.get('/accounts/admin/overview');

export default api;
