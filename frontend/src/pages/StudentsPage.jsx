import React, { useEffect, useState, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  UploadCloud,
  FileText,
  Info,
  Download,
  ChevronDown,
  Receipt,
  Megaphone,
  Send,
  Zap,
  CheckSquare,
  Square,
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export const StudentsPage = ({ onNavigateToSendMessage, showToast }) => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Checkbox Selection state for Students
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [optInFilter, setOptInFilter] = useState('ALL');
  const [feeFilter, setFeeFilter] = useState('ALL');

  // Action Dropdown Menu & Class Dropdown
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef(null);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const classDropdownRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuOpen(false);
      }
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target)) {
        setClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Import states
  const [importFile, setImportFile] = useState(null);
  const [importClassId, setImportClassId] = useState('');
  const [resetAbsentFees, setResetAbsentFees] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Form states
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);

  const [formName, setFormName] = useState('');
  const [formParent, setFormParent] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formFeesDue, setFormFeesDue] = useState('0');
  const [formOptIn, setFormOptIn] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classesData, studentsData] = await Promise.all([
        api.getClasses(),
        api.getStudents({
          class_ids: selectedClassIds.length > 0 ? selectedClassIds : undefined,
          search: searchTerm ? searchTerm : undefined,
          opt_in: optInFilter === 'ALL' ? undefined : optInFilter === 'OPTED_IN',
          fees_filter: feeFilter === 'ALL' ? undefined : feeFilter,
        }),
      ]);
      setClasses(classesData);
      setStudents(studentsData);
      // Auto-select all students when list is fetched or filtered
      setSelectedStudentIds(studentsData.map((s) => s.id));
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error loading students',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectStudent = (studentId) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === students.length && students.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s.id));
    }
  };

  const handleWorkflowClick = (workflow) => {
    setActionMenuOpen(false);
    if (!onNavigateToSendMessage) return;

    // Use only currently selected / checked students
    let targetIds = selectedStudentIds;
    if (targetIds.length === 0) {
      if (showToast) {
        showToast({
          type: 'warning',
          title: 'No Students Selected',
          message: 'Please check at least one student checkbox before starting broadcast.',
        });
      }
      return;
    }

    const selectedStudentObjects = students.filter((s) => targetIds.includes(s.id));
    const cSet = new Set();
    selectedStudentObjects.forEach((s) => {
      const cid = s.class_id || (s.school_class && s.school_class.id);
      if (cid) cSet.add(Number(cid));
    });
    const targetClassIds = Array.from(cSet);

    onNavigateToSendMessage({
      workflow,
      studentIds: targetIds,
      classIds: targetClassIds.length > 0 ? targetClassIds : (selectedClassIds.length > 0 ? selectedClassIds : (classes.length > 0 ? [classes[0].id] : [])),
    });
  };

  useEffect(() => {
    fetchData();
  }, [selectedClassIds.join(','), optInFilter, feeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const openAddModal = () => {
    setFormName('');
    setFormParent('');
    setFormClassId(classes.length > 0 ? classes[0].id : '');
    setFormPhone('');
    setFormFeesDue('0');
    setFormOptIn(true);
    setShowAddModal(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setFormName(student.student_name);
    setFormParent(student.parent_name || '');
    setFormClassId(student.class_id);
    setFormPhone(student.whatsapp_number);
    setFormFeesDue(student.fees_due !== undefined && student.fees_due !== null ? student.fees_due.toString() : '0');
    setFormOptIn(student.whatsapp_opt_in);
    setShowEditModal(true);
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return showToast({ type: 'warning', title: 'Student name is required' });
    if (!formClassId) return showToast({ type: 'warning', title: 'Please select a class' });
    if (!formPhone.trim()) return showToast({ type: 'warning', title: 'WhatsApp number is required' });

    setIsSubmitting(true);
    try {
      await api.createStudent({
        class_id: Number(formClassId),
        student_name: formName.trim(),
        parent_name: formParent.trim() || undefined,
        whatsapp_number: formPhone.trim(),
        fees_due: parseFloat(formFeesDue) || 0.0,
        whatsapp_opt_in: formOptIn,
      });

      showToast({ type: 'success', title: 'Student Added Successfully' });
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to add student',
        message: err instanceof Error ? err.message : 'Validation failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!formName.trim()) return showToast({ type: 'warning', title: 'Student name is required' });
    if (!formPhone.trim()) return showToast({ type: 'warning', title: 'WhatsApp number is required' });

    setIsSubmitting(true);
    try {
      await api.updateStudent(editingStudent.id, {
        class_id: Number(formClassId),
        student_name: formName.trim(),
        parent_name: formParent.trim() || undefined,
        whatsapp_number: formPhone.trim(),
        fees_due: parseFloat(formFeesDue) || 0.0,
        whatsapp_opt_in: formOptIn,
      });

      showToast({ type: 'success', title: 'Student Updated' });
      setShowEditModal(false);
      fetchData();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to update student',
        message: err instanceof Error ? err.message : 'Update failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deletingStudent) return;
    try {
      await api.deleteStudent(deletingStudent.id);
      showToast({ type: 'success', title: 'Student Removed' });
      setShowDeleteModal(false);
      fetchData();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to delete student',
        message: err instanceof Error ? err.message : 'Delete failed',
      });
    }
  };

  const handleToggleOptIn = async (student) => {
    try {
      await api.updateStudent(student.id, {
        whatsapp_opt_in: !student.whatsapp_opt_in,
      });
      showToast({
        type: 'info',
        title: `Opt-in status changed for ${student.student_name}`,
        message: !student.whatsapp_opt_in ? 'Opted In' : 'Opted Out',
      });
      fetchData();
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to toggle opt-in status' });
    }
  };

  const handleClearStudentFees = async (student) => {
    try {
      await api.updateStudent(student.id, {
        fees_due: 0,
      });
      if (showToast) {
        showToast({
          type: 'success',
          title: 'Fees Cleared',
          message: `Cleared dues for ${student.student_name}. Marked as ₹0 (Paid).`,
        });
      }
      fetchData();
    } catch (err) {
      if (showToast) showToast({ type: 'error', title: 'Failed to clear student fees' });
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      if (showToast) showToast({ type: 'warning', title: 'Please select an Excel or CSV file' });
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      if (importClassId) {
        formData.append('class_id', importClassId);
      }
      formData.append('reset_absent_fees', resetAbsentFees ? 'true' : 'false');

      const result = await api.importStudents(formData);
      if (showToast) {
        showToast({
          type: 'success',
          title: 'Import Complete!',
          message: result.message || `Successfully imported ${result.imported_count} students.`,
        });
      }
      setShowImportModal(false);
      setImportFile(null);
      setImportClassId('');
      setResetAbsentFees(false);
      fetchData();
    } catch (err) {
      if (showToast) {
        showToast({
          type: 'error',
          title: 'Import Failed',
          message: err instanceof Error ? err.message : 'Failed to parse and import spreadsheet.',
        });
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadSample = () => {
    const csvContent =
      "Student Name,Parent Name,Class,Section,WhatsApp Number,Fees Due\n" +
      "Rahul Sharma,Rajesh Sharma,Class 1,A,919876543210,2500\n" +
      "Deepak Agrawal,Mahesh Agrawal,Class 1,A,917017199086,3500\n" +
      "Nishant Garg,Sunil Garg,Class 3,B,917088177858,4200\n" +
      "Umesh Kumar,Ramesh Kumar,Class 2,A,919548398339,3000\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'school_students_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (showToast) {
      showToast({
        type: 'success',
        title: 'Sample Template Downloaded',
        message: 'Open and edit this CSV in Microsoft Excel or Google Sheets, then upload.',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
            <span>Student Management</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage student phone records, WhatsApp consent, and import student rosters.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto w-full sm:w-auto">
          <button
            onClick={() => {
              setImportFile(null);
              setImportClassId('');
              setShowImportModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 shadow-xs transition-all active:scale-95 flex-1 sm:flex-initial cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import Excel / CSV</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 flex-1 sm:flex-initial cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student, parent, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1.5"
            title="Search"
          >
            <span>Search</span>
          </button>
        </form>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full md:w-auto">
          {/* Multi-Select Class Filter Dropdown */}
          <div className="relative shrink-0 w-full sm:w-auto" ref={classDropdownRef}>
            <button
              type="button"
              onClick={() => setClassDropdownOpen((prev) => !prev)}
              className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs font-medium cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">
                  {selectedClassIds.length === 0
                    ? 'All Classes'
                    : selectedClassIds.length === 1
                    ? (classes.find((c) => c.id === selectedClassIds[0])?.name || '1 Class') +
                      (classes.find((c) => c.id === selectedClassIds[0])?.section
                        ? ` (${classes.find((c) => c.id === selectedClassIds[0])?.section})`
                        : '')
                    : `${selectedClassIds.length} Classes Selected`}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  classDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {classDropdownOpen && (
              <div className="absolute left-0 mt-2 w-56 sm:w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Filter by Class
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedClassIds.length === classes.length) {
                        setSelectedClassIds([]);
                      } else {
                        setSelectedClassIds(classes.map((c) => c.id));
                      }
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    {selectedClassIds.length === classes.length ? 'Clear All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                  {/* Option for All Classes */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassIds([]);
                      setClassDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                      selectedClassIds.length === 0
                        ? 'bg-emerald-50 text-emerald-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {selectedClassIds.length === 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span>All Classes</span>
                  </button>

                  {/* Individual Class Checkboxes */}
                  {classes.map((c) => {
                    const isChecked = selectedClassIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClassIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-50 text-emerald-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          )}
                          <span className="truncate">
                            {c.name} {c.section ? `(${c.section})` : ''}
                          </span>
                        </div>
                        {c.student_count !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-normal">
                            {c.student_count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <select
            value={feeFilter}
            onChange={(e) => setFeeFilter(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs font-medium cursor-pointer"
          >
            <option value="ALL">💰 All Fee Status</option>
            <option value="PENDING">🟠 Fees Due (₹ &gt; 0)</option>
            <option value="PAID">🟢 Fees Paid (₹0)</option>
          </select>

          <select
            value={optInFilter}
            onChange={(e) => setOptInFilter(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Consent Status</option>
            <option value="OPTED_IN">Opted In Only</option>
            <option value="OPTED_OUT">Opted Out Only</option>
          </select>

          {/* Action Dropdown Menu to the right of All Consent Status */}
          <div className="relative shrink-0" ref={actionMenuRef}>
            <button
              type="button"
              onClick={() => setActionMenuOpen((prev) => !prev)}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Action</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${actionMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {actionMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Broadcast Workflows
                  </p>
                </div>

                <div className="p-1 space-y-1">
                  {/* Option 1: Fees Reminder */}
                  <button
                    type="button"
                    onClick={() => handleWorkflowClick('FEES')}
                    className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-amber-50/80 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-200 transition-colors">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-amber-900">
                        Fees Reminder
                      </p>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Broadcast dues &amp; reminders to {selectedStudentIds.length} selected parents
                      </p>
                    </div>
                  </button>

                  {/* Option 2: Announcement */}
                  <button
                    type="button"
                    onClick={() => handleWorkflowClick('ANNOUNCEMENT')}
                    className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-purple-50/80 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-purple-200 transition-colors">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-purple-900">
                        Announcement
                      </p>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Broadcast notices &amp; events to {selectedStudentIds.length} selected students
                      </p>
                    </div>
                  </button>

                  {/* Option 3: Normal Workflow */}
                  <button
                    type="button"
                    onClick={() => handleWorkflowClick('NORMAL')}
                    className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-emerald-50/80 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-200 transition-colors">
                      <Send className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                        Normal Workflow
                      </p>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Standard catalog broadcast to {selectedStudentIds.length} selected students
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Students Table */}
      {loading ? (
        <LoadingSpinner message="Loading students list..." />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Add students with their parents' WhatsApp numbers to begin automated messaging."
          actionLabel="Add Student"
          onAction={openAddModal}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {/* Top Selection Status Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-6 py-2.5 bg-slate-50/90 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800">
                {selectedStudentIds.length} of {students.length} students selected
              </span>
              {selectedStudentIds.length < students.length && (
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds(students.map((s) => s.id))}
                  className="text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                >
                  Select all ({students.length})
                </button>
              )}
              {selectedStudentIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-rose-600 hover:text-rose-700 font-medium underline cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold shadow-xs transition-colors cursor-pointer text-xs"
              >
                {selectedStudentIds.length === students.length && students.length > 0
                  ? 'Deselect All'
                  : 'Select All Students'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 min-w-[700px]">
              <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-900 transition-colors cursor-pointer inline-flex items-center justify-center"
                      title={
                        selectedStudentIds.length === students.length && students.length > 0
                          ? 'Deselect All'
                          : 'Select All'
                      }
                    >
                      {selectedStudentIds.length === students.length && students.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : selectedStudentIds.length > 0 ? (
                        <div className="w-4 h-4 rounded border-2 border-emerald-600 bg-emerald-100 flex items-center justify-center">
                          <div className="w-2 h-0.5 bg-emerald-700 rounded-full" />
                        </div>
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Parent Name</th>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4">WhatsApp Number</th>
                  <th className="px-6 py-4">Fees Due</th>
                  <th className="px-6 py-4">Opt-In Consent</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50/80 transition-colors font-sans ${
                        isSelected ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectStudent(student.id)}
                          className="p-1 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
                          title={isSelected ? 'Deselect student' : 'Select student'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">{student.student_name}</td>
                      <td className="px-6 py-4 text-slate-600">{student.parent_name || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-sky-800 text-xs font-semibold border border-slate-200 inline-block w-fit">
                            {student.class_name
                              ? student.class_name.split(' - ')[0]
                              : `Class #${student.class_id}`}
                          </span>
                          {student.class_section && (
                            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-600 text-[10px] font-bold border border-sky-100 inline-block w-fit">
                              Section {student.class_section}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">
                        +{student.whatsapp_number}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                            Number(student.fees_due || 0) > 0
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {Number(student.fees_due || 0) > 0
                            ? `₹${Number(student.fees_due).toLocaleString('en-IN')} Due`
                            : '₹0 Paid'}
                        </span>
                      </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleOptIn(student)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${student.whatsapp_opt_in
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        title="Click to toggle consent"
                      >
                        {student.whatsapp_opt_in ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Opted In</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Opted Out</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {Number(student.fees_due || 0) > 0 && (
                          <button
                            onClick={() => handleClearStudentFees(student)}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                            title="Mark Fee as Paid (₹0)"
                          >
                            Clear (₹0)
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingStudent(student);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Student">
        <form onSubmit={handleCreateStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Student Full Name *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Parent / Guardian Name</label>
            <input
              type="text"
              value={formParent}
              onChange={(e) => setFormParent(e.target.value)}
              placeholder="e.g. Rajesh Sharma"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Assign Class *</label>
            <select
              value={formClassId}
              onChange={(e) => setFormClassId(Number(e.target.value))}
              required
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            >
              <option value="" disabled>Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.section ? `(${c.section})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              WhatsApp Number (with Country Code) *
            </label>
            <input
              type="text"
              required
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="e.g. 919876543210"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              For India, enter 91 followed by 10 digits (without '+' sign).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Fees Due Amount (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formFeesDue}
              onChange={(e) => setFormFeesDue(e.target.value)}
              placeholder="e.g. 2500"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="opt_in_add"
              checked={formOptIn}
              onChange={(e) => setFormOptIn(e.target.checked)}
              className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="opt_in_add" className="text-xs text-slate-700 cursor-pointer font-medium">
              WhatsApp Communication Opt-In Confirmed
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
            >
              {isSubmitting ? 'Saving...' : 'Add Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Student">
        <form onSubmit={handleUpdateStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Student Full Name *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Parent / Guardian Name</label>
            <input
              type="text"
              value={formParent}
              onChange={(e) => setFormParent(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Assign Class *</label>
            <select
              value={formClassId}
              onChange={(e) => setFormClassId(Number(e.target.value))}
              required
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.section ? `(${c.section})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number *</label>
            <input
              type="text"
              required
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Fees Due Amount (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formFeesDue}
              onChange={(e) => setFormFeesDue(e.target.value)}
              placeholder="e.g. 2500"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="opt_in_edit"
              checked={formOptIn}
              onChange={(e) => setFormOptIn(e.target.checked)}
              className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="opt_in_edit" className="text-xs text-slate-700 cursor-pointer font-medium">
              WhatsApp Communication Opt-In Confirmed
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
            >
              {isSubmitting ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Student Removal">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to remove student <strong className="text-slate-900 font-bold">{deletingStudent?.student_name}</strong>?
          </p>
          <p className="text-xs text-slate-500">
            Their messaging history will be decoupled from future class broadcasts.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteStudent}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all active:scale-95"
            >
              Delete Student
            </button>
          </div>
        </div>
      </Modal>

      {/* Import Excel / CSV Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          if (!isImporting) {
            setShowImportModal(false);
            setImportFile(null);
          }
        }}
        title="Import Students from Excel / CSV"
      >
        <form onSubmit={handleImportSubmit} className="space-y-4">
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Smart Class Detection &amp; Auto-Creation</span>
            </div>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              If your Excel or CSV sheet contains a <code className="font-mono bg-emerald-100/70 px-1 py-0.5 rounded font-bold">Class</code> or <code className="font-mono bg-emerald-100/70 px-1 py-0.5 rounded font-bold">Grade</code> column, students will be placed into their respective classes. Any class that does not exist in the database will be <strong>created automatically</strong>!
            </p>
          </div>

          {/* Download Sample Template Card */}
          <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50/80 to-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-emerald-950 truncate">Need a spreadsheet format?</p>
                <p className="text-[11px] text-emerald-800 font-medium">Download editable Excel/CSV with all supported columns</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sample</span>
            </button>
          </div>

          {/* File Selector Dropzone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Select Excel or CSV Spreadsheet *
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              required
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setImportFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${importFile
                  ? 'border-emerald-500 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/20'
                }`}
            >
              {importFile ? (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 truncate max-w-xs mx-auto">
                    {importFile.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {(importFile.size / 1024).toFixed(1)} KB &bull; Click to change file
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto shadow-xs">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Click to browse or drag and drop spreadsheet
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Fallback Class Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Class Assignment Option
            </label>
            <select
              value={importClassId}
              onChange={(e) => setImportClassId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs cursor-pointer"
            >
              <option value="">✨ Auto-detect &amp; Create Classes from Spreadsheet Columns</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Force Assign All to: {c.name} {c.section ? `(${c.section})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Leave on Auto-detect to create or map classes directly from the sheet columns.
            </p>
          </div>

          {/* Fee Defaulters Sync Mode Checkbox */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-1.5">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="reset_absent_fees"
                checked={resetAbsentFees}
                onChange={(e) => setResetAbsentFees(e.target.checked)}
                className="mt-0.5 rounded bg-white border-amber-400 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="reset_absent_fees" className="text-xs font-bold text-amber-950 cursor-pointer select-none">
                Fee Defaulters Sync Mode (Auto-Clear fees for paid students)
              </label>
            </div>
            <p className="text-[11px] text-amber-900/80 leading-relaxed pl-6">
              Enable this if your spreadsheet contains <strong>only students who currently owe fees</strong>. Any existing students in the imported classes who are not in this sheet will have their dues auto-set to <strong>₹0 (Paid)</strong>. Other classes not in the sheet remain untouched.
            </p>
          </div>

          {/* Supported Columns Guide */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 block">Supported Column Headers:</span>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Get Sample File</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1 text-slate-600 font-mono text-[10px]">
              <div>&bull; <span className="font-bold text-slate-800">Student Name</span> *</div>
              <div>&bull; <span className="font-bold text-slate-800">WhatsApp / Phone</span> *</div>
              <div>&bull; <span className="text-emerald-700 font-bold">Class / Grade</span></div>
              <div>&bull; <span className="text-slate-600">Parent Name</span></div>
              <div>&bull; <span className="text-slate-600">Section</span></div>
              <div>&bull; <span className="text-amber-800 font-bold">Fees Due</span> (₹)</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isImporting}
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isImporting || !importFile}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              {isImporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Importing Spreadsheet...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import Students</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
