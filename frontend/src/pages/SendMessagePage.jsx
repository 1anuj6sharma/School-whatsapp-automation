import React, { useEffect, useState, useMemo } from 'react';
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
  Sliders,
  Edit3,
  RotateCcw,
  Sparkles,
  Eye,
  Image as ImageIcon,
  Upload,
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

  // Common Template Variables state
  const [templateVariables, setTemplateVariables] = useState({});

  // Header Image for image templates
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);

  // Active student for Live WhatsApp Preview
  const [previewStudentId, setPreviewStudentId] = useState(null);

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

        // Auto-select attendance template or hello_world
        const attTpl = templatesData.find((t) => t.name === 'student_attendance' && (t.status === 'ACTIVE' || t.status === 'APPROVED'));
        const helloWorldTpl = templatesData.find((t) => t.name === 'hello_world' && (t.status === 'ACTIVE' || t.status === 'APPROVED'));
        const activeTpl = attTpl || helloWorldTpl || templatesData.find((t) => t.status === 'ACTIVE' || t.status === 'APPROVED');
        
        if (activeTpl) {
          setSelectedTemplateId(activeTpl.id);
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
      setPreviewStudentId(null);
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
        if (data.length > 0) {
          setPreviewStudentId(data[0].id);
        }
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
  const isTemplateActive = selectedTemplate?.status === 'ACTIVE' || selectedTemplate?.status === 'APPROVED';

  // Detect {{1}}, {{2}} placeholders from the template body preview
  const detectedVariables = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.body_preview) return [];
    const matches = selectedTemplate.body_preview.match(/\{\{(\d+)\}\}/g) || [];
    const unique = Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, ''))));
    return unique.sort((a, b) => Number(a) - Number(b));
  }, [selectedTemplate]);

  // When selected template changes, set convenient defaults for variables & header image
  useEffect(() => {
    if (selectedTemplate?.sample_image_url) {
      setHeaderImageUrl(selectedTemplate.sample_image_url);
    } else {
      setHeaderImageUrl('');
    }

    if (detectedVariables.length > 0) {
      const initialVars = {};
      const tName = selectedTemplate?.name || '';

      detectedVariables.forEach((num) => {
        if (tName === 'student_attendance') {
          if (num === '1') initialVars[num] = '{Parent Name}';
          else if (num === '2') initialVars[num] = '{Student Name}';
          else if (num === '3') initialVars[num] = 'Present';
          else if (num === '4') initialVars[num] = 'today';
          else initialVars[num] = `Value ${num}`;
        } else {
          if (num === '1') initialVars[num] = '{Parent Name}';
          else if (num === '2') initialVars[num] = '{Student Name}';
          else initialVars[num] = '';
        }
      });
      setTemplateVariables(initialVars);
    } else {
      setTemplateVariables({});
    }
  }, [selectedTemplateId, detectedVariables.length]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const objectUrl = URL.createObjectURL(file);
      setLocalPreviewUrl(objectUrl);
    } catch (_) {}

    setImageUploading(true);
    try {
      const res = await api.uploadMedia(file);
      if (res.url) {
        setHeaderImageUrl(res.url);
        if (showToast) {
          showToast({
            type: 'success',
            title: 'Image Uploaded Successfully',
            message: 'Image attached to WhatsApp broadcast.',
          });
        }
      }
    } catch (err) {
      if (showToast) {
        showToast({
          type: 'error',
          title: 'Image Upload Failed',
          message: err instanceof Error ? err.message : 'Could not upload image.',
        });
      }
    } finally {
      setImageUploading(false);
    }
  };

  const handleVariableChange = (varKey, val) => {
    setTemplateVariables((prev) => ({
      ...prev,
      [varKey]: val,
    }));
  };

  const handleResetVariables = () => {
    const cleared = {};
    detectedVariables.forEach((num) => {
      cleared[num] = '';
    });
    setTemplateVariables(cleared);
  };

  // Resolve variable value for preview
  const resolvePreviewVariable = (varNum, student) => {
    const val = templateVariables[varNum] || '';
    if (!val) return `{{${varNum}}}`;

    let resolved = val;
    const parentName = student?.parent_name || 'Parent';
    const studentName = student?.student_name || 'Student';

    // Only Name and Parent Name are dynamic
    resolved = resolved.replaceAll('{Parent Name}', parentName);
    resolved = resolved.replaceAll('{{Parent Name}}', parentName);
    resolved = resolved.replaceAll('{parent_name}', parentName);
    resolved = resolved.replaceAll('{{parent_name}}', parentName);

    resolved = resolved.replaceAll('{Student Name}', studentName);
    resolved = resolved.replaceAll('{{Student Name}}', studentName);
    resolved = resolved.replaceAll('{student_name}', studentName);
    resolved = resolved.replaceAll('{{student_name}}', studentName);

    return resolved;
  };

  // Selected student for preview
  const previewStudent = students.find((s) => s.id === previewStudentId) || students[0];

  // Render live preview text
  const renderedPreviewText = useMemo(() => {
    if (!selectedTemplate) return 'No template selected.';
    if (selectedTemplate.name === 'hello_world') {
      return `Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.`;
    }

    let text = selectedTemplate.body_preview || '';
    detectedVariables.forEach((num) => {
      const replacement = resolvePreviewVariable(num, previewStudent);
      text = text.replaceAll(`{{${num}}}`, replacement);
    });
    return text;
  }, [selectedTemplate, detectedVariables, templateVariables, previewStudent]);

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
    if (selectedTemplate?.header_type === 'IMAGE' && !headerImageUrl.trim()) {
      showToast({
        type: 'warning',
        title: 'Image Required',
        message: 'This template requires a header image. Please upload an image or provide an Image URL.',
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

    // Prepare template parameters array
    const dynamicParams = detectedVariables.map((v) => {
      const val = templateVariables[v]?.trim();
      return val || `Sample_${v}`;
    });

    try {
      const campaign = await api.createCampaign({
        class_id: Number(selectedClassId),
        template_id: Number(selectedTemplateId),
        student_ids: selectedStudentIds,
        dynamic_parameters: dynamicParams.length > 0 ? dynamicParams : undefined,
        header_image_url: headerImageUrl ? headerImageUrl.trim() : undefined,
      });

      showToast({
        type: 'success',
        title: 'Broadcast Campaign Initiated!',
        message: `Dispatched broadcast to ${campaign.total_recipients} students with dynamic student & parent names.`,
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
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Send className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
          <span>Send WhatsApp Broadcast</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Broadcast official WhatsApp messages with personalized student &amp; parent names and custom common message content.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column: Form & Configuration */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Class Selection */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>1. Select Target Class</span>
              </label>
              {selectedClassId && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold self-start sm:self-auto">
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
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-600" />
                <span>2. Select WhatsApp Template</span>
              </label>
              {selectedTemplate && <div className="self-start sm:self-auto"><StatusBadge status={selectedTemplate.status} /></div>}
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
                    Template <strong className="font-mono text-slate-900">{selectedTemplate.name}</strong> has status <span className="font-bold uppercase">{selectedTemplate.status}</span>. Only <strong className="text-emerald-700">ACTIVE / Approved</strong> templates can be broadcasted to parents.
                  </p>
                </div>
              </div>
            )}

            {/* Header Image Attachment Section for Image Templates */}
            {selectedTemplate && (selectedTemplate.header_type === 'IMAGE' || selectedTemplate.category === 'MARKETING') && (
              <div className="p-4 rounded-xl bg-purple-50/80 border border-purple-200 text-xs space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-purple-950 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>Header Image Attachment {selectedTemplate.header_type === 'IMAGE' ? <span className="text-rose-600">*</span> : '(Optional)'}</span>
                  </label>
                  <span className="text-[10px] text-purple-700 font-semibold bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                    Media Header
                  </span>
                </div>
                <p className="text-[11px] text-purple-900/80 leading-relaxed">
                  Provide a public image URL or upload an image file (JPEG/PNG max 5MB). This image will be sent at the top of each student&apos;s WhatsApp message.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={headerImageUrl}
                    onChange={(e) => setHeaderImageUrl(e.target.value)}
                    placeholder="https://example.com/school-sports-day.png or click upload"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-xs"
                  />
                  <label className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0 active:scale-95">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{imageUploading ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={imageUploading}
                      className="hidden"
                    />
                  </label>
                </div>

                {headerImageUrl && (
                  <div className="flex items-center gap-2 text-[11px] text-purple-800 font-medium bg-white/80 p-2 rounded-lg border border-purple-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Active Image URL: {headerImageUrl}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Recipient Student Selection Table */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span>3. Class Recipients Checklist</span>
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click a student to preview their personalized message.
                </p>
              </div>

              {optedInCount > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllOptedIn}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors self-start sm:self-auto"
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
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {students.map((student) => {
                  const isOptedIn = student.whatsapp_opt_in;
                  const isSelected = selectedStudentIds.includes(student.id);
                  const isBeingPreviewed = previewStudentId === student.id;

                  return (
                    <div
                      key={student.id}
                      onClick={() => {
                        if (isOptedIn) {
                          handleToggleStudent(student.id);
                          setPreviewStudentId(student.id);
                        }
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        !isOptedIn
                          ? 'bg-slate-50/50 border-slate-200/50 opacity-60 cursor-not-allowed'
                          : isBeingPreviewed
                          ? 'bg-emerald-50/90 border-emerald-400 shadow-xs ring-1 ring-emerald-400/50'
                          : isSelected
                          ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
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
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{student.student_name}</p>
                            {isBeingPreviewed && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-1">
                                <Eye className="w-2.5 h-2.5" />
                                Previewing
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            Parent: <strong className="text-slate-700">{student.parent_name || 'Parent'}</strong> &bull; +{student.whatsapp_number}
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

        {/* Right Column: Template Variables Editor & Message Preview */}
        <div className="lg:col-span-5 space-y-6">
          {/* Dynamic Template Variables Box */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <span>Template Variables &amp; Content</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Use <strong className="text-emerald-700">&#123;Parent Name&#125;</strong> or <strong className="text-emerald-700">&#123;Student Name&#125;</strong> for dynamic names, or type common text for all students.
                </p>
              </div>

              {detectedVariables.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetVariables}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded transition-colors self-start sm:self-auto"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {detectedVariables.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
                <span>This template has no dynamic <code className="font-mono text-slate-800">&#123;&#123;1&#125;&#125;</code> placeholders.</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Ready as-is
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {detectedVariables.map((num) => {
                  const currentValue = templateVariables[num] || '';
                  const isDynamicName = currentValue === '{Parent Name}' || currentValue === '{Student Name}';

                  return (
                    <div key={num} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <label className="text-xs font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Placeholder &#123;&#123;{num}&#125;&#125;:</span>
                        </label>
                        {isDynamicName ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Dynamic (Changes per Student)
                          </span>
                        ) : currentValue ? (
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                            Common Text (Same for All)
                          </span>
                        ) : null}
                      </div>

                      {/* Dynamic Tag Quick Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleVariableChange(num, '{Parent Name}')}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                            currentValue === '{Parent Name}'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          + &#123;Parent Name&#125;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVariableChange(num, '{Student Name}')}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                            currentValue === '{Student Name}'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          + &#123;Student Name&#125;
                        </button>
                      </div>

                      {/* Value Input (Common or Custom) */}
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleVariableChange(num, e.target.value)}
                        placeholder={`e.g. Present, today, or {Student Name}`}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-sans shadow-xs transition-all"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Realistic WhatsApp Preview with Student Switcher */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Live WhatsApp Message Preview</span>
              </h4>

              {/* Student preview selector */}
              {students.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-medium">Previewing:</span>
                  <select
                    value={previewStudent?.id || ''}
                    onChange={(e) => setPreviewStudentId(Number(e.target.value))}
                    className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg px-2 py-1 focus:outline-none max-w-[180px] sm:max-w-xs truncate"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.student_name} (Parent: {s.parent_name || 'Parent'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Simulated Phone Screen with Realistic WhatsApp aesthetic */}
            <div className="rounded-2xl whatsapp-chat-bg border border-slate-300 p-4 shadow-md relative overflow-hidden">
              {/* WhatsApp Chat Header */}
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-300/80 bg-[#008069] text-white -mx-4 -mt-4 p-3.5 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
                  ABC
                </div>
                <div className="min-w-0">
                  <h5 className="text-xs font-bold text-white truncate">ABC Public School</h5>
                  <p className="text-[10px] text-emerald-100 truncate">
                    To: {previewStudent?.parent_name || 'Parent'} (+{previewStudent?.whatsapp_number || '91...'})
                  </p>
                </div>
              </div>

              {/* Chat Message Bubble */}
              <div className="whatsapp-bubble-received p-3.5 max-w-[94%] text-slate-900 text-xs shadow-sm space-y-2.5 border border-slate-200/50 font-sans">
                {/* Image Header Preview if image template or header image attached */}
                {(selectedTemplate?.header_type === 'IMAGE' || headerImageUrl || localPreviewUrl) && (
                  <div className="w-full h-44 rounded-xl bg-gradient-to-br from-purple-50 to-slate-100 border border-purple-200 overflow-hidden flex flex-col items-center justify-center text-slate-400 gap-1.5 shadow-xs relative">
                    {(localPreviewUrl || headerImageUrl) ? (
                      <img
                        src={localPreviewUrl || headerImageUrl}
                        alt="Broadcast header"
                        className="w-full h-full object-cover rounded-xl"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-purple-700 py-4 px-3 text-center">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-xs">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-purple-900">Image Header Template</span>
                        <span className="text-[10px] text-purple-600 font-medium">Attach an image in the header panel above</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Text Header Preview */}
                {selectedTemplate?.header_type === 'TEXT' && selectedTemplate?.header_text && (
                  <p className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1">
                    {selectedTemplate.header_text}
                  </p>
                )}

                <div>
                  {selectedTemplate?.name === 'hello_world' ? (
                    <>
                      <p className="font-bold text-slate-900 text-sm">Hello World</p>
                      <p className="text-slate-800 leading-relaxed font-sans mt-1">
                        Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-900 whitespace-pre-wrap leading-relaxed font-sans font-normal">
                      {renderedPreviewText}
                    </p>
                  )}
                </div>

                <div className="flex justify-end items-center gap-1 text-[10px] text-slate-400 mt-2">
                  <span>10:30 AM</span>
                  <CheckCircle2 className="w-3 h-3 text-sky-500" />
                </div>
              </div>

              <div className="mt-3 text-center">
                <span className="text-[10px] text-slate-600 font-mono bg-white/85 px-2.5 py-0.5 rounded-full border border-slate-300/70 shadow-xs inline-block truncate max-w-full">
                  Showing resolved text for: <strong className="text-slate-900">{previewStudent?.student_name || 'Student'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Broadcast Summary Card & CTA */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
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
              {detectedVariables.length > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Variables:</span>
                  <span className="font-semibold text-slate-800">
                    {detectedVariables.map((v) => templateVariables[v] || `[{{${v}}}]`).join(', ')}
                  </span>
                </div>
              )}
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
                    <span>Personalizing &amp; Sending Broadcast...</span>
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
            {detectedVariables.length > 0 && (
              <p className="text-slate-600">
                Variables: <span className="font-medium text-slate-900">{detectedVariables.map((v) => templateVariables[v] || `{{${v}}}`).join(', ')}</span>
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
            <ShieldAlert className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <p>
              Each parent will receive an <strong>individual 1-to-1 WhatsApp message</strong>.
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
