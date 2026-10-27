const API_BASE = ''; // Uses Vite proxy in development or direct host in production

export const authStorage = {
  getToken() {
    return localStorage.getItem('school_auth_token') || '';
  },
  setToken(token) {
    if (token) localStorage.setItem('school_auth_token', token);
    else localStorage.removeItem('school_auth_token');
  },
  getUser() {
    try {
      const u = localStorage.getItem('school_auth_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser(user) {
    if (user) localStorage.setItem('school_auth_user', JSON.stringify(user));
    else localStorage.removeItem('school_auth_user');
  },
  clear() {
    localStorage.removeItem('school_auth_token');
    localStorage.removeItem('school_auth_user');
  },
};

function getAuthHeaders(headers = {}) {
  const token = authStorage.getToken();
  if (token) {
    return {
      ...headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return headers;
}

async function handleResponse(response) {
  if (response.status === 401) {
    // If token invalid, allow app to handle login state
  }
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
    return {};
  }
  return response.json();
}

let _classesCache = null;
let _templatesCache = null;

export const api = {
  // Authentication
  async login(email, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(res);
    if (data.token) {
      authStorage.setToken(data.token);
      authStorage.setUser(data.user);
    }
    return data;
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (_) {}
    authStorage.clear();
  },

  // Health
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Dashboard Stats
  async getDashboardStats() {
    const res = await fetch(`${API_BASE}/api/dashboard/stats`);
    return handleResponse(res);
  },

  // Classes
  async getClasses(forceRefresh = false) {
    if (!forceRefresh && _classesCache) {
      return _classesCache;
    }
    const res = await fetch(`${API_BASE}/api/classes`);
    const data = await handleResponse(res);
    _classesCache = data;
    return data;
  },

  clearClassCache() {
    _classesCache = null;
  },

  async getClass(id) {
    const res = await fetch(`${API_BASE}/api/classes/${id}`);
    return handleResponse(res);
  },

  async createClass(data) {
    _classesCache = null;
    const res = await fetch(`${API_BASE}/api/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateClass(id, data) {
    _classesCache = null;
    const res = await fetch(`${API_BASE}/api/classes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteClass(id) {
    _classesCache = null;
    const res = await fetch(`${API_BASE}/api/classes/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Students
  async getStudents(params) {
    const url = new URL(`${window.location.origin}/api/students`);
    if (params?.class_ids !== undefined && params?.class_ids !== null) {
      const cStr = Array.isArray(params.class_ids) ? params.class_ids.join(',') : params.class_ids.toString();
      url.searchParams.append('class_ids', cStr);
    } else if (params?.class_id !== undefined && params?.class_id !== null) {
      url.searchParams.append('class_id', params.class_id.toString());
    }
    if (params?.search) {
      url.searchParams.append('search', params.search);
    }
    if (params?.opt_in !== undefined && params?.opt_in !== null) {
      url.searchParams.append('opt_in', params.opt_in.toString());
    }
    if (params?.fees_filter) {
      url.searchParams.append('fees_filter', params.fees_filter);
    }
    if (params?.page) {
      url.searchParams.append('page', params.page.toString());
    }
    if (params?.page_size) {
      url.searchParams.append('page_size', params.page_size.toString());
    }

    const res = await fetch(url.pathname + url.search);
    return handleResponse(res);
  },

  async getStudent(id) {
    const res = await fetch(`${API_BASE}/api/students/${id}`);
    return handleResponse(res);
  },

  async createStudent(data) {
    const res = await fetch(`${API_BASE}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateStudent(id, data) {
    const res = await fetch(`${API_BASE}/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteStudent(id) {
    const res = await fetch(`${API_BASE}/api/students/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  async importStudents(formData) {
    const res = await fetch(`${API_BASE}/api/students/import-csv`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },

  // Templates
  async getTemplates(forceRefresh = false) {
    if (!forceRefresh && _templatesCache) {
      return _templatesCache;
    }
    const res = await fetch(`${API_BASE}/api/templates`);
    const data = await handleResponse(res);
    _templatesCache = data;
    return data;
  },

  clearTemplatesCache() {
    _templatesCache = null;
  },

  async getTemplate(id) {
    const res = await fetch(`${API_BASE}/api/templates/${id}`);
    return handleResponse(res);
  },

  async syncTemplates() {
    _templatesCache = null;
    const res = await fetch(`${API_BASE}/api/templates/sync`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  async createTemplate(data) {
    _templatesCache = null;
    const res = await fetch(`${API_BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateTemplate(id, data) {
    _templatesCache = null;
    const res = await fetch(`${API_BASE}/api/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteTemplate(id) {
    _templatesCache = null;
    const res = await fetch(`${API_BASE}/api/templates/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Media Upload
  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/media/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },

  // Campaigns
  async getCampaigns(params) {
    const url = new URL(`${window.location.origin}/api/campaigns`);
    if (params?.search) url.searchParams.append('search', params.search);
    if (params?.page) url.searchParams.append('page', params.page.toString());
    if (params?.page_size) url.searchParams.append('page_size', params.page_size.toString());
    const res = await fetch(url.pathname + url.search);
    return handleResponse(res);
  },

  async getCampaign(id) {
    const res = await fetch(`${API_BASE}/api/campaigns/${id}`);
    return handleResponse(res);
  },

  async createCampaign(data) {
    const res = await fetch(`${API_BASE}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteCampaign(id) {
    const res = await fetch(`${API_BASE}/api/campaigns/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  async bulkDeleteCampaigns(data) {
    const res = await fetch(`${API_BASE}/api/campaigns/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Message Logs
  async getMessageLogs(params) {
    const url = new URL(`${window.location.origin}/api/message-logs`);
    if (params?.campaign_id) url.searchParams.append('campaign_id', params.campaign_id.toString());
    if (params?.student_id) url.searchParams.append('student_id', params.student_id.toString());
    if (params?.status && params.status !== 'ALL') url.searchParams.append('status', params.status);
    if (params?.search) url.searchParams.append('search', params.search);
    if (params?.date) url.searchParams.append('date', params.date);
    if (params?.from_date) url.searchParams.append('from_date', params.from_date);
    if (params?.to_date) url.searchParams.append('to_date', params.to_date);
    if (params?.before_date) url.searchParams.append('before_date', params.before_date);
    if (params?.response_date) url.searchParams.append('response_date', params.response_date);
    if (params?.unread_only) url.searchParams.append('unread_only', 'true');
    if (params?.page) url.searchParams.append('page', params.page.toString());
    if (params?.page_size) url.searchParams.append('page_size', params.page_size.toString());
    if (params?.limit) url.searchParams.append('limit', params.limit.toString());
    url.searchParams.append('_t', Date.now().toString());

    const res = await fetch(url.pathname + url.search, { cache: 'no-store' });
    return handleResponse(res);
  },

  async exportMessageLogs(params = {}) {
    const url = new URL(`${window.location.origin}/api/message-logs/export`);
    if (params.campaign_id && params.campaign_id !== 'ALL') url.searchParams.append('campaign_id', params.campaign_id.toString());
    if (params.status && params.status !== 'ALL') url.searchParams.append('status', params.status);
    if (params.date) url.searchParams.append('date', params.date);
    if (params.from_date) url.searchParams.append('from_date', params.from_date);
    if (params.to_date) url.searchParams.append('to_date', params.to_date);
    if (params.search) url.searchParams.append('search', params.search);
    if (params.ids && params.ids.length > 0) url.searchParams.append('ids', params.ids.join(','));

    const res = await fetch(url.pathname + url.search, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Export failed (${res.status}): ${res.statusText}`);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const contentDisposition = res.headers.get('Content-Disposition') || '';
    let filename = 'Message_Delivery_Logs.xlsx';
    const match = contentDisposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = match[1];
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  async deleteMessageLog(id) {
    const res = await fetch(`${API_BASE}/api/message-logs/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  async bulkDeleteMessageLogs(data) {
    const res = await fetch(`${API_BASE}/api/message-logs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Test Direct WhatsApp Message
  async sendTestMessage(data) {
    const res = await fetch(`${API_BASE}/api/messages/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // WhatsApp Conversations
  async getConversations(params = {}) {
    const url = new URL(`${window.location.origin}/api/conversations`);
    if (params.search) url.searchParams.append('search', params.search);
    if (params.unread_only) url.searchParams.append('unread_only', 'true');
    if (params.replies_only) url.searchParams.append('replies_only', 'true');
    if (params.class_id) url.searchParams.append('class_id', params.class_id.toString());
    const res = await fetch(url.pathname + url.search);
    return handleResponse(res);
  },

  async getConversation(phoneOrStudentId) {
    const res = await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(phoneOrStudentId)}`);
    return handleResponse(res);
  },

  async sendConversationMessage(data) {
    const res = await fetch(`${API_BASE}/api/conversations/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Complaints & Feedback
  async getComplaintsFeedback(params = {}) {
    const url = new URL(`${API_BASE}/api/complaints-feedback`, window.location.origin);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url.searchParams.append(key, params[key]);
      }
    });
    const res = await fetch(url.pathname + url.search);
    return handleResponse(res);
  },

  async getComplaintsFeedbackStats() {
    const res = await fetch(`${API_BASE}/api/complaints-feedback/stats`);
    return handleResponse(res);
  },

  async updateComplaintFeedback(id, data) {
    const res = await fetch(`${API_BASE}/api/complaints-feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteComplaintFeedback(id) {
    const res = await fetch(`${API_BASE}/api/complaints-feedback/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  async getBotProfiles(params = {}) {
    const url = new URL(`${API_BASE}/api/bot/profiles`, window.location.origin);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url.searchParams.append(key, params[key]);
      }
    });
    const res = await fetch(url.pathname + url.search);
    return handleResponse(res);
  },
};

