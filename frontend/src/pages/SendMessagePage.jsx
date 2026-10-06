import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Receipt,
  Megaphone,
  Mail,
  IndianRupee,
  DollarSign,
  Info,
  Search,
  Check,
  ChevronRight,
  Layers,
  Save,
  BookmarkCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';

// Smart auto-inferrer for template variables based on text context and school workflows
const inferVariablesFromTemplate = (template) => {
  if (!template || !template.body_preview) return {};
  const body = template.body_preview;
  const lowerBody = body.toLowerCase();
  const lowerName = (template.name || '').toLowerCase();
  const matches = body.match(/\{\{(\d+)\}\}/g) || [];
  const uniqueNums = Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, '')))).sort((a, b) => Number(a) - Number(b));

  const isFeeContext = lowerName.includes('fee') || lowerName.includes('due') || lowerBody.includes('fee') || lowerBody.includes('due') || lowerBody.includes('amount') || lowerBody.includes('balance');
  const isAttendanceContext = lowerName.includes('attendance') || lowerName.includes('absent') || lowerBody.includes('attendance') || lowerBody.includes('absent');

  const result = {};
  uniqueNums.forEach((num) => {
    const placeholderStr = `{{${num}}}`;
    const idx = lowerBody.indexOf(placeholderStr);
    const startPos = Math.max(0, idx - 60);
    const endPos = Math.min(lowerBody.length, idx + placeholderStr.length + 60);
    const window = lowerBody.slice(startPos, endPos);
    const windowBefore = lowerBody.slice(startPos, idx);

    // 1. Fee / Amount
    if (['fee', 'fees', 'amount', 'balance', '₹', 'rs', 'inr', 'rupees', 'payable', 'installment', 'dues'].some((k) => window.includes(k)) && !['due date', 'by date', 'last date', 'deadline'].some((k) => window.includes(k))) {
      result[num] = '{Fees Due}';
      return;
    }
    // 2. Due Date
    if (['due date', 'by date', 'last date', 'deadline', 'pay by', 'valid till', 'on or before', 'before date'].some((k) => window.includes(k)) || ((window.includes('due on') || windowBefore.includes('by')) && isFeeContext)) {
      result[num] = '{Due Date}';
      return;
    }
    // 3. Attendance
    if (['attendance', 'absent', 'present', 'marked'].some((k) => window.includes(k))) {
      result[num] = '{Attendance}';
      return;
    }
    // 4. Class / Grade
    if (['class', 'grade', 'standard', 'sec', 'section', 'division'].some((k) => window.includes(k))) {
      result[num] = '{Class Name}';
      return;
    }
    // 5. Parent Name
    if (['parent', 'guardian', 'father', 'mother', 'mr.', 'mrs.', 'shri', 'smt', 'dear parent'].some((k) => window.includes(k))) {
      result[num] = '{Parent Name}';
      return;
    }
    // 6. Student Name
    if (['student', 'child', 'ward', 'kid', 'scholar', 'roll', 'dear student', 'name of'].some((k) => window.includes(k))) {
      result[num] = '{Student Name}';
      return;
    }
    // 7. School Name
    if (['school', 'academy', 'institute', 'vidyalaya', 'institution', 'principal'].some((k) => window.includes(k))) {
      result[num] = '{School Name}';
      return;
    }
    // 8. Exam Name / Date
    if (['exam', 'test', 'assessment'].some((k) => window.includes(k))) {
      result[num] = ['date', 'schedule', 'on'].some((k) => window.includes(k)) ? '{Exam Date}' : '{Exam Name}';
      return;
    }

    // Positional fallbacks
    if (num === '1') {
      result[num] = (lowerBody.includes('dear parent') || isFeeContext) ? '{Parent Name}' : '{Student Name}';
    } else if (num === '2') {
      result[num] = result['1'] === '{Parent Name}' ? '{Student Name}' : (isFeeContext ? '{Fees Due}' : '{Student Name}');
    } else if (num === '3') {
      result[num] = isFeeContext ? (result['2'] !== '{Fees Due}' ? '{Fees Due}' : '{Due Date}') : (isAttendanceContext ? '{Attendance}' : '{Class Name}');
    } else if (num === '4') {
      result[num] = '{Due Date}';
    } else {
      result[num] = `Value ${num}`;
    }
  });

  return result;
};

// Helper function to filter templates strictly based on active workflow
const filterTemplatesForWorkflow = (workflow, allTemplates) => {
  if (!allTemplates || allTemplates.length === 0) return [];

  const isTestOrSystemTemplate = (t) => {
    const n = (t.name || '').toLowerCase();
    return (
      n.includes('hello_world') ||
      n.includes('integration_test') ||
      n.includes('test_template') ||
      n.startsWith('3p_')
    );
  };

  const validTemplates = allTemplates.filter((t) => {
    const st = (t.status || '').toUpperCase();
    return (
      !['PENDING_DELETION', 'ARCHIVED', 'DELETED'].includes(st) &&
      !isTestOrSystemTemplate(t)
    );
  });

  if (workflow === 'FEES') {
    const feeKeywords = [
      'fee', 'fees', 'due', 'dues', 'payment', 'tuition',
      'receipt', 'invoice', 'installment', 'arrear', 'pending_fee', 'balance'
    ];

    return validTemplates.filter((t) => {
      const n = (t.name || '').toLowerCase();
      const b = (t.body_preview || '').toLowerCase();
      return feeKeywords.some((k) => n.includes(k) || b.includes(k));
    });
  }

  if (workflow === 'ANNOUNCEMENT') {
    const isFeeTemplate = (t) => {
      const n = (t.name || '').toLowerCase();
      return n.includes('fee') || n.includes('due') || n.includes('tuition') || n.includes('installment');
    };

    const isAttendanceTemplate = (t) => {
      const n = (t.name || '').toLowerCase();
      return n.includes('attendance') || n.includes('absent') || n.includes('present');
    };

    const annKeywords = [
      'announc', 'notice', 'circular', 'invite', 'function',
      'event', 'holiday', 'celebrat', 'annual', 'ptm',
      'sports', 'vacation', 'ceremony', 'school_info', 'admission',
      'meet', 'exam', 'test_schedul', 'session', 'activity', 'greeting',
      'alert', 'info', 'news', 'update', 'schedule'
    ];

    return validTemplates.filter((t) => {
      if (isFeeTemplate(t) || isAttendanceTemplate(t)) return false;
      const n = (t.name || '').toLowerCase();
      const b = (t.body_preview || '').toLowerCase();
      return annKeywords.some((k) => n.includes(k) || b.includes(k));
    });
  }

  // NORMAL Workflow: includes all valid templates
  return validTemplates;
};

export const SendMessagePage = ({
  onNavigateToCampaign,
  showToast,
  initialWorkflow = 'FEES',
  initialStudentIds = null,
  initialClassIds = null,
}) => {
  // Workflow Tab: 'FEES' | 'ANNOUNCEMENT' | 'NORMAL' (Default: 'FEES')
  const [activeWorkflow, setActiveWorkflow] = useState(initialWorkflow || 'FEES');
  const initialAppliedRef = React.useRef(false);

  const [classes, setClasses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [students, setStudents] = useState([]);

  // Multi-class selection state: array of class IDs (numbers)
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Search filter inside student checklist
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

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
        const validTemplates = (templatesData || []).filter(
          (t) =>
            !['PENDING_DELETION', 'ARCHIVED', 'DELETED'].includes((t.status || '').toUpperCase()) &&
            (t.name || '').toLowerCase() !== 'hello_world'
        );
        setClasses(classesData);
        setTemplates(validTemplates);

        const startWf = initialWorkflow || 'FEES';
        setActiveWorkflow(startWf);

        // Auto-select classes according to initialClassIds or workflow
        if (initialClassIds && Array.isArray(initialClassIds) && initialClassIds.length > 0) {
          setSelectedClassIds(initialClassIds);
        } else if (startWf === 'FEES' || startWf === 'ANNOUNCEMENT') {
          if (classesData.length > 0) {
            setSelectedClassIds(classesData.map((c) => c.id));
          }
        } else {
          if (classesData.length > 0) {
            setSelectedClassIds([classesData[0].id]);
          }
        }

        // Auto-select initial matching template
        const wfTpls = filterTemplatesForWorkflow(startWf, templatesData);
        let activeTpl = null;
        if (startWf === 'ANNOUNCEMENT') {
          activeTpl =
            wfTpls.find((t) => (t.status === 'ACTIVE' || t.status === 'APPROVED') && t.name.toLowerCase() === 'school_announcement') ||
            wfTpls.find((t) => (t.status === 'ACTIVE' || t.status === 'APPROVED') && t.name.toLowerCase().includes('announcement')) ||
            wfTpls.find((t) => t.status === 'ACTIVE' || t.status === 'APPROVED') ||
            wfTpls[0] ||
            templatesData[0];
        } else if (startWf === 'FEES') {
          activeTpl =
            wfTpls.find((t) => (t.status === 'ACTIVE' || t.status === 'APPROVED') && t.name.toLowerCase().includes('fee')) ||
            wfTpls.find((t) => t.status === 'ACTIVE' || t.status === 'APPROVED') ||
            wfTpls[0] ||
            templatesData[0];
        } else {
          activeTpl =
            wfTpls.find((t) => t.status === 'ACTIVE' || t.status === 'APPROVED') ||
            wfTpls[0] ||
            templatesData[0];
        }

        if (activeTpl) {
          setSelectedTemplateId(activeTpl.id);
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

  // Filter templates according to active workflow
  const availableTemplates = useMemo(() => {
    return filterTemplatesForWorkflow(activeWorkflow, templates);
  }, [templates, activeWorkflow]);

  // When active workflow changes, adjust class selection & default template immediately on single click
  const handleWorkflowChange = (workflow) => {
    setActiveWorkflow(workflow);

    if (workflow === 'FEES' || workflow === 'ANNOUNCEMENT') {
      // Auto-select ALL classes by default
      const allIds = classes.map((c) => c.id);
      setSelectedClassIds(allIds);
    } else {
      // Normal workflow: retain first class if none selected
      if (selectedClassIds.length === 0 && classes.length > 0) {
        setSelectedClassIds([classes[0].id]);
      }
    }

    // Immediately determine matching templates for the clicked workflow
    const workflowTemplates = filterTemplatesForWorkflow(workflow, templates);

    let matching = null;
    if (workflow === 'ANNOUNCEMENT') {
      // Prioritize school_announcement or standard text announcement template
      matching =
        workflowTemplates.find((t) => (t.status === 'ACTIVE' || t.status === 'APPROVED') && t.name.toLowerCase() === 'school_announcement') ||
        workflowTemplates.find((t) => (t.status === 'ACTIVE' || t.status === 'APPROVED') && t.name.toLowerCase().includes('announcement')) ||
        workflowTemplates.find((t) => t.status === 'ACTIVE' || t.status === 'APPROVED') ||
        workflowTemplates[0];
    } else if (workflow === 'FEES') {
      // Prioritize fee_reminder or fee template
      matching =
        workflowTemplates.find((t) => (t.status === 'ACTIVE' || t.status === 'APPROVED') && t.name.toLowerCase() === 'fee_reminder') ||
        workflowTemplates.find((t) => (t.status === 'ACTIVE' || t.status === 'APPROVED') && (t.name.toLowerCase().includes('fee') || t.name.toLowerCase().includes('due'))) ||
        workflowTemplates.find((t) => t.status === 'ACTIVE' || t.status === 'APPROVED') ||
        workflowTemplates[0];
    } else {
      // Normal workflow
      matching =
        workflowTemplates.find((t) => t.status === 'ACTIVE' || t.status === 'APPROVED') ||
        workflowTemplates[0];
    }

    if (matching) {
      setSelectedTemplateId(matching.id);
    }

    // Update student selection & preview based on the newly selected workflow
    let eligible = students;
    if (workflow === 'FEES') {
      eligible = students.filter((s) => Number(s.fees_due || 0) > 0);
    }
    const optedInIds = eligible.filter((s) => s.whatsapp_opt_in).map((s) => s.id);
    setSelectedStudentIds(optedInIds);
    if (eligible.length > 0) {
      setPreviewStudentId(eligible[0].id);
    } else if (students.length > 0) {
      setPreviewStudentId(students[0].id);
    } else {
      setPreviewStudentId(null);
    }
  };

  // Sync workflow if initialWorkflow prop changes dynamically while component is active
  useEffect(() => {
    if (initialWorkflow && templates.length > 0 && initialWorkflow !== activeWorkflow) {
      handleWorkflowChange(initialWorkflow);
    }
  }, [initialWorkflow]);

  // Fetch students whenever selectedClassIds change
  useEffect(() => {
    if (!selectedClassIds || selectedClassIds.length === 0) {
      setStudents([]);
      setSelectedStudentIds([]);
      setPreviewStudentId(null);
      return;
    }

    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const data = await api.getStudents({ class_ids: selectedClassIds });
        setStudents(data);

        let eligible = data;
        if (activeWorkflow === 'FEES') {
          eligible = data.filter((s) => Number(s.fees_due || 0) > 0);
        }

        // If initialStudentIds was provided from student list filter, apply it
        if (
          !initialAppliedRef.current &&
          initialStudentIds &&
          Array.isArray(initialStudentIds) &&
          initialStudentIds.length > 0
        ) {
          initialAppliedRef.current = true;
          const matchedIds = data
            .filter((s) => initialStudentIds.includes(s.id) && s.whatsapp_opt_in)
            .map((s) => s.id);
          setSelectedStudentIds(matchedIds);
          if (matchedIds.length > 0) {
            setPreviewStudentId(matchedIds[0]);
          } else if (data.length > 0) {
            setPreviewStudentId(data[0].id);
          } else {
            setPreviewStudentId(null);
          }
        } else {
          // By default, select all opted-in eligible students across selected classes
          const optedInIds = eligible.filter((s) => s.whatsapp_opt_in).map((s) => s.id);
          setSelectedStudentIds(optedInIds);
          if (eligible.length > 0) {
            setPreviewStudentId(eligible[0].id);
          } else if (data.length > 0) {
            setPreviewStudentId(data[0].id);
          } else {
            setPreviewStudentId(null);
          }
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

    fetchStudents();
  }, [selectedClassIds.join(',')]);

  const selectedTemplate = availableTemplates.find((t) => t.id === Number(selectedTemplateId)) || null;
  const isTemplateActive = selectedTemplate?.status === 'ACTIVE' || selectedTemplate?.status === 'APPROVED';

  // Strict check if template uses an Image header
  const isImageTemplate = Boolean(
    selectedTemplate && (
      selectedTemplate.header_type === 'IMAGE' ||
      (selectedTemplate.header_text && selectedTemplate.header_text.toLowerCase().includes('image')) ||
      (selectedTemplate.sample_image_url && selectedTemplate.sample_image_url.trim().length > 0)
    )
  );

  // Detect {{1}}, {{2}} placeholders from the template body preview
  const detectedVariables = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.body_preview) return [];
    const matches = selectedTemplate.body_preview.match(/\{\{(\d+)\}\}/g) || [];
    const unique = Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, ''))));
    return unique.sort((a, b) => Number(a) - Number(b));
  }, [selectedTemplate]);

  const [isSavingMappings, setIsSavingMappings] = useState(false);

  // When selected template changes, set convenient defaults for variables & header image
  useEffect(() => {
    if (selectedTemplate?.sample_image_url) {
      setHeaderImageUrl(selectedTemplate.sample_image_url);
    } else {
      setHeaderImageUrl('');
    }

    if (detectedVariables.length > 0) {
      const initialVars = {};
      const explicitMappings = selectedTemplate?.variable_mappings || {};
      const inferredMappings = inferVariablesFromTemplate(selectedTemplate);

      detectedVariables.forEach((num) => {
        // Priority 1: Explicit DB mapping saved previously
        if (
          explicitMappings[num] !== undefined &&
          explicitMappings[num] !== null &&
          explicitMappings[num].toString().trim() !== ''
        ) {
          initialVars[num] = explicitMappings[num];
        }
        // Priority 2: Smart NLP Context & Keyword Inferrer
        else if (inferredMappings[num]) {
          initialVars[num] = inferredMappings[num];
        }
        // Fallback default
        else {
          initialVars[num] = num === '1' ? '{Parent Name}' : '{Student Name}';
        }
      });
      setTemplateVariables(initialVars);
    } else {
      setTemplateVariables({});
    }
  }, [selectedTemplateId, detectedVariables.length, activeWorkflow]);

  const handleSaveDefaultMappings = async () => {
    if (!selectedTemplate) return;
    setIsSavingMappings(true);
    try {
      await api.updateTemplate(selectedTemplate.id, {
        variable_mappings: templateVariables,
      });
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === selectedTemplate.id ? { ...t, variable_mappings: templateVariables } : t
        )
      );
      if (showToast) {
        showToast({
          type: 'success',
          title: 'Template Variables Saved',
          message: `Default mappings saved permanently for '${selectedTemplate.name}'.`,
        });
      }
    } catch (err) {
      if (showToast) {
        showToast({
          type: 'error',
          title: 'Failed to save mappings',
          message: err instanceof Error ? err.message : 'Could not save variable defaults.',
        });
      }
    } finally {
      setIsSavingMappings(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const objectUrl = URL.createObjectURL(file);
      setLocalPreviewUrl(objectUrl);
    } catch (_) { }

    setImageUploading(true);
    try {
      const res = await api.uploadMedia(file);
      if (res.url) {
        const publicUrl = res.relative_url ? `${window.location.origin}${res.relative_url}` : res.url;
        setHeaderImageUrl(publicUrl);
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

  const handleInsertTag = (varKey, tag) => {
    setTemplateVariables((prev) => ({
      ...prev,
      [varKey]: tag,
    }));
  };

  const handleResetVariables = () => {
    const cleared = {};
    detectedVariables.forEach((num) => {
      cleared[num] = '';
    });
    setTemplateVariables(cleared);
  };

  // Toggle single class in multi-select
  const handleToggleClass = (classId) => {
    setSelectedClassIds((prev) => {
      if (prev.includes(classId)) {
        return prev.filter((id) => id !== classId);
      } else {
        return [...prev, classId];
      }
    });
  };

  const handleSelectAllClasses = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map((c) => c.id));
    }
  };

  // Resolve variable value for preview
  const resolvePreviewVariable = (varNum, student) => {
    const val = templateVariables[varNum] || '';
    if (!val) return `{{${varNum}}}`;

    let resolved = val;
    const parentName = student?.parent_name || 'Parent';
    const studentName = student?.student_name || 'Student';
    const className = student?.class_name || '';
    const feeAmount = student?.fees_due !== undefined && student?.fees_due !== null
      ? `₹${Number(student.fees_due).toLocaleString('en-IN')}`
      : '₹0';

    resolved = resolved.replaceAll('{Parent Name}', parentName);
    resolved = resolved.replaceAll('{{Parent Name}}', parentName);
    resolved = resolved.replaceAll('{parent_name}', parentName);
    resolved = resolved.replaceAll('{{parent_name}}', parentName);

    resolved = resolved.replaceAll('{Student Name}', studentName);
    resolved = resolved.replaceAll('{{Student Name}}', studentName);
    resolved = resolved.replaceAll('{student_name}', studentName);
    resolved = resolved.replaceAll('{{student_name}}', studentName);

    resolved = resolved.replaceAll('{Class Name}', className);
    resolved = resolved.replaceAll('{{Class Name}}', className);
    resolved = resolved.replaceAll('{class_name}', className);
    resolved = resolved.replaceAll('{{class_name}}', className);

    resolved = resolved.replaceAll('{Fees Due}', feeAmount);
    resolved = resolved.replaceAll('{{Fees Due}}', feeAmount);
    resolved = resolved.replaceAll('{fees_due}', feeAmount);
    resolved = resolved.replaceAll('{{fees_due}}', feeAmount);
    resolved = resolved.replaceAll('{Fees Amount}', feeAmount);
    resolved = resolved.replaceAll('{{Fees Amount}}', feeAmount);
    resolved = resolved.replaceAll('{fees_amount}', feeAmount);
    resolved = resolved.replaceAll('{{fees_amount}}', feeAmount);
    resolved = resolved.replaceAll('{fee}', feeAmount);
    resolved = resolved.replaceAll('{amount}', feeAmount);

    return resolved;
  };

  // Workflow-eligible students (For FEES: students with pending fees > 0 OR explicitly selected from student section. For others: all class students)
  const workflowStudents = useMemo(() => {
    if (activeWorkflow === 'FEES') {
      return students.filter(
        (s) => Number(s.fees_due || 0) > 0 || (initialStudentIds && initialStudentIds.includes(s.id))
      );
    }
    return students;
  }, [students, activeWorkflow, initialStudentIds]);

  // Selected student for preview
  const previewStudent =
    workflowStudents.find((s) => s.id === previewStudentId) ||
    workflowStudents[0] ||
    students[0];

  // Filtered students for checklist search
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) return workflowStudents;
    const term = studentSearchTerm.toLowerCase().trim();
    return workflowStudents.filter(
      (s) =>
        s.student_name?.toLowerCase().includes(term) ||
        s.parent_name?.toLowerCase().includes(term) ||
        s.whatsapp_number?.includes(term) ||
        s.class_name?.toLowerCase().includes(term)
    );
  }, [workflowStudents, studentSearchTerm]);

  // Render live preview text
  const renderedPreviewText = useMemo(() => {
    if (!selectedTemplate) return 'No template selected.';
    if (selectedTemplate.name === 'hello_world') {
      return `Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.`;
    }

    let text = selectedTemplate.body_preview || '';
    detectedVariables.forEach((varNum) => {
      const resolvedVal = resolvePreviewVariable(varNum, previewStudent);
      text = text.replaceAll(`{{${varNum}}}`, resolvedVal);
    });
    return text;
  }, [selectedTemplate, detectedVariables, templateVariables, previewStudent]);

  // Recipient toggle logic
  const handleToggleStudent = (studentId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const optedInStudents = useMemo(
    () => workflowStudents.filter((s) => s.whatsapp_opt_in),
    [workflowStudents]
  );
  const optedInCount = optedInStudents.length;
  const selectedCount = selectedStudentIds.length;

  const handleSelectAllOptedIn = () => {
    if (selectedCount === optedInCount && optedInCount > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(optedInStudents.map((s) => s.id));
    }
  };

  // Cost Estimation calculation based on Official Meta Cloud API Rates (India +91)
  const costEstimate = useMemo(() => {
    const count = selectedCount;
    const cat = (selectedTemplate?.category || 'UTILITY').toUpperCase();

    // Official Meta Cloud API base rates for India (+91)
    let rateInr = 0.115; // Utility default
    let rateUsd = 0.0014;

    if (cat === 'MARKETING') {
      rateInr = 0.8631; // Official Meta India Marketing message rate
      rateUsd = 0.0104;
    } else if (cat === 'AUTHENTICATION') {
      rateInr = 0.1150;
      rateUsd = 0.0014;
    } else if (cat === 'SERVICE') {
      rateInr = 0.3500;
      rateUsd = 0.0042;
    } else {
      // UTILITY (fee reminders, school circulars, student notifications)
      rateInr = 0.1150;
      rateUsd = 0.0014;
    }

    if (count === 0) {
      return {
        inr: '0.00',
        usd: '0.00',
        rateInr: rateInr < 1 ? rateInr.toFixed(3) : rateInr.toFixed(2),
        rateUsd,
        category: cat,
      };
    }

    const totalInr = (count * rateInr).toFixed(2);
    const totalUsd = (count * rateUsd).toFixed(2);

    return {
      inr: totalInr,
      usd: totalUsd,
      rateInr: rateInr < 1 ? rateInr.toFixed(3) : rateInr.toFixed(2),
      rateUsd,
      category: cat,
    };
  }, [selectedCount, selectedTemplate]);

  const handleStartBroadcastClick = () => {
    if (selectedClassIds.length === 0) {
      showToast({ type: 'warning', title: 'Please select at least one class.' });
      return;
    }
    if (!selectedTemplateId) {
      showToast({ type: 'warning', title: 'Please select a WhatsApp template' });
      return;
    }
    if (!isTemplateActive) {
      showToast({
        type: 'error',
        title: 'Inactive Template',
        message: 'Only approved (ACTIVE) WhatsApp templates can be dispatched.',
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

    // Verify all detected variables have a value entered
    for (const v of detectedVariables) {
      const val = (templateVariables[v] || '').trim();
      if (!val) {
        showToast({
          type: 'warning',
          title: `Variable {{${v}}} is empty`,
          message: `Please enter the common text or select a dynamic tag for placeholder {{${v}}}.`,
        });
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirmModal(false);
    setIsSending(true);

    const dynamicParams = detectedVariables.map((v) => {
      const val = templateVariables[v]?.trim();
      return val || `Sample_${v}`;
    });

    try {
      const campaign = await api.createCampaign({
        class_ids: selectedClassIds,
        template_id: Number(selectedTemplateId),
        student_ids: selectedStudentIds,
        dynamic_parameters: dynamicParams.length > 0 ? dynamicParams : undefined,
        header_image_url: headerImageUrl ? headerImageUrl.trim() : undefined,
      });

      // Solution 4: Auto-save confirmed variable mappings to DB for this template
      if (selectedTemplate && Object.keys(templateVariables).length > 0) {
        api.updateTemplate(selectedTemplate.id, {
          variable_mappings: templateVariables,
        }).catch((e) => console.debug('Auto-save template mapping on broadcast send:', e));
      }

      showToast({
        type: 'success',
        title: 'Broadcast Campaign Initiated!',
        message: `Dispatched broadcast to ${campaign.total_recipients} students across ${selectedClassIds.length} classes.`,
      });

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
    return <LoadingSpinner message="Preparing WhatsApp messaging workspace..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Page Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Send className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
            <span>Broadcast Messaging</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Send individual Meta WhatsApp messages to whole classes with dynamic parent names, student names &amp; fee dues.
          </p>
        </div>
      </div>

      {/* 3 Dedicated Workflow Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tab 1: Fees Workflow */}
        <button
          type="button"
          onClick={() => handleWorkflowChange('FEES')}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${activeWorkflow === 'FEES'
            ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border-amber-500 ring-2 ring-amber-500/20 shadow-md'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
            }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${activeWorkflow === 'FEES' ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30' : 'bg-amber-100 text-amber-700'
                  }`}
              >
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Fees Workflow</span>
                </h3>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                  Dynamic Fee Amounts
                </span>
              </div>
            </div>
            {activeWorkflow === 'FEES' && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-1 ring-4 ring-amber-500/20"></span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2.5 line-clamp-2">
            Collect school fees &amp; dues with automatic student fee amounts and all classes auto-selected.
          </p>
        </button>

        {/* Tab 2: Announcement Workflow */}
        <button
          type="button"
          onClick={() => handleWorkflowChange('ANNOUNCEMENT')}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${activeWorkflow === 'ANNOUNCEMENT'
            ? 'bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-white border-purple-500 ring-2 ring-purple-500/20 shadow-md'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
            }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${activeWorkflow === 'ANNOUNCEMENT' ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30' : 'bg-purple-100 text-purple-700'
                  }`}
              >
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Announcement Workflow</span>
                </h3>
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                  School-Wide Circulars
                </span>
              </div>
            </div>
            {activeWorkflow === 'ANNOUNCEMENT' && (
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0 mt-1 ring-4 ring-purple-600/20"></span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2.5 line-clamp-2">
            Broadcast events, holidays, annual functions &amp; official circulars with image headers across all classes.
          </p>
        </button>

        {/* Tab 3: Normal Broadcast Workflow */}
        <button
          type="button"
          onClick={() => handleWorkflowChange('NORMAL')}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${activeWorkflow === 'NORMAL'
            ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border-emerald-600 ring-2 ring-emerald-600/20 shadow-md'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
            }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${activeWorkflow === 'NORMAL' ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30' : 'bg-emerald-100 text-emerald-700'
                  }`}
              >
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Normal Workflow</span>
                </h3>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  Standard Broadcast
                </span>
              </div>
            </div>
            {activeWorkflow === 'NORMAL' && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0 mt-1 ring-4 ring-emerald-600/20"></span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2.5 line-clamp-2">
            General messaging, attendance alerts &amp; custom broadcasts with multi-class selection.
          </p>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column: Form & Selection */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Multiple Class Selection */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>1. Target Classes (Multi-Select)</span>
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeWorkflow === 'FEES' && 'All classes are auto-selected for fee notices. Click to deselect any class.'}
                  {activeWorkflow === 'ANNOUNCEMENT' && 'All classes are auto-selected for school announcements. Click to deselect.'}
                  {activeWorkflow === 'NORMAL' && 'Select one, multiple, or all classes to target.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllClasses}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                >
                  {selectedClassIds.length === classes.length ? 'Deselect All' : 'Select All Classes'}
                </button>
                <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  {activeWorkflow === 'FEES' ? `${workflowStudents.length} Students with Dues` : `${students.length} Total Students`}
                </span>
              </div>
            </div>

            {/* Class Badges / Checkbox Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
              {classes.map((c) => {
                const isChecked = selectedClassIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleToggleClass(c.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${isChecked
                      ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500/20 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                      }`}
                  >
                    <div className="truncate">
                      <div className="text-xs font-bold truncate">
                        {c.name} {c.section ? `- ${c.section}` : ''}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {c.student_count || 0} students
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Template Selection & Configuration */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-600" />
                <span>2. Select WhatsApp Template</span>
              </label>
              {selectedTemplate && (
                <StatusBadge status={selectedTemplate.status} />
              )}
            </div>

            <div className="relative">
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer shadow-xs"
              >
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} [{t.status}] - {t.category} ({t.language}) {t.header_type === 'IMAGE' ? '🖼️ [Image Header]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Inactive template warning */}
            {!isTemplateActive && selectedTemplate && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Template Pending Meta Approval:</strong> Only templates with{' '}
                  <span className="font-bold text-emerald-700">APPROVED / ACTIVE</span> status can be used for broadcast dispatch.
                </div>
              </div>
            )}

            {/* Dynamic Variables Form */}
            {detectedVariables.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>Dynamic Message Variables ({detectedVariables.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSavingMappings}
                      onClick={handleSaveDefaultMappings}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                      title="Save current variable mappings as the permanent defaults for this template"
                    >
                      <Save className="w-3 h-3 text-emerald-600" />
                      <span>{isSavingMappings ? 'Saving...' : 'Save as Default'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetVariables}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {detectedVariables.map((num) => (
                    <div key={num} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Placeholder {'{{' + num + '}}'}:</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleInsertTag(num, '{Parent Name}')}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors cursor-pointer"
                          >
                            + {'{Parent Name}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertTag(num, '{Student Name}')}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors cursor-pointer"
                          >
                            + {'{Student Name}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertTag(num, '{Fees Due}')}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors cursor-pointer"
                          >
                            + {'{Fees Due}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertTag(num, '{Class Name}')}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 transition-colors cursor-pointer"
                          >
                            + {'{Class Name}'}
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={templateVariables[num] || ''}
                        onChange={(e) => handleVariableChange(num, e.target.value)}
                        placeholder={`Enter text or click dynamic tags above for {{${num}}}`}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-600 shadow-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Header Image Attachment Section: ONLY shown when selected template is an Image Header template */}
            {isImageTemplate && (
              <div className="p-4 rounded-xl bg-purple-50/80 border border-purple-200 text-xs space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-purple-950 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>Header Image Attachment {selectedTemplate?.header_type === 'IMAGE' ? <span className="text-rose-600">*</span> : '(Optional)'}</span>
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
                    placeholder="https://example.com/school-event.png or click upload"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span>
                    3. Class Recipients Checklist ({selectedCount}{' '}
                    {activeWorkflow === 'FEES' ? 'with Dues Selected' : 'Selected'})
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeWorkflow === 'FEES'
                    ? 'Filtered to students with pending fees (₹ > 0). Click a student row to preview their message.'
                    : 'Click a student row to preview their customized WhatsApp notification.'}
                </p>
              </div>

              {optedInCount > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllOptedIn}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  {selectedStudentIds.length === optedInCount ? 'Deselect All' : 'Select All Opted-In'}
                </button>
              )}
            </div>

            {/* Search Filter for Students */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
                placeholder={
                  activeWorkflow === 'FEES'
                    ? 'Search among students with pending fees...'
                    : 'Search student name, parent name, or phone number...'
                }
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            {loadingStudents ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
                <span>Loading students from selected classes...</span>
              </div>
            ) : workflowStudents.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4 space-y-1">
                <div className="font-bold text-slate-700">
                  {activeWorkflow === 'FEES'
                    ? 'No students with pending fees found in the selected classes.'
                    : 'No students found in the selected classes.'}
                </div>
                {activeWorkflow === 'FEES' && (
                  <p className="text-slate-400 text-[11px]">
                    All students in the selected classes currently have zero fee balance.
                  </p>
                )}
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredStudents.map((s) => {
                  const isSelected = selectedStudentIds.includes(s.id);
                  const isOptedIn = s.whatsapp_opt_in;
                  const isPreviewing = previewStudent?.id === s.id;
                  const feesAmount = s.fees_due !== undefined && s.fees_due !== null ? Number(s.fees_due) : 0;

                  return (
                    <div
                      key={s.id}
                      onClick={() => setPreviewStudentId(s.id)}
                      className={`p-3 flex items-center justify-between text-xs transition-colors cursor-pointer ${isPreviewing ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          disabled={!isOptedIn}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isOptedIn) handleToggleStudent(s.id);
                          }}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${!isOptedIn
                            ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                            : isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'border border-slate-300 bg-white hover:border-emerald-500'
                            }`}
                        >
                          {isSelected && <CheckSquare className="w-4 h-4" />}
                        </button>

                        <div className="truncate">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span className="truncate">{s.student_name}</span>
                            {isPreviewing && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Previewing
                              </span>
                            )}
                            {s.class_name && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                {s.class_name}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Parent: <strong className="text-slate-700">{s.parent_name || 'Parent'}</strong></span>
                            <span>&bull;</span>
                            <span>+{s.whatsapp_number}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 ml-2">
                        {/* Fees Due Badge */}
                        <div
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${feesAmount > 0
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                        >
                          ₹{feesAmount.toLocaleString('en-IN')}
                        </div>

                        {!isOptedIn ? (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            Opted Out
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Opted In
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

        {/* Right Column: Live WhatsApp Message Preview & Estimated Cost */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Preview Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Live WhatsApp Message Preview</span>
              </h3>
              {previewStudent && (
                <span className="text-xs text-slate-500 font-medium truncate max-w-[160px]">
                  Previewing: <strong className="text-slate-800">{previewStudent.student_name}</strong>
                </span>
              )}
            </div>

            {/* WhatsApp Chat Bubble Mock */}
            <div className="bg-[#EFEAE2] p-4 rounded-2xl border border-slate-300/80 shadow-inner relative overflow-hidden min-h-[320px]">
              {/* WhatsApp Header Mock */}
              <div className="bg-[#075E54] text-white p-2.5 rounded-xl shadow-xs flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-xs">
                  ABC
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate leading-tight">ABC Public School</div>
                  <div className="text-[10px] text-emerald-200 truncate">
                    To: {previewStudent?.parent_name || 'Parent'} (+{previewStudent?.whatsapp_number || '916398135162'})
                  </div>
                </div>
              </div>

              {/* Chat Message Bubble */}
              {!selectedTemplate ? (
                <div className="bg-white/90 p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-2 text-slate-500">
                  <FileCode className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No Template Selected</p>
                  <p className="text-[11px] text-slate-400">
                    {availableTemplates.length === 0
                      ? 'No announcement templates available to preview'
                      : 'Select a template from the list above to preview the message'}
                  </p>
                </div>
              ) : (
                <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs shadow-md border border-slate-200 text-xs text-slate-800 space-y-2.5 max-w-[92%] relative">
                  {/* Image Header Preview if applicable */}
                  {isImageTemplate && (
                    <div className="w-full h-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center">
                      {localPreviewUrl || headerImageUrl ? (
                        <img
                          src={localPreviewUrl || headerImageUrl}
                          alt="Header attachment"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 text-xs gap-1 p-2 text-center">
                          <ImageIcon className="w-6 h-6 text-purple-400" />
                          <span className="font-semibold text-purple-700">Image Header Required</span>
                          <span className="text-[10px] text-slate-400">Upload an image from form</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text Header Preview if applicable */}
                  {selectedTemplate?.header_type === 'TEXT' && selectedTemplate.header_text && (
                    <div className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-1">
                      {selectedTemplate.header_text}
                    </div>
                  )}

                  {/* Body Text Preview with Dynamic Values */}
                  <div className="whitespace-pre-line text-slate-700 leading-relaxed font-normal text-xs">
                    {renderedPreviewText}
                  </div>

                  {/* WhatsApp Message Metadata */}
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-1">
                    <span>Just now</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </div>
                </div>
              )}
            </div>

            {/* Estimated Messaging Cost Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/80 border border-emerald-200 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-emerald-950">
                <div className="flex items-center gap-1.5">
                  <IndianRupee className="w-4 h-4 text-emerald-700" />
                  <span>Estimated Broadcast Cost</span>
                </div>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                  {costEstimate.category} Rate
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="text-lg font-black text-emerald-800">
                    ₹{costEstimate.inr}{' '}
                    <span className="text-xs font-normal text-slate-500">(~${costEstimate.usd} USD)</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    for <strong className="text-slate-800">{selectedCount}</strong> selected recipient(s) @ ₹{costEstimate.rateInr}/msg
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 text-right flex items-center gap-1">
                  <Info className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Meta Cloud API billing</span>
                </div>
              </div>
            </div>

            {/* Action CTA Button */}
            <button
              type="button"
              disabled={isSending || !isTemplateActive || selectedCount === 0}
              onClick={handleStartBroadcastClick}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-700/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Broadcasting Messages to Meta...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Broadcast to {selectedCount} Students</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm WhatsApp Broadcast Dispatch"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-600">
          <p>
            You are about to broadcast individual WhatsApp messages via the Meta Cloud API with the following parameters:
          </p>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Active Workflow:</span>
              <strong className="text-slate-900 font-bold">{activeWorkflow} Workflow</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Selected Classes:</span>
              <strong className="text-slate-900 font-bold">
                {selectedClassIds.length} Class(es) ({classes.filter((c) => selectedClassIds.includes(c.id)).map((c) => c.name).join(', ')})
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Template Name:</span>
              <strong className="text-slate-900 font-bold">{selectedTemplate?.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Target Recipients:</span>
              <strong className="text-emerald-700 font-bold">{selectedCount} Opted-In Students</strong>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-800">
              <span>Total Estimated Cost:</span>
              <span className="text-emerald-700">₹{costEstimate.inr} (~${costEstimate.usd} USD)</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSend}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Confirm &amp; Send Broadcast
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
