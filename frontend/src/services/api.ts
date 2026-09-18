import {
  ClassItem,
  StudentItem,
  MessageTemplate,
  MessageCampaign,
  CampaignDetail,
  MessageLog,
  TestMessageResult,
  HealthStatus
} from '../types';

const API_BASE = ''; // Uses Vite proxy in development or direct host in production

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorDetail = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorDetail);
  }
  if (response.status === 204) {
    return {} as T;
  }
  return response.json();
}

export const api = {
  // Health
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<HealthStatus>(res);
  },

  // Classes
  async getClasses(): Promise<ClassItem[]> {
    const res = await fetch(`${API_BASE}/api/classes`);
    return handleResponse<ClassItem[]>(res);
  },

  async getClass(id: number): Promise<ClassItem> {
    const res = await fetch(`${API_BASE}/api/classes/${id}`);
    return handleResponse<ClassItem>(res);
  },

  async createClass(data: { name: string; section?: string }): Promise<ClassItem> {
    const res = await fetch(`${API_BASE}/api/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<ClassItem>(res);
  },

  async updateClass(id: number, data: { name?: string; section?: string }): Promise<ClassItem> {
    const res = await fetch(`${API_BASE}/api/classes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<ClassItem>(res);
  },

  async deleteClass(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/classes/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Students
  async getStudents(params?: { class_id?: number; search?: string; opt_in?: boolean }): Promise<StudentItem[]> {
    const url = new URL(`${window.location.origin}/api/students`);
    if (params?.class_id !== undefined && params?.class_id !== null) {
      url.searchParams.append('class_id', params.class_id.toString());
    }
    if (params?.search) {
      url.searchParams.append('search', params.search);
    }
    if (params?.opt_in !== undefined && params?.opt_in !== null) {
      url.searchParams.append('opt_in', params.opt_in.toString());
    }

    const res = await fetch(url.pathname + url.search);
    return handleResponse<StudentItem[]>(res);
  },

  async getStudent(id: number): Promise<StudentItem> {
    const res = await fetch(`${API_BASE}/api/students/${id}`);
    return handleResponse<StudentItem>(res);
  },

  async createStudent(data: {
    class_id: number;
    student_name: string;
    parent_name?: string;
    whatsapp_number: string;
    whatsapp_opt_in?: boolean;
  }): Promise<StudentItem> {
    const res = await fetch(`${API_BASE}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<StudentItem>(res);
  },

  async updateStudent(
    id: number,
    data: {
      class_id?: number;
      student_name?: string;
      parent_name?: string;
      whatsapp_number?: string;
      whatsapp_opt_in?: boolean;
    }
  ): Promise<StudentItem> {
    const res = await fetch(`${API_BASE}/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<StudentItem>(res);
  },

  async deleteStudent(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/students/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Templates
  async getTemplates(): Promise<MessageTemplate[]> {
    const res = await fetch(`${API_BASE}/api/templates`);
    return handleResponse<MessageTemplate[]>(res);
  },

  async getTemplate(id: number): Promise<MessageTemplate> {
    const res = await fetch(`${API_BASE}/api/templates/${id}`);
    return handleResponse<MessageTemplate>(res);
  },

  // Campaigns
  async getCampaigns(): Promise<MessageCampaign[]> {
    const res = await fetch(`${API_BASE}/api/campaigns`);
    return handleResponse<MessageCampaign[]>(res);
  },

  async getCampaign(id: number): Promise<CampaignDetail> {
    const res = await fetch(`${API_BASE}/api/campaigns/${id}`);
    return handleResponse<CampaignDetail>(res);
  },

  async createCampaign(data: {
    class_id: number;
    template_id: number;
    student_ids?: number[];
    dynamic_parameters?: string[];
  }): Promise<MessageCampaign> {
    const res = await fetch(`${API_BASE}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<MessageCampaign>(res);
  },

  // Message Logs
  async getMessageLogs(params?: {
    campaign_id?: number;
    student_id?: number;
    status?: string;
    limit?: number;
  }): Promise<MessageLog[]> {
    const url = new URL(`${window.location.origin}/api/message-logs`);
    if (params?.campaign_id) url.searchParams.append('campaign_id', params.campaign_id.toString());
    if (params?.student_id) url.searchParams.append('student_id', params.student_id.toString());
    if (params?.status && params.status !== 'ALL') url.searchParams.append('status', params.status);
    if (params?.limit) url.searchParams.append('limit', params.limit.toString());

    const res = await fetch(url.pathname + url.search);
    return handleResponse<MessageLog[]>(res);
  },

  // Test Direct WhatsApp Message
  async sendTestMessage(data: {
    recipient_number: string;
    template_name?: string;
    language_code?: string;
  }): Promise<TestMessageResult> {
    const res = await fetch(`${API_BASE}/api/messages/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<TestMessageResult>(res);
  },
};
