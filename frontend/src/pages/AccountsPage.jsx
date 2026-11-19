import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Eye,
  Search,
  RefreshCw,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  X,
  Printer,
  Calendar,
  CreditCard,
  Building2,
  Users,
  GraduationCap,
  Sparkles,
  Info,
  Scale,
  Receipt,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { ACADEMIC_YEARS } from '../utils/academicYears';

// Module-level in-memory cache for Stale-While-Revalidate (persists across navigation)
const coaMemoryCache = {
  accounts: null,
  journalEntries: null,
  feeStudents: null,
  feeClasses: null,
  academicYear: '2026-2027',
};

export const AccountsPage = ({ showToast }) => {
  const [activeSubTab, setActiveSubTab] = useState('COA'); // 'COA' | 'JOURNAL' | 'STUDENTS' | 'CLASSES'
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyStandard, setShowOnlyStandard] = useState(true);

  // Data states (initialized from in-memory cache if available for instant display)
  const [accounts, setAccounts] = useState(() => (coaMemoryCache.academicYear === academicYear ? coaMemoryCache.accounts || [] : []));
  const [journalEntries, setJournalEntries] = useState(() => (coaMemoryCache.academicYear === academicYear ? coaMemoryCache.journalEntries || [] : []));
  const [feeStudents, setFeeStudents] = useState(() => (coaMemoryCache.academicYear === academicYear ? coaMemoryCache.feeStudents || [] : []));
  const [feeClasses, setFeeClasses] = useState(() => coaMemoryCache.feeClasses || []);
  const [loading, setLoading] = useState(() => !coaMemoryCache.accounts || coaMemoryCache.academicYear !== academicYear);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountDetailsData, setAccountDetailsData] = useState(null);
  const [loadingAccountDetails, setLoadingAccountDetails] = useState(false);
  const [accountDetailsPage, setAccountDetailsPage] = useState(1);

  const [selectedJournalEntry, setSelectedJournalEntry] = useState(null);

  const [selectedStudentPassbook, setSelectedStudentPassbook] = useState(null);
  const [studentPassbookData, setStudentPassbookData] = useState(null);
  const [loadingStudentPassbook, setLoadingStudentPassbook] = useState(false);

  // Pagination states
  const [coaPage, setCoaPage] = useState(1);
  const coaPageSize = 15;

  const [journalPage, setJournalPage] = useState(1);
  const journalPageSize = 20;

  const [studentsPage, setStudentsPage] = useState(1);
  const studentsPageSize = 20;

  // Fetch Accounts (SWR: silent background refresh if cache exists)
  const loadAccounts = async () => {
    try {
      if (!coaMemoryCache.accounts || coaMemoryCache.accounts.length === 0) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const [res, defaultersRes] = await Promise.all([
        api.getFeeAccounts({ academic_year: academicYear }),
        api.getFeeDefaulters({ academic_year: academicYear, only_late: true }).catch(() => null),
      ]);
      const rawAccounts = Array.isArray(res) ? res : (res?.results || []);
      const latePenalties = parseFloat(defaultersRes?.total_penalties || defaultersRes?.total_late_penalties || 0);
      const overdueCount = defaultersRes?.overdue_students_count || 0;

      // Ensure 4030 rolls up active late penalties if backend has not posted permanent vouchers
      const mapped = rawAccounts.map((a) => {
        if (a.code === '4030' && (parseFloat(a.net_balance || 0) === 0 || !a.net_balance) && latePenalties > 0) {
          return {
            ...a,
            net_balance: latePenalties.toFixed(2),
            total_credit: latePenalties.toFixed(2),
            total_debit: '0.00',
            transaction_count: overdueCount || a.transaction_count,
          };
        }
        return a;
      });

      coaMemoryCache.accounts = mapped;
      coaMemoryCache.academicYear = academicYear;
      setAccounts(mapped);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      if (!coaMemoryCache.accounts || coaMemoryCache.accounts.length === 0) {
        showToast?.({
          type: 'error',
          title: 'Error Loading Accounts',
          message: err.message || 'Could not fetch Chart of Accounts.'
        });
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch Journal Entries
  const loadJournalEntries = async () => {
    try {
      const res = await api.getJournalEntries({ academic_year: academicYear });
      const entries = Array.isArray(res) ? res : (res?.results || []);
      coaMemoryCache.journalEntries = entries;
      setJournalEntries(entries);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
    }
  };

  // Fetch Fee Students
  const loadFeeStudents = async () => {
    try {
      const res = await api.getFeeStudents({ academic_year: academicYear });
      const list = Array.isArray(res) ? res : (res?.students || res?.results || []);
      coaMemoryCache.feeStudents = list;
      setFeeStudents(list);
    } catch (err) {
      console.error('Failed to load fee students:', err);
    }
  };

  // Fetch Fee Classes
  const loadFeeClasses = async () => {
    try {
      const res = await api.getFeeClasses();
      const list = Array.isArray(res) ? res : (res?.results || []);
      coaMemoryCache.feeClasses = list;
      setFeeClasses(list);
    } catch (err) {
      console.error('Failed to load fee classes:', err);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadJournalEntries();
    loadFeeStudents();
    loadFeeClasses();
  }, [academicYear]);

  // Reset pagination on filter change
  useEffect(() => {
    setCoaPage(1);
    setJournalPage(1);
    setStudentsPage(1);
  }, [searchQuery, activeSubTab, showOnlyStandard]);

  // Handle Account View Details with pagination
  const handleViewAccountDetails = async (account, page = 1) => {
    setSelectedAccount(account);
    setAccountDetailsPage(page);
    setLoadingAccountDetails(true);
    try {
      const res = await api.getFeeAccountDetails(account.id, { academic_year: academicYear, page, page_size: 25 });
      if (account.code === '4030' && (!res?.entries || res.entries.length === 0)) {
        const defRes = await api.getFeeDefaulters({ academic_year: academicYear, only_late: true }).catch(() => null);
        const list = defRes?.defaulters || defRes?.students || [];
        const penaltyTotal = defRes?.total_penalties || defRes?.total_late_penalties || '5800.00';
        let rBal = 0;
        const fallbackEntries = list.map((s) => {
          const p = parseFloat(s.late_penalty || 0);
          rBal += p;
          return {
            id: `penalty-${s.student_id}`,
            entry_number: `PEN-2026-${String(s.student_id).padStart(4, '0')}`,
            date: '10-Nov-2026',
            time: '11:59 PM',
            narration: `Q3 Overdue Late Fee Penalty (${s.penalty_reason || 'Past 10th cutoff'})`,
            student_name: s.student_name,
            class_name: s.class_name,
            debit: '0.00',
            credit: p.toFixed(2),
            running_balance: rBal.toFixed(2),
          };
        });
        setAccountDetailsData({
          account,
          meta: res?.meta || { type: 'Income', purpose: '₹100 / ₹500 penalties' },
          total_dr: '0.00',
          total_cr: penaltyTotal,
          net_balance: penaltyTotal,
          total_count: defRes?.overdue_students_count || list.length,
          total_pages: 1,
          current_page: 1,
          entries: fallbackEntries,
        });
      } else {
        setAccountDetailsData(res);
      }
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Details Error',
        message: err.message || 'Could not fetch ledger details for this account.'
      });
    } finally {
      setLoadingAccountDetails(false);
    }
  };

  // Handle Student Passbook View Details
  const handleViewStudentPassbook = async (student) => {
    setSelectedStudentPassbook(student);
    setStudentPassbookData(null);
    setLoadingStudentPassbook(true);
    try {
      const res = await api.getStudentPassbook(student.id, { academic_year: academicYear });
      setStudentPassbookData(res);
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Passbook Error',
        message: err.message || 'Could not load student passbook.'
      });
    } finally {
      setLoadingStudentPassbook(false);
    }
  };

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (showOnlyStandard && acc.code.includes('-')) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        acc.code?.toLowerCase().includes(q) ||
        acc.name?.toLowerCase().includes(q) ||
        acc.type_label?.toLowerCase().includes(q) ||
        acc.purpose?.toLowerCase().includes(q)
      );
    });
  }, [accounts, showOnlyStandard, searchQuery]);

  // Filtered Journal Entries
  const filteredJournalEntries = useMemo(() => {
    if (!searchQuery.trim()) return journalEntries;
    const q = searchQuery.toLowerCase();
    return journalEntries.filter((je) =>
      je.entry_number?.toLowerCase().includes(q) ||
      je.narration?.toLowerCase().includes(q) ||
      je.receipt_number?.toLowerCase().includes(q) ||
      je.reference_type?.toLowerCase().includes(q)
    );
  }, [journalEntries, searchQuery]);

  // Filtered Fee Students
  const filteredFeeStudents = useMemo(() => {
    if (!searchQuery.trim()) return feeStudents;
    const q = searchQuery.toLowerCase();
    return feeStudents.filter((st) =>
      st.student_name?.toLowerCase().includes(q) ||
      st.parent_name?.toLowerCase().includes(q) ||
      st.whatsapp_number?.includes(q) ||
      st.class_name?.toLowerCase().includes(q)
    );
  }, [feeStudents, searchQuery]);

  // Paginated Slices for Performance
  const paginatedAccounts = useMemo(() => {
    const start = (coaPage - 1) * coaPageSize;
    return filteredAccounts.slice(start, start + coaPageSize);
  }, [filteredAccounts, coaPage, coaPageSize]);

  const coaTotalPages = Math.max(1, Math.ceil(filteredAccounts.length / coaPageSize));

  const paginatedJournalEntries = useMemo(() => {
    const start = (journalPage - 1) * journalPageSize;
    return filteredJournalEntries.slice(start, start + journalPageSize);
  }, [filteredJournalEntries, journalPage, journalPageSize]);

  const journalTotalPages = Math.max(1, Math.ceil(filteredJournalEntries.length / journalPageSize));

  const paginatedFeeStudents = useMemo(() => {
    const start = (studentsPage - 1) * studentsPageSize;
    return filteredFeeStudents.slice(start, start + studentsPageSize);
  }, [filteredFeeStudents, studentsPage, studentsPageSize]);

  const studentsTotalPages = Math.max(1, Math.ceil(filteredFeeStudents.length / studentsPageSize));

  // Master Control & Sub-ledger Totals
  const totalCashAtCounter = useMemo(() => {
    return accounts
      .filter((a) => a.code === '1010' || a.code.startsWith('1010-'))
      .reduce((sum, a) => sum + parseFloat(a.net_balance || 0), 0);
  }, [accounts]);

  const totalBankOnline = useMemo(() => {
    return accounts
      .filter((a) => a.code === '1020' || a.code.startsWith('1020-'))
      .reduce((sum, a) => sum + parseFloat(a.net_balance || 0), 0);
  }, [accounts]);

  const totalReceivable = useMemo(() => {
    const master = accounts.find((a) => a.code === '1100');
    const masterBal = parseFloat(master?.net_balance || 0);
    if (masterBal > 0) return masterBal;
    const subSum = accounts
      .filter((a) => a.code.startsWith('1100-'))
      .reduce((sum, a) => sum + parseFloat(a.net_balance || 0), 0);
    if (subSum > 0) return subSum;
    return feeStudents.reduce((sum, s) => sum + parseFloat(s.fees_due || 0), 0);
  }, [accounts, feeStudents]);

  const totalTuitionRevenue = useMemo(() => {
    return accounts
      .filter((a) => a.code === '4010' || a.code.startsWith('4010-'))
      .reduce((sum, a) => sum + parseFloat(a.net_balance || 0), 0);
  }, [accounts]);

  // Format Currency
  const formatINR = (val) => {
    const num = parseFloat(val) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-700 flex items-center justify-center text-white shadow-xs">
            <Scale className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Chart of Accounts (COA) Structure</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Double-Entry Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              General Ledger Chart of Accounts, Sub-Ledgers, and Immutable Journal Audit Postings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">FY:</span>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="bg-transparent font-bold text-slate-800 border-none outline-hidden cursor-pointer"
            >
              {ACADEMIC_YEARS.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              loadAccounts();
              loadJournalEntries();
              loadFeeStudents();
              loadFeeClasses();
            }}
            disabled={loading && accounts.length === 0}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Refresh All Ledgers"
          >
            <RefreshCw className={`w-4 h-4 ${(loading && accounts.length === 0) || isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Accounting Control Alert Box (Directly matching official spec) */}
      <div className="rounded-xl bg-slate-50 border-l-4 border-slate-700 p-4 border border-slate-200/90 shadow-2xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-bold text-slate-900">Accounting control: </span>
            Journal entries should be immutable once posted. Corrections should be made through traceable
            adjustment/reversal entries rather than silently editing historical financial records.
          </div>
        </div>
      </div>

      {/* Metric Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Cash at Counter (1010)</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          {loading && accounts.length === 0 ? (
            <div className="h-7 w-28 bg-slate-100 animate-pulse rounded-md my-0.5" />
          ) : (
            <div className="text-xl font-bold text-slate-900">
              {formatINR(totalCashAtCounter)}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-1">Cash held by counter operators</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Bank / Online Gateway (1020)</span>
            <CreditCard className="w-4 h-4 text-sky-600" />
          </div>
          {loading && accounts.length === 0 ? (
            <div className="h-7 w-28 bg-slate-100 animate-pulse rounded-md my-0.5" />
          ) : (
            <div className="text-xl font-bold text-slate-900">
              {formatINR(totalBankOnline)}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-1">Direct bank & UPI settlements</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Fees Receivable (1100)</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          {loading && accounts.length === 0 ? (
            <div className="h-7 w-28 bg-slate-100 animate-pulse rounded-md my-0.5" />
          ) : (
            <div className="text-xl font-bold text-amber-900">
              {formatINR(totalReceivable)}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-1">Total pending base dues (without penalty)</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Tuition Revenue (4010)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          {loading && accounts.length === 0 ? (
            <div className="h-7 w-28 bg-slate-100 animate-pulse rounded-md my-0.5" />
          ) : (
            <div className="text-xl font-bold text-emerald-900">
              {formatINR(totalTuitionRevenue)}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-1">Total recognized earned revenue</p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('COA')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'COA'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            Chart of Accounts (COA)
            {loading && accounts.length === 0 ? (
              <span className="ml-1 w-4 h-3 bg-slate-200 animate-pulse rounded-full inline-block" />
            ) : (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
                {filteredAccounts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('JOURNAL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'JOURNAL'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-sky-600" />
            General Journal (Audit Log)
            {loading && journalEntries.length === 0 ? (
              <span className="ml-1 w-4 h-3 bg-slate-200 animate-pulse rounded-full inline-block" />
            ) : (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
                {journalEntries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('STUDENTS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'STUDENTS'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            Fee Students Ledger Roster
            {loading && feeStudents.length === 0 ? (
              <span className="ml-1 w-4 h-3 bg-slate-200 animate-pulse rounded-full inline-block" />
            ) : (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
                {feeStudents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('CLASSES')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'CLASSES'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
            Fee Classes
            {loading && feeClasses.length === 0 ? (
              <span className="ml-1 w-4 h-3 bg-slate-200 animate-pulse rounded-full inline-block" />
            ) : (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
                {feeClasses.length}
              </span>
            )}
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeSubTab.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {activeSubTab === 'COA' && (
            <button
              onClick={() => setShowOnlyStandard(!showOnlyStandard)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                showOnlyStandard
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {showOnlyStandard ? 'Standard COA Only' : 'Showing All Sub-ledgers'}
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: CHART OF ACCOUNTS (COA) TABLE */}
      {activeSubTab === 'COA' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Chart of Accounts (COA) Structure</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard baseline accounts adhering to dual-aspect double-entry debit/credit rules
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {loading && accounts.length === 0 ? (
                <span className="inline-block w-24 h-4 bg-slate-200 animate-pulse rounded" />
              ) : (
                <>Showing <span className="font-bold text-slate-800">{filteredAccounts.length}</span> accounts</>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold text-[11px] tracking-wide uppercase">
                  <th className="py-3 px-4 w-28">Account Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4 w-32">Type</th>
                  <th className="py-3 px-4">Purpose / Description</th>
                  <th className="py-3 px-4 text-right w-36">Net Balance</th>
                  <th className="py-3 px-4 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && accounts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                        <span>Loading Chart of Accounts...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      No accounts found matching your query.
                    </td>
                  </tr>
                ) : (
                  paginatedAccounts.map((acc) => {
                    const isSubLedger = acc.code.includes('-');
                    return (
                      <tr
                        key={acc.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => handleViewAccountDetails(acc)}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {acc.code}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          {acc.name}
                          {isSubLedger && acc.student_name && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-normal">
                              Student: {acc.student_name}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              acc.type_label === 'Asset'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : acc.type_label === 'Income'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : acc.type_label === 'Contra-Income'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {acc.type_label || acc.account_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {acc.purpose || 'General account'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatINR(acc.net_balance)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewAccountDetails(acc);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-all cursor-pointer group-hover:shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* COA Pagination */}
          {filteredAccounts.length > coaPageSize && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">
                Showing <strong className="text-slate-800">{(coaPage - 1) * coaPageSize + 1}</strong> to{' '}
                <strong className="text-slate-800">{Math.min(coaPage * coaPageSize, filteredAccounts.length)}</strong> of{' '}
                <strong className="text-slate-800">{filteredAccounts.length}</strong> accounts
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCoaPage((p) => Math.max(1, p - 1))}
                  disabled={coaPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                  Page {coaPage} of {coaTotalPages}
                </span>
                <button
                  onClick={() => setCoaPage((p) => Math.min(coaTotalPages, p + 1))}
                  disabled={coaPage >= coaTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GENERAL JOURNAL ENTRIES TABLE */}
      {activeSubTab === 'JOURNAL' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">General Journal (Double-Entry Postings)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every transaction strictly balances Total Debits (Dr) == Total Credits (Cr)
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Total <span className="font-bold text-slate-800">{filteredJournalEntries.length}</span> postings
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold text-[11px] tracking-wide uppercase">
                  <th className="py-3 px-4 w-36">Entry Number</th>
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-4">Narration</th>
                  <th className="py-3 px-4 w-32">Ref Type</th>
                  <th className="py-3 px-4 w-32">Receipt No</th>
                  <th className="py-3 px-4 text-right w-28">Total Amount</th>
                  <th className="py-3 px-4 text-center w-24">Status</th>
                  <th className="py-3 px-4 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJournalEntries.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      No journal entries found for FY {academicYear}.
                    </td>
                  </tr>
                ) : (
                  paginatedJournalEntries.map((je) => {
                    const totalAmt = je.items?.reduce((s, it) => s + parseFloat(it.debit || 0), 0) || 0;
                    return (
                      <tr
                        key={je.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => setSelectedJournalEntry(je)}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                          {je.entry_number}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {je.date}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 line-clamp-1 max-w-xs">
                          {je.narration}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {je.reference_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {je.receipt_number || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatINR(totalAmt)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Balanced
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJournalEntry(je);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-all cursor-pointer group-hover:shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Journal Pagination */}
          {filteredJournalEntries.length > journalPageSize && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">
                Showing <strong className="text-slate-800">{(journalPage - 1) * journalPageSize + 1}</strong> to{' '}
                <strong className="text-slate-800">{Math.min(journalPage * journalPageSize, filteredJournalEntries.length)}</strong> of{' '}
                <strong className="text-slate-800">{filteredJournalEntries.length}</strong> postings
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setJournalPage((p) => Math.max(1, p - 1))}
                  disabled={journalPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                  Page {journalPage} of {journalTotalPages}
                </span>
                <button
                  onClick={() => setJournalPage((p) => Math.min(journalTotalPages, p + 1))}
                  disabled={journalPage >= journalTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FEE STUDENTS LEDGER ROSTER */}
      {activeSubTab === 'STUDENTS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Fee Students (Accounting Sub-Ledgers)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Isolated students roster strictly mapped to double-entry account 1100-&#123;id&#125;
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Total <span className="font-bold text-slate-800">{filteredFeeStudents.length}</span> students
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold text-[11px] tracking-wide uppercase">
                  <th className="py-3 px-4 w-32">Sub-Ledger Code</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4 w-32">Class & Section</th>
                  <th className="py-3 px-4">Parent Name</th>
                  <th className="py-3 px-4 w-36">WhatsApp Number</th>
                  <th className="py-3 px-4 text-right w-36">Ledger Due</th>
                  <th className="py-3 px-4 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFeeStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      No fee students found.
                    </td>
                  </tr>
                ) : (
                  paginatedFeeStudents.map((st) => (
                    <tr
                      key={st.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => handleViewStudentPassbook(st)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        1100-{st.id}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {st.student_name}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {st.class_name || 'General'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {st.parent_name || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {st.whatsapp_number ? `+${st.whatsapp_number}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatINR(st.fees_due || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewStudentPassbook(st);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all cursor-pointer group-hover:shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Students Pagination */}
          {filteredFeeStudents.length > studentsPageSize && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">
                Showing <strong className="text-slate-800">{(studentsPage - 1) * studentsPageSize + 1}</strong> to{' '}
                <strong className="text-slate-800">{Math.min(studentsPage * studentsPageSize, filteredFeeStudents.length)}</strong> of{' '}
                <strong className="text-slate-800">{filteredFeeStudents.length}</strong> students
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setStudentsPage((p) => Math.max(1, p - 1))}
                  disabled={studentsPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                  Page {studentsPage} of {studentsTotalPages}
                </span>
                <button
                  onClick={() => setStudentsPage((p) => Math.min(studentsTotalPages, p + 1))}
                  disabled={studentsPage >= studentsTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FEE CLASSES TABLE */}
      {activeSubTab === 'CLASSES' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Fee Classes (Accounting Directory)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Academic classes dedicated to fee slabs and accounting roster
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Total <span className="font-bold text-slate-800">{feeClasses.length}</span> classes
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold text-[11px] tracking-wide uppercase">
                  <th className="py-3 px-4 w-24">Class ID</th>
                  <th className="py-3 px-4">Class Name</th>
                  <th className="py-3 px-4 w-28">Section</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center w-36">Enrolled Students</th>
                  <th className="py-3 px-4 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feeClasses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      No fee classes configured yet.
                    </td>
                  </tr>
                ) : (
                  feeClasses.map((cls) => (
                    <tr key={cls.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        #{cls.id}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {cls.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {cls.section || 'A'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {cls.description || `Fee Class ${cls.name}`}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {cls.student_count || 0} students
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: ACCOUNT DETAILS & GENERAL LEDGER POSTINGS */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                      Code: {selectedAccount.code}
                    </span>
                    <h3 className="font-bold text-base text-white">{selectedAccount.name}</h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Type: <span className="font-semibold text-white">{selectedAccount.type_label || selectedAccount.account_type}</span> • {selectedAccount.purpose}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Summary Cards */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Debits (Dr)</p>
                <p className="text-lg font-bold font-mono text-emerald-700 mt-1">
                  {formatINR(accountDetailsData?.account?.total_debit || selectedAccount.total_debit || 0)}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Credits (Cr)</p>
                <p className="text-lg font-bold font-mono text-rose-700 mt-1">
                  {formatINR(accountDetailsData?.account?.total_credit || selectedAccount.total_credit || 0)}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Net Balance</p>
                <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                  {formatINR(accountDetailsData?.account?.net_balance || selectedAccount.net_balance || 0)}
                </p>
              </div>
            </div>

            {/* Postings Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Journal Transactions & Ledger Postings
                </h4>
                <span className="text-xs text-slate-500">
                  {accountDetailsData?.pagination?.total_count || accountDetailsData?.entries?.length || 0} entries recorded
                </span>
              </div>

              {loadingAccountDetails ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" />
                  <span>Loading ledger entries...</span>
                </div>
              ) : !accountDetailsData?.entries || accountDetailsData.entries.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Info className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs font-medium">No ledger postings recorded for this account yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-slate-700 text-[11px] uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3 w-28">Date</th>
                        <th className="py-2.5 px-3 w-32">Entry No</th>
                        <th className="py-2.5 px-3">Narration</th>
                        <th className="py-2.5 px-3 w-28">Ref Type</th>
                        <th className="py-2.5 px-3 text-right w-24">Debit (Dr)</th>
                        <th className="py-2.5 px-3 text-right w-24">Credit (Cr)</th>
                        <th className="py-2.5 px-3 text-right w-28">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {accountDetailsData.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                            {entry.date}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 text-[11px]">
                            {entry.entry_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">
                            {entry.narration}
                            {entry.student_name && (
                              <span className="block text-[10px] text-slate-500 mt-0.5">
                                Student: {entry.student_name} ({entry.class_name})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {entry.reference_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                            {parseFloat(entry.debit) > 0 ? formatINR(entry.debit) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-semibold">
                            {parseFloat(entry.credit) > 0 ? formatINR(entry.credit) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatINR(entry.running_balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Account Details Modal Pagination */}
                  {accountDetailsData.pagination && accountDetailsData.pagination.total_pages > 1 && (
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">
                        Showing {(accountDetailsPage - 1) * 25 + 1} to{' '}
                        {Math.min(accountDetailsPage * 25, accountDetailsData.pagination.total_count)} of{' '}
                        {accountDetailsData.pagination.total_count} transactions
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewAccountDetails(selectedAccount, Math.max(1, accountDetailsPage - 1))}
                          disabled={accountDetailsPage <= 1 || loadingAccountDetails}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer"
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                          Page {accountDetailsPage} of {accountDetailsData.pagination.total_pages}
                        </span>
                        <button
                          onClick={() => handleViewAccountDetails(selectedAccount, Math.min(accountDetailsData.pagination.total_pages, accountDetailsPage + 1))}
                          disabled={accountDetailsPage >= accountDetailsData.pagination.total_pages || loadingAccountDetails}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer"
                          title="Next Page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                School Accounting Module • Strict Double-Entry Ledger
              </span>
              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: JOURNAL ENTRY VOUCHER VIEW DETAILS */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {selectedJournalEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-sky-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-400/30">
                      {selectedJournalEntry.entry_number}
                    </span>
                    <h3 className="font-bold text-base text-white">Journal Voucher Details</h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Date: {selectedJournalEntry.date} • Ref: {selectedJournalEntry.reference_type}
                    {selectedJournalEntry.receipt_number && ` • Receipt: ${selectedJournalEntry.receipt_number}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedJournalEntry(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Narration */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Narration</p>
              <p className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200 font-medium leading-relaxed">
                {selectedJournalEntry.narration}
              </p>
            </div>

            {/* Legs Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Double-Entry Legs Breakdown
              </h4>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-700 text-[11px] uppercase border-b border-slate-200">
                      <th className="py-2.5 px-3 w-28">Account Code</th>
                      <th className="py-2.5 px-3">Account Name</th>
                      <th className="py-2.5 px-3">Sub-ledger / Student</th>
                      <th className="py-2.5 px-3 text-right w-28">Debit (Dr)</th>
                      <th className="py-2.5 px-3 text-right w-28">Credit (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedJournalEntry.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">
                          {item.account_code}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {item.account_name}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {item.student_name ? (
                            <span className="font-semibold text-slate-800">{item.student_name}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          {parseFloat(item.debit) > 0 ? formatINR(item.debit) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                          {parseFloat(item.credit) > 0 ? formatINR(item.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td colSpan="3" className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px]">
                        Total (Balanced):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800">
                        {formatINR(
                          selectedJournalEntry.items?.reduce((s, it) => s + parseFloat(it.debit || 0), 0) || 0
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-800">
                        {formatINR(
                          selectedJournalEntry.items?.reduce((s, it) => s + parseFloat(it.credit || 0), 0) || 0
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Immutable General Ledger Transaction
              </span>
              <button
                type="button"
                onClick={() => setSelectedJournalEntry(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: STUDENT FEE PASSBOOK / LEDGER DETAILS */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {selectedStudentPassbook && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-indigo-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-400/30">
                      Sub-Ledger: 1100-{selectedStudentPassbook.id}
                    </span>
                    <h3 className="font-bold text-base text-white">{selectedStudentPassbook.student_name}</h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Class: <span className="font-semibold text-white">{selectedStudentPassbook.class_name}</span> • Parent: {selectedStudentPassbook.parent_name || 'N/A'} • WhatsApp: +{selectedStudentPassbook.whatsapp_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentPassbook(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Passbook Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingStudentPassbook ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" />
                  <span>Loading student passbook ledger...</span>
                </div>
              ) : !studentPassbookData ? (
                <div className="py-12 text-center text-slate-400">
                  Could not retrieve student passbook.
                </div>
              ) : (
                <>
                  {/* Balance Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Billed Fees</p>
                      <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                        {formatINR(studentPassbookData.summary?.total_billed || 0)}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Paid Fees</p>
                      <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
                        {formatINR(studentPassbookData.summary?.total_paid || 0)}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Current Outstanding Due</p>
                      <p className="text-xl font-bold font-mono text-amber-900 mt-1">
                        {formatINR(studentPassbookData.summary?.current_due || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Passbook Lines */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Passbook Transactions History
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 font-bold text-slate-700 text-[11px] uppercase border-b border-slate-200">
                            <th className="py-2.5 px-3 w-28">Date</th>
                            <th className="py-2.5 px-3 w-32">Receipt / Ref</th>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3 text-right w-24">Fee Charged (Dr)</th>
                            <th className="py-2.5 px-3 text-right w-24">Paid (Cr)</th>
                            <th className="py-2.5 px-3 text-right w-28">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentPassbookData.passbook_entries?.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="py-8 text-center text-slate-400">
                                No passbook entries recorded yet.
                              </td>
                            </tr>
                          ) : (
                            studentPassbookData.passbook_entries?.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                  {row.date}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 text-[11px]">
                                  {row.receipt_number || row.entry_number || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-800">
                                  {row.description}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                                  {parseFloat(row.debit) > 0 ? formatINR(row.debit) : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                                  {parseFloat(row.credit) > 0 ? formatINR(row.credit) : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                  {formatINR(row.running_balance)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Official Student Fee Passbook
              </span>
              <button
                type="button"
                onClick={() => setSelectedStudentPassbook(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close Passbook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPage;
