import React, { useState } from 'react';
import { AlertCircle, HelpCircle, Info } from 'lucide-react';

/**
 * Maps Meta Cloud API WhatsApp error codes and patterns to simple,
 * human-friendly explanations for school staff.
 */
const META_ERROR_MAP = {
  '131026': {
    title: 'Number not on WhatsApp',
    description: 'This phone number is not registered on WhatsApp, or the recipient has opted out.',
    hint: 'Check if the mobile number is active on WhatsApp, or verify the country code (+91).',
  },
  '131047': {
    title: '24-Hour Window Expired',
    description: 'More than 24 hours have passed since the parent last sent a message.',
    hint: 'To message this parent, send an approved Meta Template (free-form text is restricted).',
  },
  '131051': {
    title: 'Unsupported Message Type',
    description: 'The message format, document type, or media extension is not supported by WhatsApp.',
    hint: 'Ensure media is standard JPG, PNG, or PDF format under 15MB.',
  },
  '131052': {
    title: 'Media Download Failed',
    description: 'Meta WhatsApp servers could not download the attached media from the provided URL.',
    hint: 'Check if the file URL is publicly accessible or try re-uploading the document.',
  },
  '131053': {
    title: 'Media Upload Failed',
    description: 'WhatsApp failed to process the media file during dispatch.',
    hint: 'Verify the file size and internet connectivity.',
  },
  '130429': {
    title: 'Rate Limit Reached',
    description: 'WhatsApp temporary sending speed limit reached for your business tier.',
    hint: 'The system automatically throttles and retries with backoff delays.',
  },
  '131048': {
    title: 'Rate Limit Reached',
    description: 'Meta throughput limit hit for this phone number.',
    hint: 'Messages are automatically queued to prevent account suspension.',
  },
  '80007': {
    title: 'Meta API Rate Limit',
    description: 'Too many requests dispatched concurrently to Meta Cloud API.',
    hint: 'The scheduler will pace deliveries to comply with Meta limits.',
  },
  '131009': {
    title: 'Invalid Template Variable',
    description: 'One or more template variables (e.g. {{1}}, {{2}}) were empty or invalid.',
    hint: 'Check student name or fee amount variables in broadcast setup.',
  },
  '132000': {
    title: 'Template Not Found',
    description: 'This template name does not exist in your Meta account, or language code mismatches.',
    hint: 'Verify the template name and language in Meta WhatsApp Manager.',
  },
  '132001': {
    title: 'Template Paused by Meta',
    description: 'Meta has paused or flagged this template due to negative parent feedback or quality rating.',
    hint: 'Check template quality in Meta Business Suite.',
  },
  '132005': {
    title: 'Variable Count Mismatch',
    description: 'The number of variables provided does not match what the template requires.',
    hint: 'Ensure all required template placeholders are filled.',
  },
  '132015': {
    title: 'Parameter Count Mismatch',
    description: 'Mismatch in parameters required by Meta for this template.',
    hint: 'Review template components in Meta WhatsApp Manager.',
  },
  '133004': {
    title: 'WhatsApp Account Suspended',
    description: 'Your Meta WhatsApp Business account has been flagged or suspended.',
    hint: 'Log in to Meta Business Manager to review account status.',
  },
  '133010': {
    title: 'Number Deregistered',
    description: 'Your school sender phone number is not properly registered with Meta Cloud API.',
    hint: 'Verify phone number certificate in Meta WhatsApp settings.',
  },
  '131031': {
    title: 'Meta Billing Issue',
    description: 'Payment method declined or credit limit reached in Meta Business Account.',
    hint: 'Update payment method in Meta Business Manager.',
  },
  '190': {
    title: 'Meta Access Token Expired',
    description: 'System Meta Cloud API access token is invalid or has expired.',
    hint: 'Generate a Permanent System User Token in Meta Business Manager.',
  },
  '100': {
    title: 'Invalid Meta API Request',
    description: 'Meta rejected the API payload structure.',
    hint: 'Verify recipient phone formatting (+91XXXXXXXXXX).',
  },
  '130472': {
    title: 'Recipient in Restricted Region',
    description: 'User cannot receive WhatsApp messages due to regional WhatsApp policy.',
    hint: 'Check recipient number country code.',
  },
};

/**
 * Extracts code and generates simple + technical error metadata.
 */
export function parseMetaError(rawError) {
  if (!rawError || typeof rawError !== 'string') {
    return {
      simpleTitle: 'Delivery Failed',
      simpleDescription: 'An unknown delivery error occurred.',
      technicalCode: null,
      technicalDetail: rawError || '',
      hint: '',
    };
  }

  const str = rawError.trim();

  // Try extracting code like [131026], code 131026, (131026), etc.
  const codeMatch = str.match(/\[(\d{3,6})\]|code\s*:?\s*(\d{3,6})|\((\d{3,6})\)/i);
  const code = codeMatch ? (codeMatch[1] || codeMatch[2] || codeMatch[3]) : null;

  if (code && META_ERROR_MAP[code]) {
    const meta = META_ERROR_MAP[code];
    return {
      simpleTitle: meta.title,
      simpleDescription: meta.description,
      technicalCode: code,
      technicalDetail: str,
      hint: meta.hint,
    };
  }

  // Keyword-based fallbacks
  const low = str.toLowerCase();
  if (low.includes('undeliverable') || low.includes('not a whatsapp') || low.includes('not registered')) {
    return {
      simpleTitle: 'Number not on WhatsApp',
      simpleDescription: 'This number is not on WhatsApp or cannot receive messages.',
      technicalCode: code || '131026',
      technicalDetail: str,
      hint: 'Verify that the recipient has an active WhatsApp account.',
    };
  }
  if (low.includes('24 hour') || low.includes('re-engagement') || low.includes('window')) {
    return {
      simpleTitle: '24-Hour Window Expired',
      simpleDescription: 'Must use an approved Meta Template to re-open contact.',
      technicalCode: code || '131047',
      technicalDetail: str,
      hint: 'Send an approved template instead of free-form text.',
    };
  }
  if (low.includes('rate limit') || low.includes('throughput')) {
    return {
      simpleTitle: 'Rate Limit Reached',
      simpleDescription: 'Meta speed limit reached; retrying automatically.',
      technicalCode: code || '130429',
      technicalDetail: str,
      hint: 'The system throttles throughput automatically.',
    };
  }
  if (low.includes('token') || low.includes('expired')) {
    return {
      simpleTitle: 'Meta Access Token Expired',
      simpleDescription: 'System Meta access credentials need renewal.',
      technicalCode: code || '190',
      technicalDetail: str,
      hint: 'Update WhatsApp Token in settings.',
    };
  }
  if (low.includes('template') && (low.includes('exist') || low.includes('not found'))) {
    return {
      simpleTitle: 'Template Not Found',
      simpleDescription: 'Template is missing or rejected in Meta WhatsApp account.',
      technicalCode: code || '132000',
      technicalDetail: str,
      hint: 'Verify the template name in Meta WhatsApp Manager.',
    };
  }
  if (low.includes('network') || low.includes('timeout') || low.includes('econnrefused')) {
    return {
      simpleTitle: 'Network Connection Timeout',
      simpleDescription: 'Temporary server or internet connectivity issue.',
      technicalCode: 'NET_ERR',
      technicalDetail: str,
      hint: 'Check server outbound internet connection.',
    };
  }

  // Generic fallback: clean up "Meta error:" prefix if present
  let cleanTitle = str;
  if (cleanTitle.startsWith('Meta error:')) cleanTitle = cleanTitle.replace(/^Meta error:\s*/i, '');
  if (cleanTitle.length > 35) cleanTitle = cleanTitle.substring(0, 32) + '...';

  return {
    simpleTitle: cleanTitle || 'Delivery Failed',
    simpleDescription: str,
    technicalCode: code,
    technicalDetail: str,
    hint: '',
  };
}

/**
 * Reusable Component: Displays the Simple Human Message prominently,
 * with the technical code and expandable/hoverable details.
 */
export function MetaErrorDetail({ errorMessage, compact = false, showHint = false }) {
  const [expanded, setExpanded] = useState(false);

  if (!errorMessage) {
    return <span className="text-slate-400">-</span>;
  }

  const { simpleTitle, simpleDescription, technicalCode, technicalDetail, hint } = parseMetaError(errorMessage);

  const fullTooltip = [
    `Reason: ${simpleTitle}`,
    simpleDescription ? `Detail: ${simpleDescription}` : null,
    technicalDetail ? `Technical: ${technicalDetail}` : null,
    hint ? `Suggestion: ${hint}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-md cursor-help"
        title={fullTooltip}
      >
        <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
        <span className="truncate max-w-[130px]">{simpleTitle}</span>
        {technicalCode && (
          <span className="text-[10px] font-mono text-rose-500 shrink-0 font-normal">[{technicalCode}]</span>
        )}
      </span>
    );
  }

  return (
    <div
      className="flex flex-col gap-0.5 text-left max-w-sm group cursor-pointer"
      title={fullTooltip}
      onClick={() => setExpanded((prev) => !prev)}
    >
      {/* Primary Simple Message */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200/90 px-2 py-0.5 rounded-lg shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span>{simpleTitle}</span>
        </span>

        {technicalCode && (
          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
            Code {technicalCode}
          </span>
        )}
      </div>

      {/* Secondary Description */}
      <p className="text-[11px] text-slate-600 font-medium line-clamp-1 group-hover:text-slate-900 transition-colors">
        {simpleDescription}
      </p>

      {/* Expandable Technical Details */}
      {expanded ? (
        <div className="mt-1 p-2 bg-slate-900 text-slate-200 text-[10px] font-mono rounded-lg border border-slate-800 space-y-1 shadow-sm">
          <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Technical Payload:</p>
          <p className="break-all whitespace-pre-wrap">{technicalDetail}</p>
          {hint && (
            <p className="text-emerald-400 pt-1 border-t border-slate-800 font-sans text-[11px]">
              💡 <strong>Action:</strong> {hint}
            </p>
          )}
        </div>
      ) : (
        <span className="text-[10px] text-slate-400 group-hover:text-slate-600 inline-flex items-center gap-1">
          <Info className="w-2.5 h-2.5" />
          <span>Click for technical detail</span>
        </span>
      )}
    </div>
  );
}

export default MetaErrorDetail;
