export interface ClassItem {
  id: number;
  name: string;
  section?: string | null;
  created_at: string;
  updated_at: string;
  student_count: number;
}

export interface StudentItem {
  id: number;
  class_id: number;
  class_name?: string | null;
  student_name: string;
  parent_name?: string | null;
  whatsapp_number: string;
  whatsapp_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: number;
  name: string;
  category: string;
  language: string;
  description?: string | null;
  body_preview?: string | null;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
  created_at: string;
  updated_at: string;
}

export interface MessageCampaign {
  id: number;
  class_id?: number | null;
  class_name?: string | null;
  template_id?: number | null;
  template_name?: string | null;
  total_recipients: number;
  successful_count: number;
  failed_count: number;
  skipped_count: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface MessageLog {
  id: number;
  campaign_id?: number | null;
  student_id?: number | null;
  student_name?: string | null;
  recipient_number: string;
  masked_number?: string | null;
  template_name: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED';
  whatsapp_message_id?: string | null;
  error_message?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  created_at: string;
}

export interface CampaignDetail extends MessageCampaign {
  message_logs: MessageLog[];
}

export interface TestMessageResult {
  success: boolean;
  message_id?: string | null;
  recipient?: string | null;
  error?: string | null;
  meta_error?: Record<string, any> | null;
}

export interface HealthStatus {
  status: string;
  service: string;
  timestamp: string;
  database: string;
}
