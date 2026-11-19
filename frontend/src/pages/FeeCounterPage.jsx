import React, { useState, useEffect } from 'react';
import {
  Search,
  IndianRupee,
  ShieldCheck,
  Send,
  CheckCircle,
  AlertTriangle,
  Clock,
  Printer,
  X,
  Loader2,
  User,
  GraduationCap,
  KeyRound,
  RotateCcw,
  Users,
  Filter,
  Calendar,
  AlertCircle,
  BookOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../services/api';
import { sortClassesAscending } from '../utils/classSort';

// Module-level in-memory cache for Quarter Due & Defaulters List (SWR)
const defaultersMemoryCache = {
  data: null,
  totalPages: 1,
};

export function FeeCounterPage({ showToast }) {
  // Sub-tabs: 'counter' | 'defaulters'
  const [activeTab, setActiveTab] = useState('counter');

  const [searchQuery, setSearchQuery] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [searching, setSearching] = useState(false);

  // Active Selected Student
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feeSummary, setFeeSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Cash Payment Form (Transition year starts Oct / Q3)
  const [cashAmount, setCashAmount] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('Q3');
  const [initiatingSession, setInitiatingSession] = useState(false);

  // OTP Verification Modal
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpSession, setOtpSession] = useState(null);
  const [inputOtp, setInputOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [countdown, setCountdown] = useState(300);

  // Receipt Modal on Successful Payment
  const [verifiedReceipt, setVerifiedReceipt] = useState(null);

  // Defaulters / Due Fees Section State (initialized from memory cache for instant rendering)
  const [defaultersData, setDefaultersData] = useState(() => defaultersMemoryCache.data || {
    defaulters: [],
    total_students: 0,
    overdue_students_count: 0,
    total_outstanding_dues: '0',
    total_penalties: '0',
  });
  const [loadingDefaulters, setLoadingDefaulters] = useState(() => !defaultersMemoryCache.data);
  const [isRefreshingDefaulters, setIsRefreshingDefaulters] = useState(false);
  const [defaulterQuarter, setDefaulterQuarter] = useState('TILL_NOW');
  const [onlyLate, setOnlyLate] = useState(false);
  const [defaulterClassId, setDefaulterClassId] = useState('');
  const [defaulterSearch, setDefaulterSearch] = useState('');
  const [defaulterPage, setDefaulterPage] = useState(1);
  const [defaulterPageSize, setDefaulterPageSize] = useState(25);
  const [defaulterTotalPages, setDefaulterTotalPages] = useState(() => defaultersMemoryCache.totalPages || 1);

  // Passbook Section State
  const [passbookStudent, setPassbookStudent] = useState(null);
  const [passbookData, setPassbookData] = useState(null);
  const [loadingPassbook, setLoadingPassbook] = useState(false);
  const [passbookSearch, setPassbookSearch] = useState('');
  const [passbookClassId, setPassbookClassId] = useState('');
  const [passbookStudents, setPassbookStudents] = useState([]);
  const [searchingPassbookStudents, setSearchingPassbookStudents] = useState(false);

  // Offline / Transition Payment Modal (from Quarter Due List - No OTP)
  const [offlineModalStudent, setOfflineModalStudent] = useState(null);
  const [offlineAmount, setOfflineAmount] = useState('');
  const [offlineDate, setOfflineDate] = useState('2026-11-10');
  const [offlineWaivePenalty, setOfflineWaivePenalty] = useState(true);
  const [offlineReceiptNo, setOfflineReceiptNo] = useState('');
  const [offlinePaymentMode, setOfflinePaymentMode] = useState('CASH');
  const [recordingOffline, setRecordingOffline] = useState(false);

  const handleOpenOfflineModal = (defaulter) => {
    setOfflineModalStudent(defaulter);
    setOfflineWaivePenalty(true);
    setOfflineDate('2026-11-10');
    // Pre-fill base tuition due when waived
    setOfflineAmount(String(defaulter.base_due || defaulter.total_payable || ''));
    setOfflineReceiptNo('');
    setOfflinePaymentMode('CASH');
  };

  const handleToggleOfflineWaive = (waive) => {
    setOfflineWaivePenalty(waive);
    if (!offlineModalStudent) return;
    const baseDue = Number(offlineModalStudent.base_due || 0);
    const penaltyAmt = Number(offlineModalStudent.late_penalty || 0);
    if (waive) {
      // If waived (checked): only base due
      setOfflineAmount(String(baseDue > 0 ? baseDue : (offlineModalStudent.total_payable || '')));
    } else {
      // If not waived (unchecked): add late fee penalty
      const totalWithPen = baseDue + penaltyAmt;
      setOfflineAmount(String(totalWithPen > 0 ? totalWithPen : (offlineModalStudent.total_payable || '')));
    }
  };

  const handleOfflineDateChange = (newDate) => {
    setOfflineDate(newDate);
    if (!offlineModalStudent) return;
    const cutoff = getQuarterCutoff(offlineModalStudent.quarter || selectedQuarter || 'Q3');
    // If date is on or before cutoff, automatically check waive
    if (newDate <= cutoff) {
      setOfflineWaivePenalty(true);
      const baseDue = Number(offlineModalStudent.base_due || 0);
      setOfflineAmount(String(baseDue > 0 ? baseDue : (offlineModalStudent.total_payable || '')));
    }
  };

  const handleSubmitOfflinePayment = async (e) => {
    e.preventDefault();
    if (!offlineModalStudent || !offlineAmount || Number(offlineAmount) <= 0) {
      showToast?.({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid amount.' });
      return;
    }

    setRecordingOffline(true);
    try {
      const res = await api.recordOfflinePayment({
        student_id: offlineModalStudent.student_id,
        amount: offlineAmount,
        quarter: offlineModalStudent.quarter || selectedQuarter || 'Q3',
        academic_year: '2026-2027',
        payment_date: offlineDate,
        payment_mode: offlinePaymentMode,
        receipt_number: offlineReceiptNo.trim() || undefined,
        waive_penalty: offlineWaivePenalty,
        operator_name: 'Fee Counter Operator',
      });

      showToast?.({
        type: 'success',
        title: 'Offline Payment Recorded!',
        message: `Payment of ₹${Number(offlineAmount).toLocaleString('en-IN')} recorded for ${offlineModalStudent.student_name}. Dues cleared!`,
      });

      setOfflineModalStudent(null);
      // Immediately reload the defaulters list
      loadDefaulters();
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Recording Failed',
        message: err.message || 'Could not record offline payment.',
      });
    } finally {
      setRecordingOffline(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const loadDefaulters = async (pageToLoad = defaulterPage, pageSizeToLoad = defaulterPageSize) => {
    // SWR: silent background revalidation if data is already cached
    if (!defaultersMemoryCache.data || (defaultersData.defaulters && defaultersData.defaulters.length === 0)) {
      setLoadingDefaulters(true);
    } else {
      setIsRefreshingDefaulters(true);
    }
    try {
      const res = await api.getFeeDefaulters({
        quarter: defaulterQuarter,
        class_id: defaulterClassId || undefined,
        only_late: onlyLate ? 'true' : 'false',
        search: defaulterSearch.trim() || undefined,
        academic_year: '2026-2027',
        page: pageToLoad,
        page_size: pageSizeToLoad,
      });
      const nextData = {
        defaulters: res.defaulters || [],
        total_students: res.total_students || 0,
        overdue_students_count: res.overdue_students_count || 0,
        total_outstanding_dues: res.total_outstanding_dues || '0',
        total_penalties: res.total_penalties || '0',
      };
      defaultersMemoryCache.data = nextData;
      defaultersMemoryCache.totalPages = res.total_pages || 1;
      setDefaultersData(nextData);
      setDefaulterTotalPages(res.total_pages || 1);
      setDefaulterPage(res.page || pageToLoad);
    } catch (err) {
      showToast?.({ type: 'error', title: 'Defaulters Error', message: 'Failed to load fee dues list.' });
    } finally {
      setLoadingDefaulters(false);
      setIsRefreshingDefaulters(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'defaulters') {
      setDefaulterPage(1);
      loadDefaulters(1, defaulterPageSize);
    }
  }, [activeTab, defaulterQuarter, onlyLate, defaulterClassId]);

  const getQuarterCutoff = (quarter) => {
    if (quarter === 'Q3' || quarter === 'TILL_NOW' || quarter === 'ANNUAL') return '2026-11-10';
    if (quarter === 'Q4') return '2027-02-10';
    if (quarter === 'Q1') return '2026-05-10';
    if (quarter === 'Q2') return '2026-08-10';
    return '2026-11-10';
  };

  const handleQuickCollect = (defaulter) => {
    setActiveTab('counter');
    const stObj = {
      id: defaulter.student_id,
      student_name: defaulter.student_name,
      parent_name: defaulter.parent_name,
      whatsapp_number: defaulter.whatsapp_number,
      class_name: defaulter.class_name,
      fees_due: defaulter.base_due,
    };
    const targetQ = defaulter.quarter || 'Q3';
    setSelectedQuarter(targetQ);
    handleSelectStudent(stObj, targetQ);
  };

  const loadClasses = async () => {
    try {
      const res = api.getFeeClasses ? await api.getFeeClasses() : await api.getClasses();
      const list = Array.isArray(res) ? res : (res?.results || res?.classes || []);
      setClasses(sortClassesAscending(list));
    } catch (err) {
      console.error('Failed to load classes in fee counter:', err);
    }
  };

  // Load Passbook for a given student
  const handleLoadPassbook = async (student) => {
    if (!student) return;
    setPassbookStudent(student);
    setPassbookStudents([]);
    setPassbookData(null);
    setLoadingPassbook(true);
    try {
      const data = await api.getStudentPassbook(student.id, { academic_year: '2026-2027' });
      setPassbookData(data);
    } catch (err) {
      showToast?.({ type: 'error', title: 'Error', message: 'Failed to load student passbook.' });
    } finally {
      setLoadingPassbook(false);
    }
  };

  // Search students within Passbook tab
  const handleSearchPassbookStudents = async (e) => {
    e?.preventDefault();
    if (!passbookSearch.trim() && !passbookClassId) {
      showToast?.({
        type: 'info',
        title: 'Search Required',
        message: 'Please enter student name, mobile or select class to search passbook.',
      });
      return;
    }

    setSearchingPassbookStudents(true);
    try {
      const res = api.getFeeStudents
        ? await api.getFeeStudents({ search: passbookSearch.trim(), class_id: passbookClassId || undefined })
        : await api.getStudents({ search: passbookSearch.trim(), class_id: passbookClassId || undefined, limit: 25 });
      const list = res.students || res || [];
      const sorted = Array.isArray(list) ? list : [];

      if (sorted.length === 0) {
        showToast?.({ type: 'warning', title: 'Not Found', message: 'No student found matching your search.' });
        setPassbookStudents([]);
      } else if (sorted.length === 1) {
        setPassbookStudents([]);
        handleLoadPassbook(sorted[0]);
      } else {
        setPassbookStudents(sorted);
      }
    } catch (err) {
      showToast?.({ type: 'error', title: 'Search Failed', message: 'Could not search students for passbook.' });
    } finally {
      setSearchingPassbookStudents(false);
    }
  };

  // Search Students
  const handleSearchStudents = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim() && !selectedClassId) return;

    setSearching(true);
    try {
      // 1. Search with live quarter breakdown and penalties for searched students
      const defaultersRes = await api.getFeeDefaulters({
        quarter: selectedQuarter,
        class_id: selectedClassId || undefined,
        search: searchQuery.trim(),
        only_late: false,
      });

      if (defaultersRes?.defaulters && defaultersRes.defaulters.length > 0) {
        const mapped = defaultersRes.defaulters.map((d) => ({
          id: d.student_id,
          student_name: d.student_name,
          parent_name: d.parent_name,
          whatsapp_number: d.whatsapp_number,
          class_name: d.class_name,
          quarter_due: d.base_due,
          late_penalty: d.late_penalty,
          total_payable: d.total_payable,
          fees_due: d.total_payable || d.base_due,
          is_overdue: d.is_overdue,
          status: d.status,
        }));
        setStudents(mapped);
        if (mapped.length === 1) {
          handleSelectStudent(mapped[0]);
        }
      } else {
        const res = api.getFeeStudents
          ? await api.getFeeStudents({ search: searchQuery.trim(), class_id: selectedClassId || undefined })
          : await api.getStudents({ search: searchQuery.trim(), class_id: selectedClassId || undefined, limit: 25 });
        const list = res.students || res || [];
        const arr = Array.isArray(list) ? list : [];
        setStudents(arr);
        if (arr.length === 1) {
          handleSelectStudent(arr[0]);
        }
      }
    } catch (err) {
      showToast?.({ type: 'error', title: 'Search Failed', message: 'Could not search students.' });
    } finally {
      setSearching(false);
    }
  };

  // Select a Student & Fetch Live Ledger Due & Penalty
  const handleSelectStudent = async (st, targetQuarter = selectedQuarter) => {
    setSelectedStudent(st);
    setFeeSummary(null);
    setCashAmount('');
    setLoadingSummary(true);

    try {
      const data = await api.getOperatorStudentFeeSummary(st.id, {
        quarter: targetQuarter,
      });
      setFeeSummary(data);
      if (Number(data.total_payable_now) > 0) {
        setCashAmount(data.total_payable_now);
      }
      // Instantly update the selected student card on the left with live calculated fees!
      const activeDue = data.total_payable_now || data.quarter_base_due || data.current_due;
      setStudents((prev) =>
        prev.map((item) =>
          item.id === st.id
            ? {
                ...item,
                quarter_due: data.quarter_base_due,
                total_payable: data.total_payable_now,
                late_penalty: data.penalty?.amount,
                fees_due: activeDue,
              }
            : item
        )
      );
      setSelectedStudent((prev) =>
        prev && prev.id === st.id
          ? {
              ...prev,
              quarter_due: data.quarter_base_due,
              total_payable: data.total_payable_now,
              late_penalty: data.penalty?.amount,
              fees_due: activeDue,
            }
          : prev
      );
    } catch (err) {
      showToast?.({ type: 'error', title: 'Error', message: 'Failed to fetch student fee ledger.' });
    } finally {
      setLoadingSummary(false);
    }
  };

  // Step 1: Initiate Cash Collection & Send OTP to Parent WhatsApp
  const handleInitiateCashPayment = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !cashAmount || Number(cashAmount) <= 0) {
      showToast?.({ type: 'error', title: 'Invalid Amount', message: 'Please enter valid cash amount.' });
      return;
    }

    setInitiatingSession(true);
    try {
      const res = await api.sendCashPaymentOTP({
        student_id: selectedStudent.id,
        amount: cashAmount,
        quarter: selectedQuarter,
        academic_year: '2026-2027',
        operator_name: 'Fee Counter Operator',
      });

      setOtpSession(res);
      setInputOtp('');
      setCountdown(res.expires_in_seconds || 300);
      setShowOtpModal(true);
      if (res.whatsapp_warning) {
        showToast?.({
          type: 'warning',
          title: 'WhatsApp Notice',
          message: `OTP generated. WhatsApp note: ${res.whatsapp_warning}`,
        });
      } else {
        showToast?.({
          type: 'success',
          title: 'OTP Dispatched',
          message: `OTP sent to parent's WhatsApp (${res.parent_phone_masked}).`,
        });
      }
    } catch (err) {
      showToast?.({ type: 'error', title: 'Failed to Send OTP', message: err.message || 'OTP dispatch failed.' });
    } finally {
      setInitiatingSession(false);
    }
  };

  // Countdown timer for OTP
  useEffect(() => {
    let timer = null;
    if (showOtpModal && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, countdown]);

  // Step 2: Verify OTP & Commit to Double-Entry Ledger
  const handleVerifyOtpAndCollect = async (e) => {
    e.preventDefault();
    if (!inputOtp || inputOtp.trim().length !== 6) {
      showToast?.({ type: 'error', title: 'Invalid OTP', message: 'Please enter 6-digit OTP code.' });
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await api.verifyPaymentOTP({
        session_id: otpSession.session_id,
        otp_code: inputOtp.trim(),
        operator_name: 'Fee Counter Operator',
      });

      setShowOtpModal(false);
      setVerifiedReceipt(res);
      showToast?.({
        type: 'success',
        title: 'Payment Verified!',
        message: `Receipt ${res.receipt_number} generated and sent to WhatsApp.`,
      });

      // Refresh student dues
      handleSelectStudent(selectedStudent, selectedQuarter);
    } catch (err) {
      showToast?.({ type: 'error', title: 'Verification Failed', message: err.message || 'Incorrect OTP code.' });
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              OPERATOR CASH DESK
            </span>
            <span className="text-xs font-semibold text-slate-500">Anti-Fraud OTP Verification</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Cash Collection Counter &amp; Receipt Desk
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accept physical cash with parent OTP verification. Every payment is automatically recorded in the Double-Entry General Ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Anti-Theft Active</span>
          </span>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('counter')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'counter'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <IndianRupee className="w-3.5 h-3.5" />
          <span>Cash Counter &amp; OTP Desk</span>
        </button>

        <button
          onClick={() => setActiveTab('defaulters')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'defaulters'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Quarter Due List</span>
          {defaultersData.overdue_students_count > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none">
              {defaultersData.overdue_students_count}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('passbook');
            if (selectedStudent && !passbookStudent) {
              handleLoadPassbook(selectedStudent);
            }
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'passbook'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Student Fee Passbook</span>
        </button>
      </div>

      {/* ── Tab 1: Main 2-Column Interface (Search & Counter Desk) ── */}
      {activeTab === 'counter' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Student Search & Selection (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-600" />
            <span>1. Search Student at Counter</span>
          </h3>

          <form onSubmit={handleSearchStudents} className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name or mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section ? `(${c.section})` : ''}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Search</span>}
              </button>
            </div>
          </form>

          {/* Student Search Results List */}
          <div className="space-y-1.5 max-h-[440px] overflow-y-auto no-scrollbar pt-2 border-t border-slate-100">
            {students.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                Search by name or select a class above to find student.
              </p>
            ) : (
              students.map((st) => {
                const isSelected = selectedStudent?.id === st.id;
                return (
                  <div
                    key={st.id}
                    onClick={() => handleSelectStudent(st)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold truncate">{st.student_name}</h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        Parent: {st.parent_name || 'N/A'} &bull; {st.whatsapp_number}
                      </p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mt-1 inline-block">
                        {st.class_name || 'General Class'}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-900 block">
                        ₹{Number(
                          (isSelected && feeSummary?.total_payable_now !== undefined)
                            ? feeSummary.total_payable_now
                            : (st.total_payable !== undefined
                                ? st.total_payable
                                : (st.quarter_due !== undefined ? st.quarter_due : (st.fees_due || 0)))
                        ).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {(isSelected && Number(feeSummary?.penalty?.amount || 0) > 0) || (Number(st.late_penalty || 0) > 0)
                          ? 'Due + Late Fee'
                          : `${selectedQuarter} Due`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Fee Details & Cash Collection with OTP (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 space-y-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-600" />
            <span>2. Fee Ledger Balance &amp; Cash Collection Desk</span>
          </h3>

          {!selectedStudent ? (
            <div className="p-12 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <User className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">No Student Selected</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                Select a student from the left panel to inspect their live double-entry ledger and collect cash.
              </p>
            </div>
          ) : loadingSummary ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">Calculating live ledger dues &amp; late penalty...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Student Header Snapshot */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-slate-900">{feeSummary.student_name}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {feeSummary.class_name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Parent: <strong className="text-slate-700">{feeSummary.parent_name || 'N/A'}</strong> &bull; WhatsApp: <strong className="text-slate-700">{feeSummary.whatsapp_number}</strong>
                  </p>
                  {feeSummary.fee_slab && (
                    <p className="text-[11px] text-teal-700 font-semibold mt-1">
                      Assigned Slab: {feeSummary.fee_slab.name} (₹{feeSummary.fee_slab.quarterly_fee}/qtr)
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Payable Now
                  </span>
                  <span className="text-xl font-black text-slate-900 flex items-center justify-end">
                    <IndianRupee className="w-5 h-5 text-emerald-600" />
                    <span>{Number(feeSummary.total_payable_now).toLocaleString('en-IN')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('passbook');
                      handleLoadPassbook(selectedStudent);
                    }}
                    className="mt-2 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-xs ml-auto cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3 text-emerald-600" />
                    <span>View Passbook</span>
                  </button>
                </div>
              </div>

              {/* Due & Penalty Breakdown Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 block">
                      {selectedQuarter === 'ANNUAL' ? 'Annual Ledger Due (Full Year):' : `Ledger Due (${feeSummary.quarter_name || selectedQuarter}):`}
                    </span>
                    {feeSummary.annual_ledger_due && selectedQuarter !== 'ANNUAL' && (
                      <span className="text-[10px] text-slate-400 font-semibold" title="Full Academic Year Dues">
                        Year: ₹{Number(feeSummary.annual_ledger_due).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <span className="text-base font-bold text-slate-900 flex items-center mt-0.5">
                    <IndianRupee className="w-4 h-4 text-slate-400" />
                    <span>{Number(feeSummary.current_due).toLocaleString('en-IN')}</span>
                  </span>
                  {selectedQuarter !== 'ANNUAL' && feeSummary.annual_ledger_due && (
                    <span className="text-[10px] text-emerald-700 font-medium block mt-1">
                      Active: ₹{Number(feeSummary.total_ledger_due || feeSummary.current_due).toLocaleString('en-IN')} till now
                    </span>
                  )}
                </div>

                <div className={`p-3 rounded-xl border ${Number(feeSummary.penalty?.amount || 0) > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${Number(feeSummary.penalty?.amount || 0) > 0 ? 'text-amber-900' : 'text-slate-500'}`}>
                      Late Fee Penalty:
                    </span>
                    <span className={`text-base font-bold flex items-center ${Number(feeSummary.penalty?.amount || 0) > 0 ? 'text-amber-900' : 'text-slate-900'}`}>
                      <IndianRupee className="w-4 h-4" />
                      <span>{Number(feeSummary.penalty?.amount || 0).toLocaleString('en-IN')}</span>
                    </span>
                  </div>
                  <p className={`text-[10px] mt-1 line-clamp-1 ${Number(feeSummary.penalty?.amount || 0) > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                    {feeSummary.penalty?.reason || 'No late penalty applicable'}
                  </p>
                </div>
              </div>

              {/* Quarterly Fee Breakdown Table */}
              {feeSummary.quarterly_breakdown && feeSummary.quarterly_breakdown.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">Quarterly Fee Breakdown &amp; Overdue Status</span>
                    <span className="text-[10px] text-slate-500">Cutoff: 10th of 2nd Month</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-3">Quarter</th>
                          <th className="py-2 px-3 text-right">Billed</th>
                          <th className="py-2 px-3 text-right">Paid</th>
                          <th className="py-2 px-3 text-right">Due</th>
                          <th className="py-2 px-3 text-right">Late Penalty</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {feeSummary.quarterly_breakdown.map((q) => (
                          <tr key={q.quarter} className={q.is_overdue ? 'bg-red-50/40' : ''}>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {q.name}
                              <span className="block text-[9px] text-slate-400 font-normal">Cutoff: {q.cutoff_date}</span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono">₹{Number(q.billed).toLocaleString('en-IN')}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700">₹{Number(q.paid).toLocaleString('en-IN')}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">₹{Number(q.due).toLocaleString('en-IN')}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                              {Number(q.penalty) > 0 ? `+₹${Number(q.penalty).toLocaleString('en-IN')}` : '₹0'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                q.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                                q.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                                q.status === 'PARTIAL' ? 'bg-blue-100 text-blue-800' :
                                q.status === 'NOT_BILLED' ? 'bg-slate-100 text-slate-600' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {q.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cash Collection Form */}
              <form onSubmit={handleInitiateCashPayment} className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Cash Payment Authorization</span>
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-800">
                    Parent WhatsApp Verification Required
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Billing Quarter / Mode:</label>
                    <select
                      value={selectedQuarter}
                      onChange={(e) => {
                        const newQ = e.target.value;
                        setSelectedQuarter(newQ);
                        if (selectedStudent) {
                          handleSelectStudent(selectedStudent, newQ);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                    >
                      <option value="Q3">Q3 (Oct - Dec) &bull; Current Active Quarter</option>
                      <option value="TILL_NOW">Till Now Due (All Commenced: Q3)</option>
                      <option value="ANNUAL">Pay Annually (Full Year Dues: Q3 &amp; Q4)</option>
                      <option value="Q4">Q4 (Jan - Mar)</option>
                      <option value="Q1">Q1 (Apr - Jun) &bull; Pre-Portal Legacy</option>
                      <option value="Q2">Q2 (Jul - Sep) &bull; Pre-Portal Legacy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cash Received (₹):</label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        required
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={initiatingSession || !cashAmount || Number(cashAmount) <= 0}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer mt-1"
                >
                  {initiatingSession ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Send OTP to Parent WhatsApp &amp; Collect Cash</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Tab 2: Quarter Due & Defaulters List ── */}
      {activeTab === 'defaulters' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-5 shadow-xs">
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Quarter Due List</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time ledger dues with automatic 10th-cutoff penalty tracking (₹100 for current overdue, ₹500 for prior quarters).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadDefaulters(1)}
                disabled={loadingDefaulters && defaultersData.defaulters.length === 0}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${(loadingDefaulters && defaultersData.defaulters.length === 0) || isRefreshingDefaulters ? 'animate-spin text-emerald-600' : ''}`} />
                <span>{isRefreshingDefaulters ? 'Syncing...' : 'Refresh List'}</span>
              </button>
            </div>
          </div>

          {/* Metric Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Total Due Students</span>
              {loadingDefaulters && defaultersData.defaulters.length === 0 ? (
                <div className="h-6 w-16 bg-slate-200 animate-pulse rounded mt-1" />
              ) : (
                <span className="text-lg font-black text-slate-900 mt-0.5 block">{defaultersData.total_students}</span>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
              <span className="text-[11px] font-bold text-red-700 block">Overdue Students</span>
              {loadingDefaulters && defaultersData.defaulters.length === 0 ? (
                <div className="h-6 w-16 bg-red-200/60 animate-pulse rounded mt-1" />
              ) : (
                <span className="text-lg font-black text-red-900 mt-0.5 block">{defaultersData.overdue_students_count}</span>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Outstanding Base Dues</span>
              {loadingDefaulters && defaultersData.defaulters.length === 0 ? (
                <div className="h-6 w-24 bg-slate-200 animate-pulse rounded mt-1" />
              ) : (
                <span className="text-lg font-black text-slate-900 mt-0.5 flex items-center">
                  <IndianRupee className="w-4 h-4 text-slate-400" />
                  <span>{Number(defaultersData.total_outstanding_dues).toLocaleString('en-IN')}</span>
                </span>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <span className="text-[11px] font-bold text-amber-800 block">Total Late Penalties</span>
              {loadingDefaulters && defaultersData.defaulters.length === 0 ? (
                <div className="h-6 w-24 bg-amber-200/60 animate-pulse rounded mt-1" />
              ) : (
                <span className="text-lg font-black text-amber-900 mt-0.5 flex items-center">
                  <IndianRupee className="w-4 h-4 text-amber-600" />
                  <span>{Number(defaultersData.total_penalties).toLocaleString('en-IN')}</span>
                </span>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
            {/* Quarter Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-slate-600">Quarter View:</span>
              <select
                value={defaulterQuarter}
                onChange={(e) => setDefaulterQuarter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
              >
                <option value="TILL_NOW">Till Now Due (All Commenced to Date) &bull; Default</option>
                <option value="ANNUAL">Annual Fee (Full Year / All Quarters)</option>
                <option value="Q3">Q3 (Oct - Dec) &bull; Portal Active (Cutoff 10-Nov)</option>
                <option value="Q4">Q4 (Jan - Mar) &bull; Cutoff 10-Feb</option>
                <option value="Q1">Q1 (Apr - Jun) &bull; Pre-Portal Legacy</option>
                <option value="Q2">Q2 (Jul - Sep) &bull; Pre-Portal Legacy</option>
              </select>
            </div>

            {/* Class Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-slate-600">Class:</span>
              <select
                value={defaulterClassId}
                onChange={(e) => setDefaulterClassId(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section ? `(${c.section})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or phone..."
                value={defaulterSearch}
                onChange={(e) => setDefaulterSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadDefaulters()}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-emerald-500 outline-hidden"
              />
            </div>

            {/* Only Late Overdue Toggle */}
            <label className="flex items-center gap-2 text-xs font-bold text-red-700 cursor-pointer shrink-0 select-none bg-white px-3 py-1.5 rounded-lg border border-red-200">
              <input
                type="checkbox"
                checked={onlyLate}
                onChange={(e) => setOnlyLate(e.target.checked)}
                className="accent-red-600 rounded"
              />
              <span>Only Overdue (Past Cutoff)</span>
            </label>
          </div>

          {/* Table */}
          {loadingDefaulters && defaultersData.defaulters.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">Loading student ledger balances...</p>
            </div>
          ) : defaultersData.defaulters.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No Pending Dues Found</p>
              <p className="text-[11px] text-slate-400 mt-1">
                All students are clear of dues for the selected filter!
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Student &amp; Class</th>
                      <th className="py-2.5 px-3">Parent Contact</th>
                      <th className="py-2.5 px-3">Quarter</th>
                      <th className="py-2.5 px-3 text-right">Base Due</th>
                      <th className="py-2.5 px-3 text-right">Late Penalty</th>
                      <th className="py-2.5 px-3 text-right">Total Payable</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {defaultersData.defaulters.map((d) => (
                      <tr key={d.student_id} className={`hover:bg-slate-50/80 transition-colors ${d.is_overdue ? 'bg-red-50/30' : ''}`}>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{d.student_name}</div>
                          <span className="text-[10px] font-normal text-slate-500">{d.class_name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div>{d.parent_name || 'N/A'}</div>
                          <div className="text-[10px] font-mono text-slate-400">{d.whatsapp_number}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-700">{d.quarter_name}</span>
                          {d.cutoff_date && (
                            <span className="block text-[9px] text-slate-400 font-normal">Cutoff: {d.cutoff_date}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{Number(d.base_due).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                          {Number(d.late_penalty) > 0 ? (
                            <div>
                              <span>+₹{Number(d.late_penalty).toLocaleString('en-IN')}</span>
                              <span className="block text-[9px] font-normal text-amber-800 line-clamp-1" title={d.penalty_reason}>
                                {d.penalty_reason}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-normal">₹0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800 text-xs">
                          ₹{Number(d.total_payable).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.is_overdue ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {d.is_overdue ? '⚠️ OVERDUE' : '⏳ DUE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleQuickCollect(d)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                              title="Collect live cash with parent WhatsApp OTP"
                            >
                              Collect Cash
                            </button>
                            <button
                              onClick={() => handleOpenOfflineModal(d)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
                              title="Student already paid offline in past (Record without OTP)"
                            >
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Mark Paid</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {defaultersData.total_students > 0 && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span>
                      Showing <strong className="text-slate-800">{(defaulterPage - 1) * defaulterPageSize + 1}</strong> to{' '}
                      <strong className="text-slate-800">
                        {Math.min(defaulterPage * defaulterPageSize, defaultersData.total_students)}
                      </strong>{' '}
                      of <strong className="text-slate-800">{defaultersData.total_students}</strong> students
                    </span>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5">
                      <span>Per page:</span>
                      <select
                        value={defaulterPageSize}
                        onChange={(e) => {
                          const newSize = Number(e.target.value);
                          setDefaulterPageSize(newSize);
                          setDefaulterPage(1);
                          loadDefaulters(1, newSize);
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 outline-hidden cursor-pointer"
                      >
                        <option value="15">15</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (defaulterPage > 1) {
                          const prev = defaulterPage - 1;
                          setDefaulterPage(prev);
                          loadDefaulters(prev, defaulterPageSize);
                        }
                      }}
                      disabled={defaulterPage <= 1 || loadingDefaulters}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                      Page {defaulterPage} of {defaulterTotalPages}
                    </span>

                    <button
                      onClick={() => {
                        if (defaulterPage < defaulterTotalPages) {
                          const next = defaulterPage + 1;
                          setDefaulterPage(next);
                          loadDefaulters(next, defaulterPageSize);
                        }
                      }}
                      disabled={defaulterPage >= defaulterTotalPages || loadingDefaulters}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer"
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
      )}

      {/* ─── Tab 3: Student Fee Passbook (Ledger View) ───────────────────────── */}
      {activeTab === 'passbook' && (
        <div className="space-y-5">
          {/* Top Search & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Student Fee Passbook &amp; Transaction Ledger</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological bank-style record of all fee charges, cash payments, dates, receipt numbers, and running balance.
                </p>
              </div>

              {passbookData && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs self-start sm:self-auto cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Passbook</span>
                </button>
              )}
            </div>

            {/* Student Search & Select */}
            <form onSubmit={handleSearchPassbookStudents} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student by name or mobile..."
                  value={passbookSearch}
                  onChange={(e) => setPassbookSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 outline-hidden"
                />
              </div>

              <div className="w-full sm:w-56">
                <select
                  value={passbookClassId}
                  onChange={(e) => setPassbookClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={searchingPassbookStudents}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
              >
                {searchingPassbookStudents ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Find Student</span>
              </button>
            </form>

            {/* Matching Search Results Selector (Only shown if multiple students match search query) */}
            {passbookStudents.length > 1 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Multiple matches found ({passbookStudents.length}). Select student to open passbook:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {passbookStudents.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleLoadPassbook(st)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border bg-white hover:bg-slate-50 text-slate-700 border-slate-200 transition-all cursor-pointer shadow-2xs"
                    >
                      <User className="w-3 h-3" />
                      <span>{st.student_name}</span>
                      <span className="text-[10px] opacity-75">({st.class_name || 'Class'})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Passbook Content */}
          {loadingPassbook ? (
            <div className="p-16 bg-white rounded-2xl border border-slate-200/90 text-center flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">Generating chronological bank passbook ledger...</p>
            </div>
          ) : !passbookStudent ? (
            <div className="p-16 bg-white rounded-2xl border border-slate-200/90 text-center flex flex-col items-center justify-center">
              <BookOpen className="w-12 h-12 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No Student Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Search and select a student above to inspect on which day they paid, how much amount was collected, and their running ledger balance.
              </p>
            </div>
          ) : passbookData ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-5">
              {/* Passbook Header Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                      Official Passbook
                    </span>
                    <h2 className="text-base font-black text-slate-900">{passbookData.student.student_name}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-emerald-800 border border-emerald-200">
                      Class: {passbookData.student.class_name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Parent: <strong className="text-slate-800">{passbookData.student.parent_name}</strong> &bull; WhatsApp: <strong className="text-slate-800">{passbookData.student.whatsapp_number}</strong>
                  </p>
                </div>

                {/* Net Due Balance Highlight */}
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Till Now Due Balance
                  </span>
                  <span className="text-xl font-black text-slate-900 flex items-center sm:justify-end">
                    <IndianRupee className="w-5 h-5 text-emerald-600" />
                    <span>{Number(passbookData.summary.net_outstanding_due).toLocaleString('en-IN')}</span>
                  </span>
                  {passbookData.summary.annual_outstanding_due && (
                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                      Full Year Dues: ₹{Number(passbookData.summary.annual_outstanding_due).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>

              {/* 4 Summary Metrics Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Fees Billed</span>
                    {passbookData.summary.annual_total_billed && (
                      <span className="text-[9px] text-slate-400 font-semibold" title="Annual Total Billed">
                        Year: ₹{Number(passbookData.summary.annual_total_billed).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <span className="text-base font-black text-slate-900 flex items-center mt-0.5">
                    <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                    <span>{Number(passbookData.summary.total_billed).toLocaleString('en-IN')}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Commenced to date</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Total Cash Paid</span>
                  <span className="text-base font-black text-emerald-900 flex items-center mt-0.5">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{Number(passbookData.summary.total_paid).toLocaleString('en-IN')}</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">Verified receipts</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Late Penalties</span>
                  <span className="text-base font-black text-amber-900 flex items-center mt-0.5">
                    <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                    <span>{Number(passbookData.summary.total_penalty).toLocaleString('en-IN')}</span>
                  </span>
                  <span className="text-[10px] text-amber-700 block mt-0.5 font-medium">Charged penalties</span>
                </div>

                <div className="p-3 rounded-xl bg-red-50/70 border border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-red-800 uppercase block">Till Now Due</span>
                    {passbookData.summary.annual_outstanding_due && (
                      <span className="text-[9px] text-red-500 font-semibold" title="Full Year Total Due">
                        Year: ₹{Number(passbookData.summary.annual_outstanding_due).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <span className="text-base font-black text-red-900 flex items-center mt-0.5">
                    <IndianRupee className="w-3.5 h-3.5 text-red-600" />
                    <span>{Number(passbookData.summary.net_outstanding_due).toLocaleString('en-IN')}</span>
                  </span>
                  <span className="text-[10px] text-red-700 block mt-0.5 font-medium">Active ledger balance</span>
                </div>
              </div>

              {/* Passbook Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-800 text-white flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Official Passbook Statement &bull; Academic Year {passbookData.summary.academic_year}</span>
                  </span>
                  <span className="text-[10px] font-normal text-slate-300">
                    {passbookData.passbook_entries.length} Transaction{passbookData.passbook_entries.length !== 1 ? 's' : ''} Recorded
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date &amp; Time (IST)</th>
                        <th className="py-2.5 px-3">Particulars / Narration</th>
                        <th className="py-2.5 px-3">Ref / Receipt No.</th>
                        <th className="py-2.5 px-3 text-center">Type</th>
                        <th className="py-2.5 px-3 text-right">Debit (Fee ₹)</th>
                        <th className="py-2.5 px-3 text-right">Credit (Paid ₹)</th>
                        <th className="py-2.5 px-3 text-right">Balance Due (₹)</th>
                        <th className="py-2.5 px-3">Mode &amp; Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {passbookData.passbook_entries.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No transactions recorded yet for this student.
                          </td>
                        </tr>
                      ) : (
                        passbookData.passbook_entries.map((entry, idx) => (
                          <tr
                            key={idx}
                            className={
                              entry.type === 'PAYMENT'
                                ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                                : entry.type === 'PENALTY'
                                ? 'bg-amber-50/30 hover:bg-amber-50/60'
                                : 'hover:bg-slate-50'
                            }
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                              {entry.date}
                              <span className="block text-[10px] text-slate-400 font-normal">{entry.time}</span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {entry.particulars}
                              <span className="block text-[10px] text-slate-400 font-normal">
                                Quarter: {entry.quarter} &bull; Status: {entry.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                              {entry.reference_no}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  entry.type === 'PAYMENT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : entry.type === 'PENALTY'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {entry.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {Number(entry.debit) > 0 ? `₹${Number(entry.debit).toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                              {Number(entry.credit) > 0 ? `+₹${Number(entry.credit).toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                              ₹{Number(entry.running_balance).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              <span className="font-semibold text-slate-800 block">{entry.payment_mode}</span>
                              <span className="text-[10px] text-slate-400 block">{entry.handled_by}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ─── Modal 1: OTP Entry Popup ───────────────────────────────────────── */}
      {showOtpModal && otpSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Verify Parent WhatsApp OTP</h3>
                  <p className="text-[10px] text-slate-500">Security check against counter fraud</p>
                </div>
              </div>
              <button
                onClick={() => setShowOtpModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyOtpAndCollect} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[11px] text-slate-500 block">Cash Amount to Collect:</span>
                <span className="text-xl font-black text-slate-900">₹{Number(otpSession.amount).toLocaleString('en-IN')}</span>
                <p className="text-[11px] text-slate-600 mt-1">
                  Sent to parent: <strong>{otpSession.parent_phone_masked}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 text-center mb-2">
                  Enter 6-Digit OTP Spoken by Parent:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={inputOtp}
                  onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  required
                  className="w-full text-center text-2xl font-mono font-black tracking-widest py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:border-emerald-600 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Expires in: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </span>

                <button
                  type="button"
                  onClick={handleInitiateCashPayment}
                  className="text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Resend OTP</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={verifyingOtp || inputOtp.length !== 6}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {verifyingOtp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Verify OTP &amp; Commit to Ledger</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Official Printable Receipt on Success ─────────────────── */}
      {verifiedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold">Payment Verified &amp; Recorded</h3>
              </div>
              <button
                onClick={() => setVerifiedReceipt(null)}
                className="p-1.5 rounded-lg hover:bg-emerald-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
                <IndianRupee className="w-6 h-6" />
              </div>

              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Official Receipt Number</span>
                <h2 className="text-lg font-black text-slate-900 font-mono mt-0.5">{verifiedReceipt.receipt_number}</h2>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">{verifiedReceipt.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash Received:</span>
                  <span className="font-bold text-emerald-700">₹{Number(verifiedReceipt.amount_paid).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">New Due Balance:</span>
                  <span className="font-bold text-slate-900">
                    ₹{Number(verifiedReceipt.total_due_with_late_fees || verifiedReceipt.new_due_balance).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="text-slate-700">{verifiedReceipt.date}</span>
                </div>
              </div>

              <p className="text-[11px] text-emerald-700 font-medium">
                Receipt confirmation has been pushed to the parent's WhatsApp!
              </p>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const st = selectedStudent;
                    setVerifiedReceipt(null);
                    setActiveTab('passbook');
                    handleLoadPassbook(st);
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Passbook</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVerifiedReceipt(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 3: Record Past Offline Payment (No OTP) ────────────────────── */}
      {offlineModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold">Record Past Offline Payment</h3>
                  <p className="text-[10px] text-slate-300">Direct ledger entry for students who already paid (No OTP)</p>
                </div>
              </div>
              <button
                onClick={() => setOfflineModalStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitOfflinePayment} className="p-5 space-y-4">
              {/* Student Header */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">{offlineModalStudent.student_name}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {offlineModalStudent.class_name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Parent: <strong className="text-slate-700">{offlineModalStudent.parent_name || 'N/A'}</strong> &bull; Phone: <strong className="text-slate-700">{offlineModalStudent.whatsapp_number}</strong>
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Quarter: <strong className="text-slate-800">{offlineModalStudent.quarter_name || offlineModalStudent.quarter || 'Q3'}</strong> &bull; Total Ledger Due: <strong className="text-slate-900">₹{Number(offlineModalStudent.total_payable || offlineModalStudent.base_due).toLocaleString('en-IN')}</strong>
                </p>
              </div>

              {/* Amount & Penalty Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Settlement Amount (₹):
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={offlineAmount}
                      onChange={(e) => setOfflineAmount(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-600 outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {offlineWaivePenalty ? 'Base tuition fee only (No penalty)' : `Base fee + ₹${offlineModalStudent.late_penalty || 0} late penalty`}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Late Fee Penalty:
                  </label>
                  <label className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none ${
                    offlineWaivePenalty
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                      : 'bg-amber-50/60 border-amber-300 text-amber-950'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={offlineWaivePenalty}
                        onChange={(e) => handleToggleOfflineWaive(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 accent-emerald-600"
                      />
                      <div>
                        <span className="text-xs font-bold block leading-tight">Waive Late Fee</span>
                        <span className="text-[10px] opacity-75 block leading-tight mt-0.5">
                          {offlineWaivePenalty ? 'Penalty removed (₹0.00)' : `Penalty added (+₹${offlineModalStudent.late_penalty || 0})`}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      offlineWaivePenalty ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                    }`}>
                      {offlineWaivePenalty ? '₹0.00 Waived' : `+₹${offlineModalStudent.late_penalty || 0}`}
                    </span>
                  </label>
                </div>
              </div>

              {/* Date & Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Actual Payment Date:
                  </label>
                  <input
                    type="date"
                    required
                    value={offlineDate}
                    onChange={(e) => handleOfflineDateChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Recorded in ledger on this date
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Mode:
                  </label>
                  <select
                    value={offlinePaymentMode}
                    onChange={(e) => setOfflinePaymentMode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-hidden cursor-pointer"
                  >
                    <option value="CASH">Cash at Counter (1010)</option>
                    <option value="BANK">Bank Transfer / UPI (1020)</option>
                  </select>
                </div>
              </div>

              {/* Receipt / Voucher Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Offline Paper Receipt / Voucher # (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. REC-1025 or Diary Page 42"
                  value={offlineReceiptNo}
                  onChange={(e) => setOfflineReceiptNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-600 outline-hidden"
                />
              </div>

              {/* Notice */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  This directly records the collection into the Double-Entry General Ledger and clears the student dues. <strong>No OTP is sent to the parent</strong>.
                </p>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOfflineModalStudent(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingOffline || !offlineAmount || Number(offlineAmount) <= 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {recordingOffline ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm &amp; Clear Due (No OTP)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
