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

  // Classes
  async getClasses() {
    const res = await fetch(`${API_BASE}/api/classes`);
    return handleResponse(res);
  },

  async getClass(id) {
    const res = await fetch(`${API_BASE}/api/classes/${id}`);
    return handleResponse(res);
  },

  async createClass(data) {
    const res = await fetch(`${API_BASE}/api/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateClass(id, data) {
    const res = await fetch(`${API_BASE}/api/classes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteClass(id) {
    const res = await fetch(`${API_BASE}/api/classes/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Students
  async getStudents(params) {
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
  async getTemplates() {
    const res = await fetch(`${API_BASE}/api/templates`);
    return handleResponse(res);
  },

  async getTemplate(id) {
    const res = await fetch(`${API_BASE}/api/templates/${id}`);
    return handleResponse(res);
  },

  async syncTemplates() {
    const res = await fetch(`${API_BASE}/api/templates/sync`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  async createTemplate(data) {
    const res = await fetch(`${API_BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteTemplate(id) {
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
  async getCampaigns() {
    const res = await fetch(`${API_BASE}/api/campaigns`);
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

  // Message Logs
  async getMessageLogs(params) {
    const url = new URL(`${window.location.origin}/api/message-logs`);
    if (params?.campaign_id) url.searchParams.append('campaign_id', params.campaign_id.toString());
    if (params?.student_id) url.searchParams.append('student_id', params.student_id.toString());
    if (params?.status && params.status !== 'ALL') url.searchParams.append('status', params.status);
    if (params?.limit) url.searchParams.append('limit', params.limit.toString());

    const res = await fetch(url.pathname + url.search);
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
};
