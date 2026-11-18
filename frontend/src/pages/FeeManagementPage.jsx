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
  FileText,
} from 'lucide-react';
import { api } from '../services/api';
import { sortClassesAscending } from '../utils/classSort';

export function FeeManagementPage({ showToast }) {
  const [slabs, setSlabs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState('2026-2027');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [editingSlabId, setEditingSlabId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formQuarterlyFee, setFormQuarterlyFee] = useState('');
  const [formClassIds, setFormClassIds] = useState([]);
  const [formDesc, setFormDesc] = useState('');

  // Quarterly Billing Trigger State (Default to ALL active quarters)
  const [postingQuarter, setPostingQuarter] = useState(false);
  const [selectedQuarterToBill, setSelectedQuarterToBill] = useState('ALL');
  const [autoPostBilling, setAutoPostBilling] = useState(true);

  useEffect(() => {
    loadData();
  }, [academicYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [slabsData, clsData] = await Promise.all([
        api.getFeeSlabs({ academic_year: academicYear }),
        api.getClasses(),
      ]);
      const rawSlabs = Array.isArray(slabsData) ? slabsData : [];
      setSlabs(rawSlabs.map(s => ({ ...s, classes: sortClassesAscending(s.classes || []) })));
      setClasses(sortClassesAscending(clsData));
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
          showToast?.({ type: 'success', title: 'Created', message: 'Fee slab created successfully.' });
        }
      } else {
        await api.updateFeeSlab(editingSlabId, payload);
        showToast?.({ type: 'success', title: 'Updated', message: 'Fee slab updated successfully.' });
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      showToast?.({ type: 'error', title: 'Error', message: err.message || 'Failed to save slab.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlab = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await api.deleteFeeSlab(id);
      showToast?.({ type: 'success', title: 'Deleted', message: 'Fee slab removed.' });
      loadData();
    } catch (err) {
      showToast?.({ type: 'error', title: 'Error', message: err.message || 'Could not delete slab.' });
    }
  };

  const handlePostQuarterlyFees = async () => {
    if (!window.confirm(`Post ${selectedQuarterToBill} quarterly fees to all student ledgers for ${academicYear}?`)) {
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
        title: 'Quarterly Fees Billed',
        message: res.message || `Posted ${selectedQuarterToBill} fees to student ledgers.`,
      });
    } catch (err) {
      showToast?.({ type: 'error', title: 'Billing Error', message: err.message || 'Failed to post fees.' });
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
              MANAGEMENT SECTION
            </span>
            <span className="text-xs font-semibold text-slate-500">Academic Year: {academicYear}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Class Fee Slabs &amp; Yearly Rates
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure quarterly tuition rates for class brackets. Increase or decrease fees yearly with zero Excel re-uploads.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Fee Slab</span>
          </button>
        </div>
      </div>

      {/* Quarterly Billing Controller */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/80 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-teal-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-700" />
            <span>Post Quarterly Fees to Ledger (Double-Entry Debit)</span>
          </h3>
          <p className="text-xs text-teal-700/80 mt-1 max-w-xl">
            Generates automated Debit entries on student ledgers according to their class slabs. Duplicates for the same quarter are automatically skipped.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedQuarterToBill}
            onChange={(e) => setSelectedQuarterToBill(e.target.value)}
            className="px-3 py-2 bg-white border border-teal-300 rounded-xl text-xs font-bold text-teal-900 outline-hidden cursor-pointer"
          >
            <option value="ALL">All Active Quarters (Oct - Mar: Q3 &amp; Q4) &bull; Recommended</option>
            <option value="ALL_YEAR">All 4 Quarters (Full Year: Q1 to Q4)</option>
            <option value="Q3">Q3 (Oct - Dec) &bull; Portal Launch Quarter (Cutoff 10-Nov)</option>
            <option value="Q4">Q4 (Jan - Mar) &bull; Cutoff 10-Feb</option>
            <option value="Q1">Q1 (Apr - Jun) &bull; Pre-Portal Legacy</option>
            <option value="Q2">Q2 (Jul - Sep) &bull; Pre-Portal Legacy</option>
          </select>

          <button
            onClick={handlePostQuarterlyFees}
            disabled={postingQuarter || slabs.length === 0}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            {postingQuarter ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>
                  Post {selectedQuarterToBill === 'ALL' ? 'All Active Quarters' : selectedQuarterToBill === 'ALL_YEAR' ? 'All 4 Quarters' : selectedQuarterToBill} Fees
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Slabs Cards Grid */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-xs font-semibold">Loading fee slabs...</p>
        </div>
      ) : slabs.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200/80 text-center flex flex-col items-center">
          <Layers className="w-12 h-12 text-slate-300 mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No Fee Slabs Configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Create your first slab (e.g. Playway to 5th, 6th to 8th, 9th &amp; 10th, 11th &amp; 12th) to automate billing.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl"
          >
            Create Slab Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {slabs.map((slab) => (
            <div
              key={slab.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-teal-500/50 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{slab.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                    {slab.academic_year}
                  </span>
                </div>
                {slab.description && (
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{slab.description}</p>
                )}

                {/* Quarterly Fee Highlight */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-baseline justify-between">
                  <span className="text-[11px] font-medium text-slate-500">Quarterly Fee:</span>
                  <span className="text-lg font-black text-slate-900 flex items-center">
                    <IndianRupee className="w-4 h-4 text-teal-600" />
                    <span>{Number(slab.quarterly_fee).toLocaleString('en-IN')}</span>
                  </span>
                </div>

                {/* Classes Tag List */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
                      Assigned Classes:
                    </span>
                    <span>{slab.student_count || 0} Students</span>
                  </div>

                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar pt-1">
                    {(slab.classes || []).length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">No classes assigned</span>
                    ) : (
                      (slab.classes || []).map((c) => (
                        <span
                          key={c.id}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                        >
                          {c.name} {c.section ? `(${c.section})` : ''}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEditModal(slab)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                  title="Edit Slab / Revise Fee"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteSlab(slab.id, slab.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Delete Slab"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create or Edit Slab */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {modalMode === 'CREATE' ? 'Create New Fee Slab' : 'Edit Fee Slab & Revise Rates'}
                </h3>
                <p className="text-[11px] text-slate-500">Configure quarterly tuition fee and assigned classes.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlab} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Slab Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Slab 1 (Playway to 5th)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-teal-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quarterly Fee (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 5000"
                    value={formQuarterlyFee}
                    onChange={(e) => setFormQuarterlyFee(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-teal-500 outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Billed 4 times a year (Apr, Jul, Oct, Jan). Increase or decrease anytime for fee revision.
                </p>
              </div>

              {/* Class Selector Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Classes for this Slab:
                </label>
                <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-1.5">
                  {classes.map((c) => {
                    const isSelected = formClassIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleClassSelect(c.id)}
                        className={`px-2 py-1.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                        }`}
                      >
                        <span className="truncate">{c.name} {c.section ? `(${c.section})` : ''}</span>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Description:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary classes fee standard"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-teal-500 outline-hidden"
                />
              </div>

              {modalMode === 'CREATE' && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50/80 border border-teal-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPostBilling}
                    onChange={(e) => setAutoPostBilling(e.target.checked)}
                    className="mt-0.5 accent-teal-600 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-teal-950 block">
                      Automatically post fees to all quarters for assigned classes
                    </span>
                    <span className="text-[11px] text-teal-700 block mt-0.5">
                      Creates double-entry fee billing entries across all active quarters immediately upon creation.
                    </span>
                  </div>
                </label>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{modalMode === 'CREATE' ? 'Create Slab' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
