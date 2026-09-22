import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  Plus,
  Users,
  Trash2,
  Edit2,
  ChevronRight,
  ArrowRight,
  UserPlus,
  Phone,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export const ClassesPage = ({
  onNavigateToSendMessage,
  showToast,
}) => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected class for student list inspection
  const [activeClassId, setActiveClassId] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [loadingClassStudents, setLoadingClassStudents] = useState(false);

  // Modals for Group/Class
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Modal for Adding Student directly to Active Group
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);

  const [editingClass, setEditingClass] = useState(null);
  const [deletingClass, setDeletingClass] = useState(null);

  // Group Form states
  const [formName, setFormName] = useState('');
  const [formSection, setFormSection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Student Form states
  const [studentName, setStudentName] = useState('');
  const [studentParent, setStudentParent] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentOptIn, setStudentOptIn] = useState(true);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const data = await api.getClasses();
      setClasses(data);
      if (data.length > 0 && !activeClassId) {
        setActiveClassId(data[0].id);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error loading groups',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchStudents = async () => {
    if (!activeClassId) {
      setClassStudents([]);
      return;
    }
    setLoadingClassStudents(true);
    try {
      const students = await api.getStudents({ class_id: activeClassId });
      setClassStudents(students);
    } catch (err) {
      console.error('Error fetching group students', err);
    } finally {
      setLoadingClassStudents(false);
    }
  };

  // Fetch students for active class
  useEffect(() => {
    fetchStudents();
  }, [activeClassId]);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return showToast({ type: 'warning', title: 'Group name is required' });

    setIsSubmitting(true);
    try {
      const newClass = await api.createClass({
        name: formName.trim(),
        section: formSection.trim() || undefined,
      });
      showToast({ type: 'success', title: `Group '${newClass.name}' Created` });
      setShowCreateModal(false);
      setFormName('');
      setFormSection('');
      await fetchClasses();
      setActiveClassId(newClass.id);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to create group',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClass = async (e) => {
    e.preventDefault();
    if (!editingClass || !formName.trim()) return;

    setIsSubmitting(true);
    try {
      await api.updateClass(editingClass.id, {
        name: formName.trim(),
        section: formSection.trim() || undefined,
      });
      showToast({ type: 'success', title: 'Group Updated' });
      setShowEditModal(false);
      fetchClasses();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to update group',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!deletingClass) return;
    try {
      await api.deleteClass(deletingClass.id);
      showToast({ type: 'success', title: 'Group Deleted' });
      setShowDeleteModal(false);
      if (activeClassId === deletingClass.id) {
        setActiveClassId(null);
      }
      fetchClasses();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to delete group',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleAddStudentToGroup = async (e) => {
    e.preventDefault();
    if (!studentName.trim()) return showToast({ type: 'warning', title: 'Student name is required' });
    if (!studentPhone.trim()) return showToast({ type: 'warning', title: 'WhatsApp number is required' });
    if (!activeClassId) return;

    setIsAddingStudent(true);
    try {
      await api.createStudent({
        class_id: activeClassId,
        student_name: studentName.trim(),
        parent_name: studentParent.trim() || undefined,
        whatsapp_number: studentPhone.trim(),
        whatsapp_opt_in: studentOptIn,
      });

      showToast({ type: 'success', title: 'Student Added to Group' });
      setShowAddStudentModal(false);
      setStudentName('');
      setStudentParent('');
      setStudentPhone('');
      setStudentOptIn(true);
      fetchStudents();
      fetchClasses();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to add student',
        message: err instanceof Error ? err.message : 'Validation failed',
      });
    } finally {
      setIsAddingStudent(false);
    }
  };

  const activeClassObj = classes.find((c) => c.id === activeClassId);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
            <span>Groups &amp; Class Sections</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create custom groups (classes, sections, committees) and add student phone records.
          </p>
        </div>

        <button
          onClick={() => {
            setFormName('');
            setFormSection('');
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start sm:self-auto w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Group</span>
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading groups and classrooms..." />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No groups created yet"
          description="Create your first group (e.g. Class 10-A, Sports Team, or Bus Committee) and add students directly from the UI."
          actionLabel="Create Group"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Class List (Left Column) */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              All Groups ({classes.length})
            </h3>
            {classes.map((cls) => {
              const isActive = activeClassId === cls.id;
              return (
                <div
                  key={cls.id}
                  onClick={() => setActiveClassId(cls.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-xs ${
                    isActive
                      ? 'bg-emerald-50/80 border-emerald-300 shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-200/90'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {cls.section || 'A'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{cls.name}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{cls.student_count} Enrolled Students</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClass(cls);
                        setFormName(cls.name);
                        setFormSection(cls.section || '');
                        setShowEditModal(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Edit Group"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingClass(cls);
                        setShowDeleteModal(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isActive ? 'text-emerald-600 translate-x-0.5' : 'text-slate-400'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Class Details & Roster (Right Column) */}
          <div className="lg:col-span-7">
            {activeClassObj ? (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{activeClassObj.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Section/Tag: <span className="font-semibold text-slate-700">{activeClassObj.section || 'General'}</span> &bull; {classStudents.length} Students
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddStudentModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Student</span>
                    </button>

                    <button
                      onClick={onNavigateToSendMessage}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-all"
                    >
                      <span>Broadcast</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {loadingClassStudents ? (
                    <LoadingSpinner message="Fetching roster..." />
                  ) : classStudents.length === 0 ? (
                    <div className="p-8 text-center space-y-3">
                      <p className="text-xs text-slate-500">
                        No students enrolled in this group yet. Add students directly using the button below.
                      </p>
                      <button
                        onClick={() => setShowAddStudentModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add First Student to {activeClassObj.name}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {classStudents.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{s.student_name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              {s.parent_name && <span>Parent: {s.parent_name} &bull;</span>}
                              <span className="font-mono text-slate-700 font-medium">+{s.whatsapp_number}</span>
                            </p>
                          </div>
                          <div>
                            {s.whatsapp_opt_in ? (
                              <span className="text-[11px] font-semibold text-emerald-700 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                                Opted In
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-rose-700 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200">
                                Opted Out
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm shadow-xs">
                Select a group on the left to view its roster or add students.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Student Directly to Active Group Modal */}
      <Modal
        isOpen={showAddStudentModal}
        onClose={() => setShowAddStudentModal(false)}
        title={`Add Student to ${activeClassObj?.name || 'Group'}`}
      >
        <form onSubmit={handleAddStudentToGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Student Full Name *</label>
            <input
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Parent / Guardian Name</label>
            <input
              type="text"
              value={studentParent}
              onChange={(e) => setStudentParent(e.target.value)}
              placeholder="e.g. Rajesh Sharma"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              WhatsApp Phone Number (with Country Code) *
            </label>
            <input
              type="text"
              required
              value={studentPhone}
              onChange={(e) => setStudentPhone(e.target.value)}
              placeholder="e.g. 919876543210"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Enter country code + 10 digits without '+' (e.g. 919876543210 for India).
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="opt_in_group_add"
              checked={studentOptIn}
              onChange={(e) => setStudentOptIn(e.target.checked)}
              className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="opt_in_group_add" className="text-xs text-slate-700 cursor-pointer font-medium">
              WhatsApp Broadcast Opt-In Confirmed
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddStudentModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAddingStudent}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
            >
              {isAddingStudent ? 'Saving...' : 'Add to Group'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Group Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Group / Class">
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Group / Class Name *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Class 10-A, Science Club, Parents Committee"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Section / Category (Optional)</label>
            <input
              type="text"
              value={formSection}
              onChange={(e) => setFormSection(e.target.value)}
              placeholder="e.g. Section A, Academic, Transport"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Group Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Group">
        <form onSubmit={handleUpdateClass} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Group Name *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Section / Category</label>
            <input
              type="text"
              value={formSection}
              onChange={(e) => setFormSection(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
            />
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
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Group Deletion">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to delete <strong className="text-slate-900 font-bold">{deletingClass?.name}</strong>?
          </p>
          <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            Warning: All {deletingClass?.student_count || 0} students assigned to this group will be removed from this roster.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteClass}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all active:scale-95"
            >
              Delete Group
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
