import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Search, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export const StudentsPage = ({ showToast }) => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [optInFilter, setOptInFilter] = useState('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form states
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);

  const [formName, setFormName] = useState('');
  const [formParent, setFormParent] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOptIn, setFormOptIn] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classesData, studentsData] = await Promise.all([
        api.getClasses(),
        api.getStudents({
          class_id: selectedClassId ? Number(selectedClassId) : undefined,
          search: searchTerm ? searchTerm : undefined,
          opt_in: optInFilter === 'ALL' ? undefined : optInFilter === 'OPTED_IN',
        }),
      ]);
      setClasses(classesData);
      setStudents(studentsData);
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

  useEffect(() => {
    fetchData();
  }, [selectedClassId, optInFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const openAddModal = () => {
    setFormName('');
    setFormParent('');
    setFormClassId(classes.length > 0 ? classes[0].id : '');
    setFormPhone('');
    setFormOptIn(true);
    setShowAddModal(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setFormName(student.student_name);
    setFormParent(student.parent_name || '');
    setFormClassId(student.class_id);
    setFormPhone(student.whatsapp_number);
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
            Manage student phone records and WhatsApp consent status.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start sm:self-auto w-full sm:w-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Student</span>
        </button>
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
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 transition-colors shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs font-medium"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={optInFilter}
            onChange={(e) => setOptInFilter(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs font-medium"
          >
            <option value="ALL">All Consent Status</option>
            <option value="OPTED_IN">Opted In Only</option>
            <option value="OPTED_OUT">Opted Out Only</option>
          </select>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 min-w-[650px]">
              <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Parent Name</th>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4">WhatsApp Number</th>
                  <th className="px-6 py-4">Opt-In Consent</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition-colors font-sans">
                    <td className="px-6 py-4 font-bold text-slate-900">{student.student_name}</td>
                    <td className="px-6 py-4 text-slate-600">{student.parent_name || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-sky-800 text-xs font-semibold border border-slate-200">
                        {student.class_name || `Class #${student.class_id}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                      +{student.whatsapp_number}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleOptIn(student)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                          student.whatsapp_opt_in
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingStudent(student);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors"
                          title="Delete"
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
    </div>
  );
};
