const API_BASE = ''; // Uses Vite proxy in development or direct host in production

async function handleResponse(response) {
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
  // Health
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
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

  // Templates
  async getTemplates() {
    const res = await fetch(`${API_BASE}/api/templates`);
    return handleResponse(res);
  },

  async getTemplate(id) {
    const res = await fetch(`${API_BASE}/api/templates/${id}`);
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
