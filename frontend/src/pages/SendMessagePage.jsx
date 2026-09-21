import React, { useEffect, useState } from 'react';
import {
  Send,
  Users,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Phone,
  CheckSquare,
  Square,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const SendMessagePage = ({
  onNavigateToCampaign,
  showToast,
}) => {
  const [classes, setClasses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [students, setStudents] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Load initial classes and templates
  useEffect(() => {
    const fetchInitial = async () => {
      setLoadingInitial(true);
      try {
        const [classesData, templatesData] = await Promise.all([
          api.getClasses(),
          api.getTemplates(),
        ]);
        setClasses(classesData);
        setTemplates(templatesData);

        // Auto-select first class if available
        if (classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
        }

        // Auto-select hello_world if available
        const helloWorldTpl = templatesData.find((t) => t.name === 'hello_world' && t.status === 'ACTIVE');
        if (helloWorldTpl) {
          setSelectedTemplateId(helloWorldTpl.id);
        } else if (templatesData.length > 0) {
          setSelectedTemplateId(templatesData[0].id);
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Failed to load metadata',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchInitial();
  }, []);

  // Fetch students whenever selectedClassId changes
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setSelectedStudentIds([]);
      return;
    }

    const fetchStudentsInClass = async () => {
      setLoadingStudents(true);
      try {
        const data = await api.getStudents({ class_id: Number(selectedClassId) });
        setStudents(data);
        // By default, select all opted-in students
        const optedInIds = data.filter((s) => s.whatsapp_opt_in).map((s) => s.id);
        setSelectedStudentIds(optedInIds);
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Failed to load class students',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudentsInClass();
  }, [selectedClassId]);

  const selectedTemplate = templates.find((t) => t.id === Number(selectedTemplateId));
  const isTemplateActive = selectedTemplate?.status === 'ACTIVE';

  const optedInCount = students.filter((s) => s.whatsapp_opt_in).length;
  const optedOutCount = students.filter((s) => !s.whatsapp_opt_in).length;
  const selectedCount = selectedStudentIds.length;

  const handleToggleStudent = (studentId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAllOptedIn = () => {
    const optedInIds = students.filter((s) => s.whatsapp_opt_in).map((s) => s.id);
    if (selectedStudentIds.length === optedInIds.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(optedInIds);
    }
  };

  const handleSendClick = () => {
    if (!selectedClassId) {
      showToast({ type: 'warning', title: 'Please select a class' });
      return;
    }
    if (!selectedTemplateId) {
      showToast({ type: 'warning', title: 'Please select a template' });
      return;
    }
    if (!isTemplateActive) {
      showToast({
        type: 'error',
        title: 'Cannot send unapproved template',
        message: 'This template is PENDING or REJECTED. Meta requires template approval before broadcasting.',
      });
      return;
    }
    if (selectedCount === 0) {
      showToast({ type: 'warning', title: 'Please select at least one recipient' });
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirmModal(false);
    setIsSending(true);

    try {
      const campaign = await api.createCampaign({
        class_id: Number(selectedClassId),
        template_id: Number(selectedTemplateId),
        student_ids: selectedStudentIds,
      });

      showToast({
        type: 'success',
        title: 'Broadcast Campaign Initiated!',
        message: `Dispatched campaign #${campaign.id} to ${campaign.total_recipients} students concurrently.`,
      });

      // Redirect immediately to Campaign detail page to view live status
      onNavigateToCampaign(campaign.id);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to initiate campaign',
        message: err instanceof Error ? err.message : 'Meta API or server error occurred.',
      });
      setIsSending(false);
    }
  };

  if (loadingInitial) {
    return <LoadingSpinner message="Preparing WhatsApp messaging interface..." />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Title & Description */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Send className="w-6 h-6 text-emerald-600" />
          <span>Send WhatsApp Broadcast</span>
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Broadcast individual, official WhatsApp messages to parents of selected classes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Configuration */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Class Selection */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>1. Select Target Class</span>
              </label>
              {selectedClassId && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  {students.length} Total Enrolled
                </span>
              )}
            </div>

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium transition-all shadow-xs"
            >
              <option value="" disabled>-- Choose a Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.section ? `(Section ${c.section})` : ''} - {c.student_count} Students
                </option>
              ))}
            </select>
          </div>

          {/* 2. Template Selection */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-600" />
                <span>2. Select WhatsApp Template</span>
              </label>
              {selectedTemplate && <StatusBadge status={selectedTemplate.status} />}
            </div>

            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium transition-all shadow-xs"
            >
              <option value="" disabled>-- Choose a Template --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} [{t.status}] - {t.category} ({t.language})
                </option>
              ))}
            </select>

            {/* Template Status Warning Alert if Pending */}
            {selectedTemplate && !isTemplateActive && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h6 className="font-bold text-amber-900">Template Pending Meta Approval</h6>
                  <p className="mt-0.5 leading-relaxed text-amber-800/90">
                    Template <strong className="font-mono text-slate-900">{selectedTemplate.name}</strong> has not yet been approved by Meta. To send messages right now, select the pre-approved <strong className="font-mono text-emerald-700">hello_world</strong> template.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 3. Recipient Student Selection Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span>3. Class Recipients Checklist</span>
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Only opted-in parents receive individual messages.
                </p>
              </div>

              {optedInCount > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllOptedIn}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  {selectedStudentIds.length === optedInCount ? 'Deselect All' : 'Select All Opted-In'}
                </button>
              )}
            </div>

            {loadingStudents ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            ) : students.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center italic">
                {selectedClassId ? 'No students enrolled in this class.' : 'Select a class to preview recipients.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {students.map((student) => {
                  const isOptedIn = student.whatsapp_opt_in;
                  const isSelected = selectedStudentIds.includes(student.id);

                  return (
                    <div
                      key={student.id}
                      onClick={() => isOptedIn && handleToggleStudent(student.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        !isOptedIn
                          ? 'bg-slate-50/50 border-slate-200/50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-50/80 border-emerald-300 cursor-pointer shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-slate-400">
                          {!isOptedIn ? (
                            <Square className="w-4 h-4 text-slate-300" />
                          ) : isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{student.student_name}</p>
                          <p className="text-xs text-slate-500">
                            {student.parent_name ? `Parent: ${student.parent_name}` : 'Parent'} &bull; +{student.whatsapp_number}
                          </p>
                        </div>
                      </div>

                      <div>
                        {isOptedIn ? (
                          <span className="text-[11px] font-semibold text-emerald-700 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                            Opted In
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-rose-700 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200">
                            Opted Out (Skipped)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Message Preview & Send Action */}
        <div className="lg:col-span-5 space-y-6">
          {/* Realistic WhatsApp Preview */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp Message Preview</span>
            </h4>

            {/* Simulated Phone Screen with Realistic WhatsApp light aesthetic */}
            <div className="rounded-2xl whatsapp-chat-bg border border-slate-300 p-4 shadow-md relative overflow-hidden">
              {/* WhatsApp Chat Header */}
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-300/80 bg-[#008069] text-white -mx-4 -mt-4 p-3.5 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">
                  ABC
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white">ABC Public School</h5>
                  <p className="text-[10px] text-emerald-100">Official WhatsApp Business Account</p>
                </div>
              </div>

              {/* Chat Message Bubble */}
              <div className="whatsapp-bubble-received p-3.5 max-w-[90%] text-slate-900 text-xs shadow-sm space-y-2 border border-slate-200/50">
                {selectedTemplate?.name === 'hello_world' ? (
                  <>
                    <p className="font-bold text-slate-900 text-sm">Hello World</p>
                    <p className="text-slate-800 leading-relaxed font-sans">
                      Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.
                    </p>
                  </>
                ) : (
                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                    {selectedTemplate?.body_preview || 'No preview available for this template.'}
                  </p>
                )}

                <div className="flex justify-end items-center gap-1 text-[10px] text-slate-400 mt-2">
                  <span>10:30 AM</span>
                  <CheckCircle2 className="w-3 h-3 text-sky-500" />
                </div>
              </div>

              <div className="mt-3 text-center">
                <span className="text-[10px] text-slate-600 font-mono bg-white/80 px-2 py-0.5 rounded-full border border-slate-300/60 shadow-xs">
                  Meta Template: {selectedTemplate?.name || 'none'}
                </span>
              </div>
            </div>
          </div>

          {/* Broadcast Summary Card & CTA */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h4 className="text-sm font-bold text-slate-900">Broadcast Summary</h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Target Class:</span>
                <span className="font-semibold text-slate-900">
                  {classes.find((c) => c.id === Number(selectedClassId))?.name || 'None'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Selected Template:</span>
                <span className="font-mono text-emerald-700 font-semibold">
                  {selectedTemplate?.name || 'None'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Opted-in Recipients:</span>
                <span className="font-semibold text-emerald-700">{selectedCount} Students</span>
              </div>
              {optedOutCount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Opted-out (Excluded):</span>
                  <span className="font-semibold text-rose-600">{optedOutCount} Students</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSendClick}
                disabled={!isTemplateActive || selectedCount === 0 || isSending}
                className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                  !isTemplateActive || selectedCount === 0 || isSending
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-md shadow-emerald-600/20'
                }`}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Broadcast...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send to {selectedCount} Recipient{selectedCount === 1 ? '' : 's'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm WhatsApp Broadcast"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <p className="text-slate-600">
              You are about to broadcast individual WhatsApp messages via Meta Cloud API to:
            </p>
            <p className="text-base font-bold text-emerald-700">
              {selectedCount} student recipient{selectedCount === 1 ? '' : 's'} in{' '}
              {classes.find((c) => c.id === Number(selectedClassId))?.name}
            </p>
            <p className="text-slate-500 pt-2 border-t border-slate-200">
              Template: <span className="font-mono text-slate-900 font-semibold">{selectedTemplate?.name}</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
            <ShieldAlert className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <p>
              Each parent will receive an <strong>individual 1-to-1 WhatsApp message</strong>. This will NOT create a group.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSend}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
            >
              Confirm &amp; Send Now
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
