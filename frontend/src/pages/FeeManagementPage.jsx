import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  IndianRupee,
  GraduationCap,
  Users,
  CheckCircle,
  AlertCircle,
  Send,
  Loader2,
  X,
  Eye,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  User,
  RotateCcw,
  FileText,
  UserPlus,
  Upload,
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
} from 'lucide-react';
import { api } from '../services/api';
import { sortClassesAscending } from '../utils/classSort';
import { ACADEMIC_YEARS } from '../utils/academicYears';

export function FeeManagementPage({ showToast }) {
  // Active Tab: 'slabs' | 'students'
  const [activeTab, setActiveTab] = useState('slabs');

  // Slabs State
  const [slabs, setSlabs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState('2026-2027');

  // Slab Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [editingSlabId, setEditingSlabId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedViewSlab, setSelectedViewSlab] = useState(null);

  // Slab Form State
  const [formName, setFormName] = useState('');
  const [formQuarterlyFee, setFormQuarterlyFee] = useState('');
  const [formClassIds, setFormClassIds] = useState([]);
  const [formDesc, setFormDesc] = useState('');

  // Quarterly Billing Trigger State
  const [postingQuarter, setPostingQuarter] = useState(false);
  const [selectedQuarterToBill, setSelectedQuarterToBill] = useState('ALL');
  const [autoPostBilling, setAutoPostBilling] = useState(true);

  // Fee Students State (Accounts Roster)
  const [feeStudents, setFeeStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassId, setStudentClassId] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const studentPageSize = 25;

  // Add Fee Student Modal State
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newWhatsappNumber, setNewWhatsappNumber] = useState('');
  const [newAdmissionNumber, setNewAdmissionNumber] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);

  // Passbook Modal for Student in Roster
  const [selectedStudentPassbook, setSelectedStudentPassbook] = useState(null);
  const [studentPassbookData, setStudentPassbookData] = useState(null);
  const [loadingStudentPassbook, setLoadingStudentPassbook] = useState(false);

  // Multi-select & Delete State
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [deletingStudents, setDeletingStudents] = useState(false);

  // Import Fee Students Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const loadFeeStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await api.getFeeStudents({ academic_year: academicYear });
      const list = Array.isArray(res) ? res : (res?.students || res?.results || []);
      setFeeStudents(list);
    } catch (err) {
      console.error('Failed to load fee students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadData();
    loadFeeStudents();
  }, [academicYear]);

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

  const handleOpenAddStudentModal = () => {
    setNewStudentName('');
    setNewParentName('');
    setNewWhatsappNumber('');
    setNewAdmissionNumber('');
    setNewClassId(classes.length > 0 ? String(classes[0].id) : '');
    setShowAddStudentModal(true);
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newWhatsappNumber.trim()) {
      showToast?.({
        type: 'error',
        title: 'Validation Error',
        message: 'Student name and WhatsApp number are required.',
      });
      return;
    }

    setSavingStudent(true);
    try {
      const cleanDigits = newWhatsappNumber.replace(/\D/g, '');
      const formattedPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

      await api.createFeeStudent({
        student_name: newStudentName.trim(),
        parent_name: newParentName.trim(),
        whatsapp_number: formattedPhone,
        admission_number: newAdmissionNumber.trim(),
        class_id: newClassId ? Number(newClassId) : null,
      });

      showToast?.({
        type: 'success',
        title: 'Student Added',
        message: `${newStudentName.trim()} has been enrolled into the Fee Accounts roster!`,
      });

      setShowAddStudentModal(false);
      setNewStudentName('');
      setNewParentName('');
      setNewWhatsappNumber('');
      setNewAdmissionNumber('');
      setNewClassId('');
      loadFeeStudents();
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Failed to Add Student',
        message: err.message || 'Could not register fee student.',
      });
    } finally {
      setSavingStudent(false);
    }
  };

  const filteredFeeStudents = feeStudents.filter((st) => {
    if (studentClassId && String(st.class_id) !== String(studentClassId)) {
      return false;
    }
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      st.student_name?.toLowerCase().includes(q) ||
      st.parent_name?.toLowerCase().includes(q) ||
      st.whatsapp_number?.includes(q) ||
      st.class_name?.toLowerCase().includes(q) ||
      String(st.id).includes(q)
    );
  });

  const studentTotalPages = Math.max(1, Math.ceil(filteredFeeStudents.length / studentPageSize));
  const paginatedStudents = filteredFeeStudents.slice(
    (studentPage - 1) * studentPageSize,
    studentPage * studentPageSize
  );

  const currentPageStudentIds = paginatedStudents.map((s) => s.id);
  const allCurrentPageSelected =
    currentPageStudentIds.length > 0 &&
    currentPageStudentIds.every((id) => selectedStudentIds.includes(id));

  const handleToggleSelectAll = () => {
    if (allCurrentPageSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !currentPageStudentIds.includes(id)));
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...currentPageStudentIds])));
    }
  };

  const handleToggleSelectStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSingleStudent = async (student) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${student.student_name} from Fee Management and remove their sub-ledger account in Chart of Accounts?\n\nNote: WhatsApp broadcast contacts remain completely untouched.`
      )
    ) {
      return;
    }

    try {
      await api.deleteFeeStudent(student.id);
      showToast?.({
        type: 'success',
        title: 'Student Deleted',
        message: `${student.student_name} removed from fee roster and ledger.`
      });
      setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
      await loadFeeStudents();
      await loadData();
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete fee student.'
      });
    }
  };

  const handleBulkDeleteStudents = async () => {
    if (selectedStudentIds.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedStudentIds.length} selected student(s) from Fee Management and remove their sub-ledger accounts in Chart of Accounts?\n\nNote: WhatsApp broadcast contacts remain completely untouched.`
      )
    ) {
      return;
    }

    setDeletingStudents(true);
    try {
      const res = await api.bulkDeleteFeeStudents(selectedStudentIds);
      showToast?.({
        type: 'success',
        title: 'Bulk Delete Complete',
        message: res.message || `Deleted ${selectedStudentIds.length} fee student(s).`
      });
      setSelectedStudentIds([]);
      await loadFeeStudents();
      await loadData();
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Bulk Delete Failed',
        message: err.message || 'Failed to delete selected students.'
      });
    } finally {
      setDeletingStudents(false);
    }
  };

  const handleDownloadSampleTemplate = () => {
    const csvContent =
      'student_name,parent_name,class,section,phone\n' +
      'AARNA GARG,MR. YASH GARG,1,A,9102742082830\n' +
      'AARAV SHARMA,MR. ROHIT SHARMA,1,B,919876543210\n' +
      'ANANYA VERMA,MRS. PRIYA VERMA,2,A,919812345678\n' +
      'VIHAAN MEHTA,MR. RAJESH MEHTA,2,B,919823456789\n' +
      'ISHAN GUPTA,MR. AMIT GUPTA,3,A,919834567890\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_fee_students.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setShowImportModal(true);
  };

  const handleImportStudents = async (e) => {
    e.preventDefault();
    if (!importFile) {
      showToast?.({
        type: 'error',
        title: 'File Required',
        message: 'Please choose an Excel (.xlsx, .xls) or CSV file to import.'
      });
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.importFeeStudents(formData);
      setImportResult(res);
      showToast?.({
        type: 'success',
        title: 'Import Successful',
        message: res.message || 'Successfully processed student roster.'
      });
      await loadFeeStudents();
      await loadData();
      if (api.clearFeeClassesCache) api.clearFeeClassesCache();
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Import Failed',
        message: err.message || 'Could not import student file.'
      });
    } finally {
      setImporting(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [slabsData, clsData] = await Promise.all([
        api.getFeeSlabs({ academic_year: academicYear }),
        api.getFeeClasses ? api.getFeeClasses() : api.getClasses(),
      ]);
      const rawSlabs = Array.isArray(slabsData) ? slabsData : [];
      setSlabs(rawSlabs.map(s => ({ ...s, classes: sortClassesAscending(s.classes || []) })));
      setClasses(sortClassesAscending(clsData || []));
    } catch (err) {
      console.error(err);
      showToast?.({ type: 'error', title: 'Error', message: 'Failed to load fee slabs.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    setEditingSlabId(null);
    setFormName('');
    setFormQuarterlyFee('');
    setFormClassIds([]);
    setFormDesc('');
    setAutoPostBilling(true);
    setShowModal(true);
  };

  const handleOpenEditModal = (slab) => {
    setModalMode('EDIT');
    setEditingSlabId(slab.id);
    setFormName(slab.name);
    setFormQuarterlyFee(slab.quarterly_fee);
    setFormClassIds((slab.classes || []).map((c) => c.id));
    setFormDesc(slab.description || '');
    setShowModal(true);
  };

  const handleSaveSlab = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formQuarterlyFee) {
      showToast?.({ type: 'error', title: 'Required', message: 'Please provide slab name and fee.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        quarterly_fee: formQuarterlyFee,
        class_ids: formClassIds,
        description: formDesc.trim(),
        academic_year: academicYear,
      };

      if (modalMode === 'CREATE') {
        const created = await api.createFeeSlab(payload);
        if (autoPostBilling && created?.id) {
          try {
            await api.postQuarterlyFees({
              quarter: 'ALL',
              academic_year: academicYear,
              slab_id: created.id,
            });
            showToast?.({
              type: 'success',
              title: 'Slab Created & Fees Posted',
              message: 'Fee slab created and automatically posted to all quarters for assigned classes.',
            });
          } catch (pErr) {
            showToast?.({ type: 'success', title: 'Slab Created', message: 'Fee slab created successfully.' });
          }
        } else {
          showToast?.({ type: 'success', title: 'Slab Created', message: 'Fee slab created successfully.' });
        }
      } else {
        await api.updateFeeSlab(editingSlabId, payload);
        showToast?.({ type: 'success', title: 'Slab Updated', message: 'Fee slab configuration updated.' });
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      showToast?.({ type: 'error', title: 'Error', message: err.message || 'Failed to save fee slab.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlab = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete fee slab "${name}"?`)) {
      return;
    }
    try {
      await api.deleteFeeSlab(id);
      showToast?.({ type: 'success', title: 'Slab Deleted', message: `Fee slab "${name}" removed.` });
      loadData();
    } catch (err) {
      showToast?.({ type: 'error', title: 'Delete Failed', message: err.message || 'Could not delete slab.' });
    }
  };

  const handlePostQuarterlyFees = async () => {
    const qLabel = selectedQuarterToBill === 'ALL' ? 'All Active Quarters (Q3 & Q4)' : selectedQuarterToBill;
    if (!window.confirm(`Post double-entry tuition fee billing for ${qLabel} (${academicYear})?`)) {
      return;
    }
    setPostingQuarter(true);
    try {
      const res = await api.postQuarterlyFees({
        quarter: selectedQuarterToBill,
        academic_year: academicYear,
      });
      showToast?.({
        type: 'success',
        title: 'Fees Posted Successfully',
        message: res.message || `Posted ${res.total_entries_billed || 0} journal entries across ${res.total_students_impacted || 0} students.`,
      });
      loadData();
    } catch (err) {
      showToast?.({ type: 'error', title: 'Posting Failed', message: err.message || 'Could not post quarterly fees.' });
    } finally {
      setPostingQuarter(false);
    }
  };

  const toggleClassSelect = (classId) => {
    setFormClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
              FEE SLABS CONFIGURATION
            </span>
            <span className="text-xs font-semibold text-slate-500">Academic Year: {academicYear}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Fee Slabs &amp; Tuition Schedulers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure class tuition fee slabs, set annual fee amounts, and post quarterly fees to student ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'slabs' ? (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Fee Slab</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenImportModal}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import Students</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddStudentModal}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Fee Student</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-hidden cursor-pointer"
            >
              {ACADEMIC_YEARS.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODULE NAVIGATION SUB-TABS: SLABS & STUDENTS ROSTER                   */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('slabs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'slabs'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Fee Slabs Structure</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'slabs' ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {slabs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'students'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Fee Students (Accounts Roster)</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'students' ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {feeStudents.length}
          </span>
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: FEE SLABS STRUCTURE & BILLING ENGINE                           */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'slabs' && (
      <div className="space-y-6">
        {/* Post Quarterly Fees Banner */}
        <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-slate-50 border border-teal-200/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
              <Send className="w-4 h-4 text-teal-600" />
              <span>Quarterly Fee Billing Engine</span>
            </span>
            <p className="text-[11px] text-teal-800">
              Post tuition fees to student ledgers. Duplicates for the same quarter are automatically updated with double-entry integrity.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <select
              value={selectedQuarterToBill}
              onChange={(e) => setSelectedQuarterToBill(e.target.value)}
              className="px-3 py-2 bg-white border border-teal-300 rounded-xl text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Active Quarters (Oct - Mar: Q3 &amp; Q4) • Recommended</option>
              <option value="Q3">Q3 (Oct - Dec) • Portal Launch Quarter (Cutoff 10-Nov)</option>
              <option value="Q4">Q4 (Jan - Mar) • Cutoff 10-Feb</option>
              <option value="ALL_YEAR">All 4 Quarters (Full Year: Q1 to Q4)</option>
              <option value="Q1">Q1 (Apr - Jun) • Pre-Portal Legacy</option>
              <option value="Q2">Q2 (Jul - Sep) • Pre-Portal Legacy</option>
            </select>

            <button
              onClick={handlePostQuarterlyFees}
              disabled={postingQuarter}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              {postingQuarter ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Post {selectedQuarterToBill === 'ALL' ? 'All Active' : selectedQuarterToBill} Fees</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Slabs Table View */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200/90">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-xs font-semibold">Loading class fee slabs...</p>
          </div>
        ) : slabs.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-200 rounded-2xl bg-white space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Fee Slabs Configured</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create class slabs to define quarterly fees for brackets (e.g. Play to 5th, 6th to 8th).
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Fee Slab</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Fee Slabs Directory</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Class bracket slabs defining quarterly fees and automated ledger postings
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Total <span className="font-bold text-slate-800">{slabs.length}</span> slabs configured
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold text-[11px] tracking-wide uppercase">
                    <th className="py-3 px-4">Slab Name &amp; Description</th>
                    <th className="py-3 px-4">Assigned Classes</th>
                    <th className="py-3 px-4 text-right">Quarterly Fee</th>
                    <th className="py-3 px-4 text-right">Annual Total</th>
                    <th className="py-3 px-4 text-center">Enrolled Students</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center w-52">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slabs.map((slab) => (
                    <tr
                      key={slab.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedViewSlab(slab)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{slab.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            {slab.academic_year}
                          </span>
                        </div>
                        {slab.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{slab.description}</p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {slab.classes && slab.classes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {slab.classes.slice(0, 4).map((cls) => (
                              <span
                                key={cls.id}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {cls.name}{cls.section ? ` (${cls.section})` : ''}
                              </span>
                            ))}
                            {slab.classes.length > 4 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200/80 text-slate-600">
                                +{slab.classes.length - 4} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No classes assigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-xs">
                        ₹{Number(slab.quarterly_fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-teal-700 text-xs">
                        ₹{(Number(slab.quarterly_fee) * 4).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {slab.student_count || 0} students
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedViewSlab(slab);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer"
                            title="View Slab Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(slab);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                            title="Edit Fee Slab"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSlab(slab.id, slab.name);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Slab"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: FEE STUDENTS (ACCOUNTS ROSTER)                                 */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student name, parent, mobile, sub-ledger ID..."
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setStudentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-hidden focus:border-teal-500"
                />
                {studentSearch && (
                  <button
                    onClick={() => {
                      setStudentSearch('');
                      setStudentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="w-full sm:w-56">
                <select
                  value={studentClassId}
                  onChange={(e) => {
                    setStudentClassId(e.target.value);
                    setStudentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden focus:border-teal-500 cursor-pointer"
                >
                  <option value="">All Classes ({feeStudents.length})</option>
                  {sortClassesAscending(classes).map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.section ? `(${cls.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {(studentSearch || studentClassId) && (
                <button
                  onClick={() => {
                    setStudentSearch('');
                    setStudentClassId('');
                    setStudentPage(1);
                  }}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              {selectedStudentIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDeleteStudents}
                  disabled={deletingStudents}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 animate-in fade-in duration-150"
                >
                  {deletingStudents ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Delete Selected ({selectedStudentIds.length})</span>
                </button>
              )}

              <span className="text-xs text-slate-500 font-semibold mr-1">
                Found <span className="font-bold text-slate-900">{filteredFeeStudents.length}</span> students
              </span>

              <button
                type="button"
                onClick={handleOpenImportModal}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Students</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddStudentModal}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Student</span>
              </button>
            </div>
          </div>

          {/* Students Roster Table */}
          {loadingStudents ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200/90">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              <p className="text-xs font-semibold">Loading student accounts roster...</p>
            </div>
          ) : filteredFeeStudents.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-200 rounded-2xl bg-white space-y-3">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Fee Students Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {studentSearch || studentClassId
                  ? 'No students matched the active search or class filter.'
                  : 'No fee students exist in the ledger roster. Click "Import Students" to upload an Excel/CSV file or "Add Fee Student" to create manually.'}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenImportModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Students (Excel/CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddStudentModal}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add First Fee Student</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-semibold text-[11px] tracking-wide uppercase">
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          onChange={handleToggleSelectAll}
                          className="rounded border-slate-400 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          title="Select / Deselect all on this page"
                        />
                      </th>
                      <th className="py-3 px-4">Sub-Ledger Code</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Class &amp; Section</th>
                      <th className="py-3 px-4">Parent Name</th>
                      <th className="py-3 px-4">WhatsApp Contact</th>
                      <th className="py-3 px-4 text-right">Ledger Outstanding</th>
                      <th className="py-3 px-4 text-center w-48">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedStudents.map((st) => (
                      <tr
                        key={st.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          selectedStudentIds.includes(st.id) ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(st.id)}
                            onChange={() => handleToggleSelectStudent(st.id)}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-teal-800 text-[11px]">
                          1100-{st.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px]">
                              {st.student_name ? st.student_name[0]?.toUpperCase() : 'S'}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 text-xs block">{st.student_name}</span>
                              {st.admission_number && (
                                <span className="text-[10px] text-slate-400 font-mono">Adm: {st.admission_number}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {st.class_name || 'General Class'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {st.parent_name || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {st.whatsapp_number ? `+${st.whatsapp_number}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-xs">
                          {Number(st.fees_due || 0) > 0 ? (
                            <span className="text-rose-600">
                              ₹{Number(st.fees_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-emerald-600">₹0.00</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewStudentPassbook(st)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer"
                              title="View Student Fee Passbook"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Passbook</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleStudent(st)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                              title="Delete Fee Student"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
                <div className="text-xs text-slate-500 font-medium">
                  Showing{' '}
                  <span className="font-bold text-slate-800">
                    {filteredFeeStudents.length === 0 ? 0 : (studentPage - 1) * studentPageSize + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-bold text-slate-800">
                    {Math.min(studentPage * studentPageSize, filteredFeeStudents.length)}
                  </span>{' '}
                  of <span className="font-bold text-slate-800">{filteredFeeStudents.length}</span> students
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                    disabled={studentPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-bold text-slate-700 px-2">
                    Page {studentPage} of {studentTotalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setStudentPage((p) => Math.min(studentTotalPages, p + 1))}
                    disabled={studentPage >= studentTotalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: View Fee Slab Details ──────────────────────────────────── */}
      {selectedViewSlab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-teal-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-400/30">
                      {selectedViewSlab.academic_year}
                    </span>
                    <h3 className="font-bold text-base text-white">{selectedViewSlab.name}</h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Quarterly Fee Slab Configuration &amp; Class Allocations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedViewSlab(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Fee Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Quarterly Fee
                  </span>
                  <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
                    ₹{Number(selectedViewSlab.quarterly_fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500">Per student / quarter</span>
                </div>

                <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200">
                  <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider block">
                    Annual Total
                  </span>
                  <span className="text-lg font-black font-mono text-teal-900 mt-1 block">
                    ₹{(Number(selectedViewSlab.quarterly_fee) * 4).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-teal-700">4 Quarters total</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Enrolled Students
                  </span>
                  <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
                    {selectedViewSlab.student_count || 0}
                  </span>
                  <span className="text-[10px] text-slate-500">Across assigned classes</span>
                </div>
              </div>

              {/* Description */}
              {selectedViewSlab.description && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Description / Notes</h4>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                    {selectedViewSlab.description}
                  </p>
                </div>
              )}

              {/* Assigned Classes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-teal-600" />
                    <span>Assigned Classes ({selectedViewSlab.classes?.length || 0})</span>
                  </h4>
                  <span className="text-xs text-slate-500">
                    Auto-billed at ₹{Number(selectedViewSlab.quarterly_fee).toLocaleString('en-IN')}/qtr
                  </span>
                </div>

                {selectedViewSlab.classes && selectedViewSlab.classes.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedViewSlab.classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800 text-xs">
                          {cls.name} {cls.section ? `(${cls.section})` : ''}
                        </span>
                        <span className="text-[10px] font-semibold text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded">
                          Class #{cls.id}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-dashed text-center">
                    No classes currently linked to this slab.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedViewSlab(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const s = selectedViewSlab;
                  setSelectedViewSlab(null);
                  handleOpenEditModal(s);
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit This Slab</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Create / Edit Fee Slab ──────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-teal-600 text-white">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                <span>{modalMode === 'CREATE' ? 'Create New Fee Slab' : 'Edit Fee Slab'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-teal-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlab} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fee Slab Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Primary Slab (Playway to 5th)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quarterly Tuition Fee (₹ per Quarter) *
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 7000"
                    value={formQuarterlyFee}
                    onChange={(e) => setFormQuarterlyFee(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-hidden"
                  />
                </div>
                {formQuarterlyFee && (
                  <p className="text-[11px] text-teal-700 mt-1 font-semibold">
                    Yearly Total: ₹{(Number(formQuarterlyFee) * 4).toLocaleString('en-IN')} (across 4 quarters)
                  </p>
                )}
              </div>

              {/* Class Selector Checklist */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign Classes to this Slab ({formClassIds.length} Selected)
                </label>
                <div className="max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-1.5">
                  {classes.map((c) => {
                    const isSelected = formClassIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleClassSelect(c.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{c.name} {c.section ? `(${c.section})` : ''}</span>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-teal-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional details or reason for rate change..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-hidden"
                />
              </div>

              {modalMode === 'CREATE' && (
                <label className="flex items-center gap-2 p-2.5 bg-teal-50/70 border border-teal-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPostBilling}
                    onChange={(e) => setAutoPostBilling(e.target.checked)}
                    className="accent-teal-600 rounded"
                  />
                  <span className="text-xs font-bold text-teal-900">
                    Automatically post fees to all quarters for assigned classes immediately
                  </span>
                </label>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{modalMode === 'CREATE' ? 'Create Fee Slab' : 'Update Fee Slab'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Student Fee Passbook ──────────────────────────────────── */}
      {selectedStudentPassbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-400/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">{selectedStudentPassbook.student_name}</h3>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-400/30">
                      Sub-Ledger: 1100-{selectedStudentPassbook.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Class: {selectedStudentPassbook.class_name || 'General Class'} • Parent: {selectedStudentPassbook.parent_name || 'N/A'} • WhatsApp: +{selectedStudentPassbook.whatsapp_number}
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

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {loadingStudentPassbook ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                  <p className="text-xs font-semibold">Loading student passbook entries...</p>
                </div>
              ) : !studentPassbookData ? (
                <div className="p-8 text-center text-slate-400 text-xs">Failed to load passbook details.</div>
              ) : (
                <>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Total Billed (Fees Recognized)
                      </span>
                      <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
                        ₹{Number(studentPassbookData.summary?.total_billed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-500">Debited to student account</span>
                    </div>

                    <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                        Total Paid (Cash / Counter)
                      </span>
                      <span className="text-lg font-black font-mono text-emerald-900 mt-1 block">
                        ₹{Number(studentPassbookData.summary?.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-emerald-700">Credited to student account</span>
                    </div>

                    <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200">
                      <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                        Net Outstanding Due
                      </span>
                      <span className="text-lg font-black font-mono text-rose-900 mt-1 block">
                        ₹{Number(studentPassbookData.summary?.net_outstanding_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-rose-700">Current active ledger balance</span>
                    </div>
                  </div>

                  {/* Passbook Transactions Table */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-800 text-white flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-400" />
                        <span>Official Ledger Passbook Entries</span>
                      </span>
                      <span className="text-[10px] font-normal text-slate-300">
                        {studentPassbookData.passbook_entries?.length || 0} Transaction{(studentPassbookData.passbook_entries?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold text-[10px] uppercase border-b border-slate-200">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Quarter</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Voucher #</th>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                            <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                            <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {(!studentPassbookData.passbook_entries || studentPassbookData.passbook_entries.length === 0) ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-400">
                                No fee transactions recorded yet for this student.
                              </td>
                            </tr>
                          ) : (
                            studentPassbookData.passbook_entries.map((entry, idx) => (
                              <tr
                                key={idx}
                                className={
                                  entry.type === 'PAYMENT' || Number(entry.credit) > 0
                                    ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                                    : entry.type === 'PENALTY' || entry.type === 'LATE_FEE'
                                    ? 'bg-rose-50/30 hover:bg-rose-50/60'
                                    : 'hover:bg-slate-50'
                                }
                              >
                                <td className="py-2 px-3 font-mono text-[10px] text-slate-600 whitespace-nowrap">
                                  {entry.date ? String(entry.date).substring(0, 10) : '—'}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                    {entry.quarter || '—'}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  {entry.type === 'BILLING' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      Billing
                                    </span>
                                  ) : entry.type === 'PENALTY' || entry.type === 'LATE_FEE' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Late Penalty
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Receipt
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-[10px] text-slate-600">
                                  {entry.voucher_number || entry.reference_no || '—'}
                                </td>
                                <td className="py-2 px-3 text-slate-700 max-w-xs truncate" title={entry.description || entry.particulars}>
                                  {entry.description || entry.particulars || (entry.type === 'PENALTY' ? 'Overdue Late Fee Penalty' : '—')}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                  {Number(entry.debit) > 0 ? `₹${Number(entry.debit).toLocaleString('en-IN')}` : '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                                  {Number(entry.credit) > 0 ? `₹${Number(entry.credit).toLocaleString('en-IN')}` : '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                  ₹{Number(entry.running_balance).toLocaleString('en-IN')}
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
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudentPassbook(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Passbook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Add New Fee Student ──────────────────────────────────── */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-teal-600 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span>Add Fee Student to Roster</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                className="p-1 rounded-lg hover:bg-teal-700 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateStudent} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-hidden focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Father / Guardian Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Sharma"
                    value={newParentName}
                    onChange={(e) => setNewParentName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-hidden focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Admission Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ADM-2026-089"
                    value={newAdmissionNumber}
                    onChange={(e) => setNewAdmissionNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-hidden focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Mobile Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 916398135162 or 9876543210"
                  value={newWhatsappNumber}
                  onChange={(e) => setNewWhatsappNumber(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-hidden focus:border-teal-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Include country code (e.g. 91) or enter 10 digits. Used for cash OTPs and fee receipts.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Class &amp; Section *
                </label>
                <select
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-teal-500 cursor-pointer"
                >
                  <option value="">Select Class...</option>
                  {sortClassesAscending(classes).map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.section ? `(${cls.section})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-teal-700 mt-1">
                  The student will be linked to this class's tuition fee slab automatically.
                </p>
              </div>

              <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200 text-[11px] text-teal-900 leading-relaxed">
                <span className="font-bold">Isolated Double-Entry Roster:</span> A dedicated Sub-Ledger account (<code className="font-mono bg-teal-100 px-1 rounded">1100-&#123;id&#125;</code>) will be created for this student immediately.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {savingStudent ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Student...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Register Fee Student</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Import Fee Students (Excel / CSV) ───────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-700 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Import Fee Students (Excel / CSV)</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                className="p-1 rounded-lg hover:bg-emerald-800 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleImportStudents} className="p-5 space-y-4">
              {/* Sample Template Download Box */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Download Sample Template</span>
                  </span>
                  <p className="text-[11px] text-emerald-800">
                    Get pre-formatted spreadsheet with <code className="font-mono font-bold text-[10px]">student_name</code>, <code className="font-mono font-bold text-[10px]">parent_name</code>, <code className="font-mono font-bold text-[10px]">class</code>, <code className="font-mono font-bold text-[10px]">section</code>, <code className="font-mono font-bold text-[10px]">phone</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .CSV</span>
                </button>
              </div>

              {/* File Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Excel (.xlsx, .xls) or CSV (.csv) File *
                </label>
                <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImportFile(e.target.files[0]);
                        setImportResult(null);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    {importFile ? (
                      <div>
                        <p className="text-xs font-bold text-slate-800">{importFile.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {(importFile.size / 1024).toFixed(1)} KB • Ready to upload
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-slate-700">
                          Click to browse or drag and drop your student roster
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Supports Microsoft Excel (.xlsx, .xls) and standard CSV
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Information & Safety Specs */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-[11px] text-slate-600">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Import Rules &amp; Sync Guarantee:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                  <li><strong>Multiple Imports:</strong> Re-importing safely updates existing student records and appends new students.</li>
                  <li><strong>COA Sub-Ledgers:</strong> Every imported student automatically gets a sub-ledger (<code className="font-mono bg-slate-200 px-1 rounded text-[10px]">1100-&#123;id&#125;</code>) in Chart of Accounts.</li>
                  <li><strong>Classes Auto-Mapped:</strong> Missing fee classes and sections (e.g. 1-A, 2-B) are auto-created and linked to fee slabs.</li>
                  <li><strong>WhatsApp Broadcasts Safe:</strong> Isolated strictly to the accounting engine. Marketing campaign contacts are never touched.</li>
                </ul>
              </div>

              {/* Result Summary */}
              {importResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Import Completed Successfully</span>
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Added <span className="font-bold">{importResult.created_count || 0}</span> new students, updated <span className="font-bold">{importResult.updated_count || 0}</span> existing students, and registered <span className="font-bold">{importResult.classes_created || 0}</span> class sections.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportResult(null);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing Roster...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload &amp; Import</span>
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

export default FeeManagementPage;
