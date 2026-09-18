import React, { useEffect, useState } from 'react';
import {
  Send,
  Users,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  CheckSquare,
  Square,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { ClassItem, MessageTemplate, StudentItem } from '../types';
import { StatusBadge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface SendMessagePageProps {
  onNavigateToCampaign: (campaignId: number) => void;
  showToast: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string }) => void;
}

export const SendMessagePage: React.FC<SendMessagePageProps> = ({
  onNavigateToCampaign,
  showToast,
}) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

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

  const handleToggleStudent = (studentId: number) => {
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
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
          <Send className="w-6 h-6 text-emerald-400" />
          <span>Send WhatsApp Broadcast</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Broadcast individual, official WhatsApp messages to parents of selected classes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Configuration */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Class Selection */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>1. Select Target Class</span>
              </label>
              {selectedClassId && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                  {students.length} Total Enrolled
                </span>
              )}
            </div>

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
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
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>2. Select WhatsApp Template</span>
              </label>
              {selectedTemplate && <StatusBadge status={selectedTemplate.status} />}
            </div>

            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
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
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h6 className="font-bold text-amber-300">Template Pending Meta Approval</h6>
                  <p className="mt-0.5 leading-relaxed text-amber-200/90">
                    Template <strong className="font-mono text-white">{selectedTemplate.name}</strong> has not yet been approved by Meta. To send messages right now, select the pre-approved <strong className="font-mono text-emerald-300">hello_world</strong> template.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 3. Recipient Student Selection Table */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>3. Class Recipients Checklist</span>
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Only opted-in parents receive individual messages.
                </p>
              </div>

              {optedInCount > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllOptedIn}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-slate-800/80 border border-slate-700 transition-colors"
                >
                  {selectedStudentIds.length === optedInCount ? 'Deselect All' : 'Select All Opted-In'}
                </button>
              )}
            </div>

            {loadingStudents ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
            ) : students.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center italic">
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
                          ? 'bg-slate-900/40 border-slate-800/40 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-950/30 border-emerald-500/40 cursor-pointer'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-slate-400">
                          {!isOptedIn ? (
                            <Square className="w-4 h-4 text-slate-600" />
                          ) : isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{student.student_name}</p>
                          <p className="text-xs text-slate-400">
                            {student.parent_name ? `Parent: ${student.parent_name}` : 'Parent'} &bull; +{student.whatsapp_number}
                          </p>
                        </div>
                      </div>

                      <div>
                        {isOptedIn ? (
                          <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            Opted In
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
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
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp Message Preview</span>
            </h4>

            {/* Simulated Phone Screen */}
            <div className="rounded-2xl bg-[#0b141a] border border-slate-800 p-4 shadow-2xl relative overflow-hidden">
              {/* WhatsApp Chat Header */}
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-800/80">
                <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold text-xs">
                  ABC
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">ABC Public School</h5>
                  <p className="text-[10px] text-emerald-400">Official WhatsApp Business Account</p>
                </div>
              </div>

              {/* Chat Message Bubble */}
              <div className="whatsapp-bubble-received p-4 max-w-[90%] text-slate-100 text-xs shadow-md space-y-2">
                {selectedTemplate?.name === 'hello_world' ? (
                  <>
                    <p className="font-bold text-white text-sm">Hello World</p>
                    <p className="text-slate-200 leading-relaxed">
                      Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.
                    </p>
                  </>
                ) : (
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                    {selectedTemplate?.body_preview || 'No preview available for this template.'}
                  </p>
                )}

                <div className="flex justify-end items-center gap-1 text-[10px] text-slate-400 mt-2">
                  <span>10:30 AM</span>
                  <CheckCircle2 className="w-3 h-3 text-sky-400" />
                </div>
              </div>

              <div className="mt-3 text-center">
                <span className="text-[10px] text-slate-500 font-mono">
                  Meta Template: {selectedTemplate?.name || 'none'}
                </span>
              </div>
            </div>
          </div>

          {/* Broadcast Summary Card & CTA */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5 bg-gradient-to-b from-slate-900/80 to-slate-950/90">
            <h4 className="text-sm font-bold text-white">Broadcast Summary</h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Target Class:</span>
                <span className="font-semibold text-white">
                  {classes.find((c) => c.id === Number(selectedClassId))?.name || 'None'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Selected Template:</span>
                <span className="font-mono text-emerald-300">
                  {selectedTemplate?.name || 'None'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Opted-in Recipients:</span>
                <span className="font-semibold text-emerald-400">{selectedCount} Students</span>
              </div>
              {optedOutCount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Opted-out (Excluded):</span>
                  <span className="font-semibold text-rose-400">{optedOutCount} Students</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSendClick}
                disabled={!isTemplateActive || selectedCount === 0 || isSending}
                className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white shadow-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                  !isTemplateActive || selectedCount === 0 || isSending
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950/80 hover:shadow-emerald-900 active:scale-[0.99]'
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
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
            <p className="text-slate-300">
              You are about to broadcast individual WhatsApp messages via Meta Cloud API to:
            </p>
            <p className="text-base font-bold text-emerald-400">
              {selectedCount} student recipient{selectedCount === 1 ? '' : 's'} in{' '}
              {classes.find((c) => c.id === Number(selectedClassId))?.name}
            </p>
            <p className="text-slate-400 pt-2 border-t border-slate-800">
              Template: <span className="font-mono text-white font-semibold">{selectedTemplate?.name}</span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-200">
            <ShieldAlert className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p>
              Each parent will receive an <strong>individual 1-to-1 WhatsApp message</strong>. This will NOT create a group.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSend}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950 transition-all"
            >
              Confirm &amp; Send Now
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
