import React, { useEffect, useState } from 'react';
import { GraduationCap, Plus, Users, Trash2, Edit2, ChevronRight, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { ClassItem, StudentItem } from '../types';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

interface ClassesPageProps {
  onNavigateToSendMessage: () => void;
  showToast: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string }) => void;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({
  onNavigateToSendMessage,
  showToast,
}) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected class for student list inspection
  const [activeClassId, setActiveClassId] = useState<number | null>(null);
  const [classStudents, setClassStudents] = useState<StudentItem[]>([]);
  const [loadingClassStudents, setLoadingClassStudents] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);

  const [formName, setFormName] = useState('');
  const [formSection, setFormSection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        title: 'Error loading classes',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  // Fetch students for active class
  useEffect(() => {
    if (!activeClassId) {
      setClassStudents([]);
      return;
    }

    const fetchStudents = async () => {
      setLoadingClassStudents(true);
      try {
        const students = await api.getStudents({ class_id: activeClassId });
        setClassStudents(students);
      } catch (err) {
        console.error('Error fetching class students', err);
      } finally {
        setLoadingClassStudents(false);
      }
    };
    fetchStudents();
  }, [activeClassId]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return showToast({ type: 'warning', title: 'Class name is required' });

    setIsSubmitting(true);
    try {
      const newClass = await api.createClass({
        name: formName.trim(),
        section: formSection.trim() || undefined,
      });
      showToast({ type: 'success', title: `Class '${newClass.name}' Created` });
      setShowCreateModal(false);
      setFormName('');
      setFormSection('');
      fetchClasses();
      setActiveClassId(newClass.id);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to create class',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !formName.trim()) return;

    setIsSubmitting(true);
    try {
      await api.updateClass(editingClass.id, {
        name: formName.trim(),
        section: formSection.trim() || undefined,
      });
      showToast({ type: 'success', title: 'Class Updated' });
      setShowEditModal(false);
      fetchClasses();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to update class',
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
      showToast({ type: 'success', title: 'Class Deleted' });
      setShowDeleteModal(false);
      if (activeClassId === deletingClass.id) {
        setActiveClassId(null);
      }
      fetchClasses();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to delete class',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const activeClassObj = classes.find((c) => c.id === activeClassId);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-emerald-400" />
            <span>Class Sections</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Organize student rosters by academic class and section.
          </p>
        </div>

        <button
          onClick={() => {
            setFormName('');
            setFormSection('');
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Class</span>
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading classes..." />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No classes created yet"
          description="Create your first class (e.g. Class 10-A) and assign students to it."
          actionLabel="Create Class"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Class List (Left Column) */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              All Classes ({classes.length})
            </h3>
            {classes.map((cls) => {
              const isActive = activeClassId === cls.id;
              return (
                <div
                  key={cls.id}
                  onClick={() => setActiveClassId(cls.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isActive
                      ? 'bg-slate-800/90 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                      : 'glass-panel hover:bg-slate-800/50 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {cls.section || 'A'}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{cls.name}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{cls.student_count} Enrolled Students</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClass(cls);
                        setFormName(cls.name);
                        setFormSection(cls.section || '');
                        setShowEditModal(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      title="Edit Class"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingClass(cls);
                        setShowDeleteModal(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                      title="Delete Class"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isActive ? 'text-emerald-400 translate-x-1' : 'text-slate-600'
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
              <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                  <div>
                    <h3 className="text-lg font-bold text-white">{activeClassObj.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Section {activeClassObj.section || 'A'} &bull; {classStudents.length} Students
                    </p>
                  </div>

                  <button
                    onClick={onNavigateToSendMessage}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all"
                  >
                    <span>Broadcast to this Class</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-4">
                  {loadingClassStudents ? (
                    <LoadingSpinner message="Fetching roster..." />
                  ) : classStudents.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No students currently added to this class. Add them in the Students tab.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {classStudents.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80"
                        >
                          <div>
                            <p className="text-sm font-bold text-white">{s.student_name}</p>
                            <p className="text-xs text-slate-400">
                              {s.parent_name ? `${s.parent_name} • ` : ''}+{s.whatsapp_number}
                            </p>
                          </div>
                          <div>
                            {s.whatsapp_opt_in ? (
                              <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                Opted In
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
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
              <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400 text-sm">
                Select a class on the left to view its details and student roster.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Class">
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Class Name *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Class 10-A, Class 9-B"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Section (Optional)</label>
            <input
              type="text"
              value={formSection}
              onChange={(e) => setFormSection(e.target.value)}
              placeholder="e.g. A, B, Science, Commerce"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950 transition-all"
            >
              {isSubmitting ? 'Creating...' : 'Create Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Class Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Class">
        <form onSubmit={handleUpdateClass} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Class Name *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Section</label>
            <input
              type="text"
              value={formSection}
              onChange={(e) => setFormSection(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950 transition-all"
            >
              {isSubmitting ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Class Deletion">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to delete <strong className="text-white font-bold">{deletingClass?.name}</strong>?
          </p>
          <p className="text-xs text-rose-400 font-semibold">
            Warning: All {deletingClass?.student_count || 0} students assigned to this class will be removed from this roster.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteClass}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950 transition-all"
            >
              Delete Class
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
