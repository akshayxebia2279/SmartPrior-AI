const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
const AUTH_NOTICE_KEY = 'smartprior_auth_notice';
const STORAGE_TOKEN = 'smartprior_token';
const STORAGE_USER = 'smartprior_user';

const readToken = () => localStorage.getItem(STORAGE_TOKEN) || '';

export const clearStoredAuthSession = () => {
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_USER);
};

export const setAuthNotice = (message: string) => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(AUTH_NOTICE_KEY, message);
  }
};

export const consumeAuthNotice = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const message = sessionStorage.getItem(AUTH_NOTICE_KEY) || '';
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return message;
};

export const getApiBaseUrl = () => API_BASE_URL;

const handleExpiredSession = () => {
  clearStoredAuthSession();
  if (typeof window !== 'undefined') {
    setAuthNotice('Your session has expired. Please sign in again.');
    window.location.assign('/login');
  }
};

const createApiError = async (response: Response, path?: string) => {
  const rawBody = await response.text();
  // For authentication attempts, surface an invalid-credentials message instead
  // of the generic "session expired" text.
  const isLoginAttempt = !!path && path.includes('/auth/login');
  const fallbackMessage = response.status === 401
    ? (isLoginAttempt ? 'Invalid credentials. Please check your email and password.' : 'Your session has expired. Please sign in again.')
    : 'Request failed';

  const message = response.status === 401 ? fallbackMessage : (rawBody || fallbackMessage);

  const error = new Error(message) as Error & { status?: number; statusCode?: number };
  error.status = response.status;
  error.statusCode = response.status;
  return error;
};

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = readToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 && !path.includes('/auth/login')) {
      handleExpiredSession();
    }

    throw await createApiError(response, path);
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
};

export const loginWithEmail = async (email: string, password: string) => {
  return apiFetch<{ accessToken: string; user: any }>(`/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const getCurrentUser = async () => {
  return apiFetch<{ user: any }>(`/auth/me`);
};

export const listPriorAuthorizations = async () => {
  return apiFetch<{ items?: any[]; total?: number; page?: number; pageSize?: number }>(`/prior-authorizations`);
};

export const listPatients = async () => {
  return apiFetch<{ items?: any[] }>(`/patients`);
};

export const listProviders = async () => {
  return apiFetch<{ items?: any[] }>(`/providers`);
};

export const listInsurancePlans = async () => {
  return apiFetch<{ items?: any[] }>(`/insurance-plans`);
};

export const updatePriorAuthorizationStatus = async (id: string, status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'REQUEST_INFORMATION' | 'APPROVED' | 'REJECTED') => {
  return apiFetch<{ priorAuthorization: any }>(`/prior-authorizations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

export const createPriorAuthorization = async (payload: any) => {
  return apiFetch<{ priorAuthorization: any }>(`/prior-authorizations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getPriorAuthorization = async (id: string) => {
  return apiFetch<{ priorAuthorization: any }>(`/prior-authorizations/${id}`);
};

export const getAuthorizationDocuments = async (id: string) => {
  return apiFetch<any>(`/prior-authorizations/${id}/documents`);
};

export const uploadDocument = async (priorAuthorizationId: string, file: File, documentType = 'CLINICAL_NOTE') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('priorAuthorizationId', priorAuthorizationId);
  formData.append('documentType', documentType);
  formData.append('originalFileName', file.name);

  const token = readToken();
  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) {
      handleExpiredSession();
    }

    const body = await response.text();
    throw new Error(response.status === 401 ? 'Your session has expired. Please sign in again.' : (body || 'Document upload failed. Please try again.'));
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

export const triggerDocumentExtraction = async (documentId: string) => {
  return apiFetch<any>(`/documents/${documentId}/extraction`, {
    method: 'POST',
  });
};

export const getAiAnalysis = async (id: string) => {
  return apiFetch<any>(`/prior-authorizations/${id}/analysis`);
};

export const triggerAiAnalysis = async (id: string) => {
  return apiFetch<any>(`/prior-authorizations/${id}/analysis`, {
    method: 'POST',
  });
};

export const recordReviewerDecision = async (id: string, decision: 'APPROVED' | 'REJECTED', reason: string) => {
  return apiFetch<any>(`/prior-authorizations/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  });
};
