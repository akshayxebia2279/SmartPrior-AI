import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  AddOutlined,
  AnalyticsOutlined,
  AssignmentOutlined,
  CheckCircleOutline,
  DashboardOutlined,
  ErrorOutline,
  HealthAndSafetyOutlined,
  MedicalServicesOutlined,
  NotificationsOutlined,
  PersonOutline,
  SearchOutlined,
  ShieldOutlined,
  UploadFileOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import { BrowserRouter, Link as RouterLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { listPriorAuthorizations, listPatients, listProviders, listInsurancePlans, loginWithEmail, recordReviewerDecision, getApiBaseUrl, getAiAnalysis, createPriorAuthorization, triggerAiAnalysis, uploadDocument, triggerDocumentExtraction, consumeAuthNotice, updatePriorAuthorizationStatus } from './lib/api';

const STORAGE_TOKEN = 'smartprior_token';
const STORAGE_USER = 'smartprior_user';

type RoleName = 'ADMIN' | 'PROVIDER' | 'REVIEWER';

type UserProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  providerId?: string | null;
  role: { id: string; name: RoleName };
};

const statusMeta: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' }> = {
  DRAFT: { label: 'Draft', color: 'default' },
  SUBMITTED: { label: 'Submitted', color: 'primary' },
  UNDER_REVIEW: { label: 'Under Review', color: 'warning' },
  REQUEST_INFORMATION: { label: 'Information Required', color: 'warning' },
  APPROVED: { label: 'Approved', color: 'success' },
  REJECTED: { label: 'Denied', color: 'error' },
};

const roleLabel: Record<RoleName, string> = {
  ADMIN: 'Administrator',
  PROVIDER: 'Provider',
  REVIEWER: 'Reviewer',
};

// Production: do not use demo constants in UI

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const formatRecommendationLabel = (value?: string) => {
  switch (value) {
    case 'APPROVE_RECOMMENDATION':
      return 'APPROVE';
    case 'REJECT_RECOMMENDATION':
      return 'REJECT';
    case 'REQUEST_INFORMATION':
      return 'NEED MORE INFORMATION';
    default:
      return 'NEED MORE INFORMATION';
  }
};

const getRecommendationColor = (value?: string): 'success' | 'error' | 'warning' => {
  switch (value) {
    case 'APPROVE_RECOMMENDATION':
      return 'success';
    case 'REJECT_RECOMMENDATION':
      return 'error';
    default:
      return 'warning';
  }
};

const normalizeUrgencyPriority = (value?: string): 'ROUTINE' | 'URGENT' | 'EXPEDITED' => {
  const normalized = (value || '').trim().toUpperCase();

  switch (normalized) {
    case 'URGENT':
      return 'URGENT';
    case 'EXPEDITED':
      return 'EXPEDITED';
    case 'ROUTINE':
    default:
      return 'ROUTINE';
  }
};

const getPatientName = (record: any) => {
  const patient = record.patient || {};
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unknown patient';
};

const navItems = [
  { label: 'Dashboard', path: '/', icon: <DashboardOutlined fontSize="small" /> },
  { label: 'Authorizations', path: '/authorizations', icon: <MedicalServicesOutlined fontSize="small" /> },
  { label: 'New Authorization', path: '/authorizations/new', icon: <AddOutlined fontSize="small" /> },
  { label: 'Review Queue', path: '/review', icon: <AssignmentOutlined fontSize="small" /> },
  { label: 'AI Analysis', path: '/ai-analysis', icon: <HealthAndSafetyOutlined fontSize="small" /> },
  { label: 'Analytics', path: '/analytics', icon: <AnalyticsOutlined fontSize="small" /> },
  { label: 'Notifications', path: '/notifications', icon: <NotificationsOutlined fontSize="small" /> },
  { label: 'Administration', path: '/admin', icon: <ShieldOutlined fontSize="small" /> },
];

const fallbackRows: any[] = [];

const useStoredUser = () => {
  const [user, setUserState] = useState<UserProfile | null>(() => {
    const savedUser = localStorage.getItem(STORAGE_USER);
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setTokenState] = useState<string>(() => localStorage.getItem(STORAGE_TOKEN) || '');

  const setUser = (nextUser: UserProfile | null) => {
    setUserState(nextUser);
    if (nextUser) {
      localStorage.setItem(STORAGE_USER, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(STORAGE_USER);
    }
  };

  const setToken = (nextToken: string) => {
    setTokenState(nextToken);
    if (nextToken) {
      localStorage.setItem(STORAGE_TOKEN, nextToken);
    } else {
      localStorage.removeItem(STORAGE_TOKEN);
    }
  };

  return { user, setUser, token, setToken };
};

const AppShell = ({ user, onLogout }: { user: UserProfile; onLogout: () => void }) => {
  const location = useLocation();
  const pageTitle = navItems.find((item) => item.path === location.pathname)?.label || 'Dashboard';
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Box
        sx={{
          width: 260,
          bgcolor: '#fff',
          borderRight: '1px solid #e2e8f0',
          p: 2,
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1.5, pb: 3 }}>
          <Avatar sx={{ bgcolor: '#0f6fff', width: 36, height: 36 }}>
            <HealthAndSafetyOutlined fontSize="small" />
          </Avatar>
          <Typography variant="h6" fontWeight={800} color="#0f172a">
            SmartPrior <Box component="span" sx={{ color: '#0f6fff' }}>AI</Box>
          </Typography>
        </Stack>

        <List disablePadding>
          {navItems.map(({ label, path, icon }) => {
            const selected = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
            return (
              <ListItemButton
                key={path}
                component={RouterLink}
                to={path}
                selected={selected}
                sx={{
                  borderRadius: 2,
                  mb: 0.75,
                  '&.Mui-selected': {
                    backgroundColor: '#e0f2fe',
                    color: '#0f172a',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: selected ? '#0f6fff' : '#475569' }}>{icon}</ListItemIcon>
                <ListItemText primary={label} primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }} />
              </ListItemButton>
            );
          })}
        </List>

        <Box sx={{ mt: 'auto', p: 2, border: '1px solid #e2e8f0', borderRadius: 3, background: '#f8fafc' }}>
          <Typography variant="caption" color="text.secondary" textTransform="uppercase" sx={{ letterSpacing: 0.8 }}>
            Help & Support
          </Typography>
          <Typography variant="body2" fontWeight={600} mt={1.5}>
            Clinical support team
          </Typography>
          <Button variant="outlined" size="small" sx={{ mt: 1.5, borderRadius: 2 }}>
            Contact Support
          </Button>
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <Toolbar sx={{ minHeight: 74, px: { xs: 2, lg: 4 } }}>
            <Typography variant="h5" fontWeight={700} color="#0f172a" sx={{ flexGrow: 1 }}>
              {pageTitle}
            </Typography>

            <TextField
              size="small"
              placeholder="Search authorizations"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 240, display: { xs: 'none', md: 'block' }, bgcolor: '#f8fafc', borderRadius: 2 }}
            />

            <IconButton color="primary" sx={{ ml: 2 }}>
              <Badge badgeContent={4} color="error">
                <NotificationsOutlined />
              </Badge>
            </IconButton>

            <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: '#dbeafe', color: '#0f6fff', width: 36, height: 36 }}>
                <PersonOutline fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight={700} color="#0f172a">
                  {user.firstName} {user.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {roleLabel[user.role.name]}
                </Typography>
              </Box>
              <Button size="small" color="inherit" onClick={(event) => setAnchorEl(event.currentTarget)}>Profile</Button>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={() => { setAnchorEl(null); onLogout(); }}>Sign out</MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Outlet context={{ user }} />
        </Container>
      </Box>
    </Box>
  );
};

const ProtectedLayout = ({ user, onLogout }: { user: UserProfile; onLogout: () => void }) => {
  return <AppShell user={user} onLogout={onLogout} />;
};

const DashboardPage = ({ user }: { user: UserProfile }) => {
  const [rows, setRows] = useState<any[]>(fallbackRows);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPriorAuthorizations()
      .then((payload) => {
        if (active) {
          setRows((payload.items && payload.items.length ? payload.items : fallbackRows) as any[]);
        }
      })
      .catch(() => {
        if (active) setRows(fallbackRows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeSize = rows.filter((row) => ['SUBMITTED', 'UNDER_REVIEW', 'REQUEST_INFORMATION'].includes(row.status)).length;
  const approved = rows.filter((row) => row.status === 'APPROVED').length;
  const requiresInfo = rows.filter((row) => row.status === 'REQUEST_INFORMATION').length;

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.1 }}>
              Provider overview
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a">
              Good morning, {user.firstName}
            </Typography>
            <Typography variant="body1" color="text.secondary" mt={1}>
              Manage prior authorizations and track requests.
            </Typography>
          </Box>
          <Button component={RouterLink} to="/authorizations/new" variant="contained" size="large" sx={{ borderRadius: 2, px: 3, py: 1.2 }}>
            + New Prior Authorization
          </Button>
        </Stack>
      </Paper>

      <Grid container spacing={3}>
        {[
          { label: 'Active Authorizations', value: rows.length, color: '#0f6fff', icon: <AssignmentOutlined /> },
          { label: 'Pending Review', value: activeSize, color: '#f59e0b', icon: <WarningAmberOutlined /> },
          { label: 'Approved', value: approved, color: '#16a34a', icon: <CheckCircleOutline /> },
          { label: 'Requires Information', value: requiresInfo, color: '#ef4444', icon: <ErrorOutline /> },
        ].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.label}>
            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography variant="h4" fontWeight={800} color="#0f172a">{item.value}</Typography>
                  </Stack>
                  <Avatar sx={{ bgcolor: `${item.color}1A`, color: item.color, width: 42, height: 42 }}>{item.icon}</Avatar>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>Recent Authorizations</Typography>
          <Button component={RouterLink} to="/authorizations" variant="text" color="primary">View all</Button>
        </Stack>

        {loading ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Authorization ID</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Procedure</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, 5).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.externalReference || row.id}</TableCell>
                    <TableCell>{getPatientName(row)}</TableCell>
                    <TableCell>{row.requestedProcedureName || '—'}</TableCell>
                    <TableCell>
                      <Chip label={statusMeta[row.status]?.label || row.status} color={statusMeta[row.status]?.color || 'default'} size="small" />
                    </TableCell>
                    <TableCell>{formatDate(row.submittedAt)}</TableCell>
                    <TableCell>{formatDate(row.updatedAt)}</TableCell>
                    <TableCell align="right">
                      <Button component={RouterLink} to={`/authorizations/${row.id}`} size="small" variant="outlined">Open</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  );
};

const NewAuthorizationPage = () => {
  const navigate = useNavigate();
  // Synchronous redirect when no token exists to avoid ephemeral client-side access.
  if (typeof window !== 'undefined') {
    const _t = localStorage.getItem(STORAGE_TOKEN);
    if (!_t) return <Navigate to="/login" replace />;
  }
  const [form, setForm] = useState({
    patientId: '',
    providerId: '',
    insurancePlanId: '',
    patientName: 'Dorian Parker',
    dob: '1991-05-14',
    memberId: 'MEM-1001',
    provider: 'North Harbor Family Clinic',
    insurancePlan: 'Summit Essential PPO',
    requestedService: 'Intravitreal Injection',
    diagnosis: 'Chronic retinal condition requiring specialist treatment',
    clinicalIndication: 'Medical necessity supported by chronic retinal condition and prior treatment history.',
    urgency: 'Routine',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'failed'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<any[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  

  useEffect(() => {
    let active = true;

    const loadReferenceData = async () => {
      try {
        setReferenceLoading(true);
        const [patientRes, providerRes, planRes] = await Promise.all([
          listPatients(),
          listProviders(),
          listInsurancePlans(),
        ]);

        if (!active) return;

        const nextPatients = patientRes.items ?? [];
        const nextProviders = providerRes.items ?? [];
        const nextPlans = planRes.items ?? [];

        setPatients(nextPatients);
        setProviders(nextProviders);
        setInsurancePlans(nextPlans);

        const defaultPatient = nextPatients.find((item) => item.memberId === 'MEM-1001') || nextPatients[0];
        if (defaultPatient) {
          setForm((current) => ({
            ...current,
            patientId: defaultPatient.id,
            patientName: `${defaultPatient.firstName ?? ''} ${defaultPatient.lastName ?? ''}`.trim() || defaultPatient.memberId || 'Unknown patient',
            memberId: defaultPatient.memberId || current.memberId,
          }));
        }

        const defaultProvider = nextProviders.find((item) => item.name === 'North Harbor Family Clinic') || nextProviders[0];
        if (defaultProvider) {
          setForm((current) => ({ ...current, providerId: defaultProvider.id, provider: defaultProvider.name }));
        }

        const defaultPlan = nextPlans.find((item) => item.name === 'Summit Essential PPO') || nextPlans[0];
        if (defaultPlan) {
          setForm((current) => ({ ...current, insurancePlanId: defaultPlan.id, insurancePlan: defaultPlan.name }));
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Unable to load patient, provider, and insurance plan records.');
        }
      } finally {
        if (active) setReferenceLoading(false);
      }
    };

    loadReferenceData();

    return () => {
      active = false;
    };
  }, []);

  const updateField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      setUploadState('idle');
      setUploadError(null);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setSelectedFile(null);
      setUploadState('failed');
      setUploadError('Only PDF files are supported.');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setUploadState('idle');
  };

  const handleSubmit = async () => {
    if (!form.patientId || !form.providerId || !form.insurancePlanId || !form.requestedService) {
      setError('Please complete required fields before submitting.');
      return;
    }

    setError(null);
    setProcessing(true);

    try {
      const payload = {
        patientId: form.patientId,
        providerId: form.providerId,
        insurancePlanId: form.insurancePlanId,
        requestedProcedureCode: form.requestedService,
        requestedProcedureName: form.requestedService,
        diagnosisDescription: form.diagnosis,
        requestNotes: form.clinicalIndication,
        priority: normalizeUrgencyPriority(form.urgency),
      };

      const createResp = await createPriorAuthorization(payload);
      const pa = createResp.priorAuthorization;
      if (!pa || !pa.id) throw new Error('Failed to create prior authorization');

      // 2) Upload selected document (if any)
      if (selectedFile) {
        setUploadState('uploading');
        const uploadResp = await uploadDocument(pa.id, selectedFile);
        const doc = (uploadResp && uploadResp.document) || uploadResp;
        setUploadState('processing');

        // 3) Trigger extraction
        if (doc && doc.id) {
          await triggerDocumentExtraction(doc.id);
        }
      }

      // 4) Trigger AI analysis
      setProcessing(true);
      await triggerAiAnalysis(pa.id);
      await updatePriorAuthorizationStatus(pa.id, 'SUBMITTED');

      // Success: navigate to authorization page
      setSubmitted(true);
      navigate(`/authorizations/${pa.id}`);
    } catch (err: any) {
      setError(err?.message || 'Submission failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Stack spacing={3}>
      {submitted && <Alert severity="success">Authorization created and submitted for AI analysis.</Alert>}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Typography variant="h5" fontWeight={800} mb={3}>Create Prior Authorization</Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
              <TextField
                select
                label="Patient"
                fullWidth
                value={form.patientId}
                onChange={(e) => {
                  const patientId = e.target.value;
                  const patient = patients.find((item) => item.id === patientId);
                  setForm((current) => ({
                    ...current,
                    patientId,
                    patientName: patient ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || patient.memberId || 'Unknown patient' : current.patientName,
                    memberId: patient?.memberId || current.memberId,
                  }));
                }}
                SelectProps={{ native: true }}
                disabled={referenceLoading}
              >
                <option value="">Select patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {`${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || patient.memberId} — {patient.memberId || 'No member ID'}
                  </option>
                ))}
              </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Date of Birth" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.dob} onChange={(e) => updateField('dob', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Member ID" fullWidth value={form.memberId} onChange={(e) => updateField('memberId', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              label="Provider"
              fullWidth
              value={form.providerId}
              onChange={(e) => {
                const providerId = e.target.value;
                const provider = providers.find((item) => item.id === providerId);
                setForm((current) => ({ ...current, providerId, provider: provider ? provider.name : current.provider }));
              }}
              SelectProps={{ native: true }}
              disabled={referenceLoading}
            >
              <option value="">Select provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              label="Insurance Plan"
              fullWidth
              value={form.insurancePlanId}
              onChange={(e) => {
                const insurancePlanId = e.target.value;
                const plan = insurancePlans.find((item) => item.id === insurancePlanId);
                setForm((current) => ({ ...current, insurancePlanId, insurancePlan: plan ? plan.name : current.insurancePlan }));
              }}
              SelectProps={{ native: true }}
              disabled={referenceLoading}
            >
              <option value="">Select insurance plan</option>
              {insurancePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Requested Service" fullWidth value={form.requestedService} onChange={(e) => updateField('requestedService', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Diagnosis" fullWidth value={form.diagnosis} onChange={(e) => updateField('diagnosis', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Urgency" fullWidth value={form.urgency} onChange={(e) => updateField('urgency', e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Clinical Indication" multiline rows={4} fullWidth value={form.clinicalIndication} onChange={(e) => updateField('clinicalIndication', e.target.value)} />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Typography variant="h6" fontWeight={700} mb={2}>Documents</Typography>
        <Box sx={{ border: '2px dashed #cbd5e1', borderRadius: 3, p: 5, textAlign: 'center', bgcolor: '#f8fafc' }}>
          <UploadFileOutlined sx={{ fontSize: 40, color: '#0f6fff', mb: 1.5 }} />
          <Typography variant="body1" fontWeight={600}>Upload PDF clinical documentation</Typography>
          <Typography variant="body2" color="text.secondary">Only PDF files are supported.</Typography>
          <Button component="label" variant="outlined" sx={{ mt: 2 }}>
            Select PDF
            <input type="file" accept="application/pdf" hidden onChange={handleFileChange} />
          </Button>
        </Box>

        {selectedFile && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={3} alignItems="center" justifyContent="space-between">
            <Chip label={selectedFile.name} variant="outlined" sx={{ borderRadius: 2 }} />
            <Typography variant="body2" color="text.secondary">
              {uploadState === 'idle' && 'Ready to upload'}
              {uploadState === 'uploading' && 'Uploading...'}
              {uploadState === 'processing' && 'Processing...'}
              {uploadState === 'success' && 'Extracted successfully'}
              {uploadState === 'failed' && 'Upload or extraction failed'}
            </Typography>
          </Stack>
        )}

        {uploadError && <Alert severity="error" sx={{ mt: 2 }}>{uploadError}</Alert>}
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Typography variant="h6" fontWeight={700} mb={2}>Review & Submit</Typography>
        <Stack spacing={1.5}>
          <Typography variant="body2"><strong>Patient:</strong> {form.patientName}</Typography>
          <Typography variant="body2"><strong>Service:</strong> {form.requestedService}</Typography>
          <Typography variant="body2"><strong>Diagnosis:</strong> {form.diagnosis}</Typography>
          <Typography variant="body2"><strong>Urgency:</strong> {form.urgency}</Typography>
        </Stack>
        <Stack direction="row" spacing={2} mt={3}>
          <Button variant="contained" onClick={handleSubmit} disabled={processing || uploadState === 'uploading' || uploadState === 'processing'}>
            {processing ? 'Submitting...' : 'Submit for AI Analysis'}
          </Button>
          <Button variant="outlined">Save Draft</Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>
    </Stack>
  );
};

const ReviewQueuePage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [decision, setDecision] = useState<{ id: string; message: string; severity?: 'success' | 'error' } | null>(null);

  useEffect(() => {
    let active = true;
    listPriorAuthorizations()
      .then((payload) => {
        if (active) setRows((payload.items && payload.items.length ? payload.items : []) as any[]);
      })
      .catch(() => {
        if (active) setRows([]);
      });
    return () => { active = false; };
  }, []);

  const handleDecision = async (id: string, action: 'APPROVED' | 'REJECTED', reason: string) => {
    try {
      await recordReviewerDecision(id, action, reason);
      setDecision({ id, message: action === 'APPROVED' ? 'Authorization approved' : 'Authorization denied', severity: 'success' });
    } catch (err: any) {
      setDecision({ id, message: err?.message || 'Failed to record reviewer decision. Please retry.', severity: 'error' });
    }
  };

  return (
    <Stack spacing={3}>
      {decision && <Alert severity="success">{decision.message}</Alert>}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Typography variant="h5" fontWeight={800} mb={3}>Review Queue</Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Authorization</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.filter((row) => ['UNDER_REVIEW', 'REQUEST_INFORMATION', 'SUBMITTED'].includes(row.status)).map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.externalReference || row.id}</TableCell>
                  <TableCell>{getPatientName(row)}</TableCell>
                  <TableCell>{row.requestedProcedureName}</TableCell>
                  <TableCell><Chip label={statusMeta[row.status]?.label || row.status} color={statusMeta[row.status]?.color || 'default'} size="small" /></TableCell>
                  <TableCell>{row.priority}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button component={RouterLink} to={`/authorizations/${row.id}`} size="small" variant="outlined">Open</Button>
                      <Button size="small" color="success" onClick={() => handleDecision(row.id, 'APPROVED', 'Supported by submitted documentation and clinician assessment.')}>Approve</Button>
                      <Button size="small" color="error" onClick={() => handleDecision(row.id, 'REJECTED', 'Required evidence is incomplete or policy criteria are not met.')}>Deny</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
};

const AIAnalysisPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalyses = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await listPriorAuthorizations();
      const items = payload.items && payload.items.length ? payload.items : [];
      setRows(items as any[]);
      const map: Record<string, any> = {};
      await Promise.all(items.map(async (item: any) => {
        try {
          map[item.id] = await getAiAnalysis(item.id);
        } catch {
          map[item.id] = null;
        }
      }));
      setAnalyses(map);
    } catch (err: any) {
      setError(err?.message || 'Unable to load AI analysis queue.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalyses();
  }, []);

  if (loading) {
    return <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} mb={2}>
          <Typography variant="h5" fontWeight={800}>AI Analysis Queue</Typography>
          <Button variant="outlined" onClick={() => void loadAnalyses()}>Refresh</Button>
        </Stack>

        <Typography variant="body1" color="text.secondary" mb={3}>AI-assisted recommendation — final decision must be made by an authorized human reviewer.</Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!rows.length ? (
          <Alert severity="info">No prior authorizations available for AI review.</Alert>
        ) : rows.map((row) => {
          const analysis = analyses[row.id];
          const recommendationValue = analysis?.recommendation?.recommendation || analysis?.analysis?.recommendation || null;
          const recommendationLabel = recommendationValue ? formatRecommendationLabel(recommendationValue) : 'Analysis not available';
          const analysisAvailable = Boolean(analysis && analysis.analysis);
          const lastAnalyzed = analysisAvailable ? (analysis.analysis.completedAt || analysis.analysis.updatedAt || analysis.analysis.createdAt) : null;

          return (
            <Card key={row.id} elevation={0} sx={{ border: '1px solid #dbeafe', borderRadius: 3, mb: 2 }}>
              <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Authorization ID</Typography>
                    <Typography variant="subtitle2" color="primary.main" sx={{ wordBreak: 'break-all' }}>{row.externalReference || row.id}</Typography>
                    <Typography variant="h6" fontWeight={700}>{row.requestedProcedureName || 'No procedure recorded'}</Typography>
                  </Box>
                  <Chip label={statusMeta[row.status]?.label || row.status} color={statusMeta[row.status]?.color || 'default'} size="small" />
                </Stack>

                <Grid container spacing={2} mt={0.5}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">Patient</Typography>
                    <Typography variant="body2">{getPatientName(row)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">Diagnosis</Typography>
                    <Typography variant="body2">{row.diagnosisDescription || row.diagnosisCode || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">Last analyzed</Typography>
                    <Typography variant="body2">{analysisAvailable ? formatDateTime(lastAnalyzed) : '—'}</Typography>
                  </Grid>
                </Grid>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mt={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Chip label={analysisAvailable ? `AI recommendation: ${recommendationLabel}` : 'Analysis not available'} color={analysisAvailable ? getRecommendationColor(recommendationValue) : 'default'} size="small" />
                    <Chip label={analysisAvailable ? `Analysis status: ${analysis.analysis.analysisStatus || 'COMPLETED'}` : 'No analysis'} variant="outlined" size="small" />
                  </Stack>

                  {analysisAvailable ? (
                    <Button variant="contained" onClick={() => navigate(`/ai-analysis/${row.id}`)}>View Analysis</Button>
                  ) : (
                    <Button variant="outlined" onClick={async () => {
                      try {
                        await triggerAiAnalysis(row.id);
                        await loadAnalyses();
                      } catch (err: any) {
                        setError(err?.message || 'Unable to trigger AI analysis.');
                      }
                    }}>Trigger Analysis</Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Paper>
    </Stack>
  );
};

const AIAnalysisDetailPage = () => {
  const { id } = useParams();
  const [authorization, setAuthorization] = useState<any | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        setError('Authorization ID is missing.');
        setLoading(false);
        return;
      }

      try {
        const payload = await listPriorAuthorizations();
        const matches = payload.items && payload.items.length ? payload.items : [];
        const auth = matches.find((item: any) => item.id === id) || null;

        if (active) {
          setAuthorization(auth);
        }

        const analysisData = await getAiAnalysis(id);
        if (active) {
          setAnalysis(analysisData);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Analysis not available.');
          setAnalysis(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  }

  if (error || !analysis || !analysis.analysis) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Alert severity="info">Analysis not available.</Alert>
      </Paper>
    );
  }

  const recommendationValue = analysis.recommendation?.recommendation || analysis.analysis.recommendation || 'REQUEST_INFORMATION';
  const recommendationLabel = formatRecommendationLabel(recommendationValue);
  const criteriaFindings = Array.isArray(analysis.analysis.criteriaFindings) ? analysis.analysis.criteriaFindings : [];
  const missingDocuments = Array.isArray(analysis.analysis.missingDocuments) ? analysis.analysis.missingDocuments : [];
  const explainability = analysis.analysis.explainability || {};
  const summary = authorization || {};

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">Authorization</Typography>
            <Typography variant="h5" fontWeight={800}>{summary.externalReference || summary.id || id}</Typography>
            <Typography variant="body2" color="text.secondary">{getPatientName(summary)} · {summary.requestedProcedureName || 'No procedure recorded'}</Typography>
          </Box>
          <Chip label={statusMeta[summary.status]?.label || summary.status || 'Unknown'} color={statusMeta[summary.status]?.color || 'default'} />
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Typography variant="h5" fontWeight={800} mb={2}>AI Analysis</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>AI-assisted recommendation — final decision must be made by an authorized human reviewer.</Alert>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={700}>Recommendation</Typography>
            <Chip label={recommendationLabel} color={getRecommendationColor(recommendationValue)} sx={{ mt: 1 }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={700}>Confidence</Typography>
            <Typography variant="body1" sx={{ mt: 1 }}>
              {analysis.analysis.confidenceScore != null ? `${(analysis.analysis.confidenceScore * 100).toFixed(0)}%` : 'Not available'}
            </Typography>
            {analysis.analysis.modelProvider && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Model: {analysis.analysis.modelProvider} {analysis.analysis.modelVersion ? `· ${analysis.analysis.modelVersion}` : ''}
              </Typography>
            )}
          </Grid>
        </Grid>

        <Stack spacing={2} mt={3}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Clinical Summary</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{analysis.analysis.clinicalSummary || 'No clinical summary provided.'}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Criteria Findings</Typography>
            {criteriaFindings.length ? (
              <Stack spacing={1} mt={1}>
                {criteriaFindings.map((item: any, index: number) => (
                  <Box key={`${item.ruleCode || 'rule'}-${index}`} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2 }}>
                    <Typography variant="body2" fontWeight={700}>{item.ruleName || item.ruleCode || 'Criterion'} · {item.result || 'Unknown'}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.details || 'No details provided.'}</Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No criteria findings reported.</Typography>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Missing Documents</Typography>
            {missingDocuments.length ? (
              <ul style={{ marginTop: '8px', marginBottom: 0 }}>
                {missingDocuments.map((item: string, index: number) => <li key={`${item}-${index}`}>{item}</li>)}
              </ul>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No missing documents reported.</Typography>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Explainability / Evidence</Typography>
            <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', marginTop: '8px', marginBottom: 0, background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
              {JSON.stringify(explainability, null, 2) || 'No explainability data reported.'}
            </pre>
          </Box>

          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Raw Recommendation Rationale</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{analysis.recommendation?.rationale || 'No rationale provided.'}</Typography>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
};

const AuthorizationsPage = () => {
  const [rows, setRows] = useState<any[]>(fallbackRows);
  useEffect(() => {
    listPriorAuthorizations().then((payload) => { setRows((payload.items && payload.items.length ? payload.items : fallbackRows) as any[]); }).catch(() => setRows(fallbackRows));
  }, []);

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={800}>Prior Authorizations</Typography>
        <Button component={RouterLink} to="/authorizations/new" variant="contained">+ New</Button>
      </Stack>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Patient</TableCell>
              <TableCell>Procedure</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Submitted</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.externalReference || row.id}</TableCell>
                <TableCell>{getPatientName(row)}</TableCell>
                <TableCell>{row.requestedProcedureName || '—'}</TableCell>
                <TableCell><Chip label={statusMeta[row.status]?.label || row.status} color={statusMeta[row.status]?.color || 'default'} size="small" /></TableCell>
                <TableCell>{formatDate(row.submittedAt)}</TableCell>
                <TableCell>
                  <Button component={RouterLink} to={`/authorizations/${row.id}`} size="small" variant="outlined">Open</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

const AuthorizationDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useMemo(() => ({ id: window.location.pathname.split('/').at(-1) || '' }), [window.location.pathname]);
  const [tab, setTab] = useState('overview');
  const [rows, setRows] = useState<any[]>(fallbackRows);
  const item = rows.find((row) => row.id === id) || rows[0];
  const location = useLocation();
  const navState: any = (location && (location.state as any)) || {};
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(navState.analysisError || null);
  const [analysis, setAnalysis] = useState<any | null>(navState.analysis || null);

  useEffect(() => {
    listPriorAuthorizations().then((payload) => { setRows((payload.items && payload.items.length ? payload.items : fallbackRows) as any[]); }).catch(() => setRows(fallbackRows));
  }, []);

  if (!item) {
    return <Alert severity="warning">Authorization was not found.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary" letterSpacing={1}>Authorization #{item.externalReference || item.id}</Typography>
            <Typography variant="h4" fontWeight={800}>{getPatientName(item)}</Typography>
            <Stack direction="row" spacing={1} mt={1}>
              <Chip label={statusMeta[item.status]?.label || item.status} color={statusMeta[item.status]?.color || 'default'} />
              <Chip label={item.priority || 'Routine'} variant="outlined" />
            </Stack>
          </Box>
          <Button variant="outlined" onClick={() => navigate('/review')}>Back to review queue</Button>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
          <Tab value="overview" label="Overview" />
          <Tab value="documents" label="Documents" />
          <Tab value="ai-analysis" label="AI Analysis" />
          <Tab value="rule-validation" label="Rule Validation" />
          <Tab value="review" label="Review" />
          <Tab value="audit" label="Audit History" />
        </Tabs>
      </Paper>

      {tab === 'overview' && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
              <Typography variant="h6" fontWeight={700} mb={2}>Request Summary</Typography>
              <Stack spacing={1.5}>
                <Typography variant="body2"><strong>Requested service:</strong> {item.requestedProcedureName}</Typography>
                <Typography variant="body2"><strong>Diagnosis:</strong> {item.diagnosisDescription}</Typography>
                <Typography variant="body2"><strong>Urgency:</strong> {item.priority}</Typography>
                <Typography variant="body2"><strong>Provider:</strong> {item.provider?.name || 'North Harbor Family Clinic'}</Typography>
                <Typography variant="body2"><strong>Insurance plan:</strong> {item.insurancePlan?.name || 'Summit Essential PPO'}</Typography>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
              <Typography variant="h6" fontWeight={700} mb={2}>Review Timeline</Typography>
              {[
                'Created',
                'Documents uploaded',
                'AI analysis',
                'Rule validation',
                'Submitted for review',
                'Reviewer decision',
              ].map((entry, index) => (
                <Stack key={entry} direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: index <= 3 ? '#0f6fff' : '#cbd5e1' }} />
                  <Typography variant="body2">{entry}</Typography>
                </Stack>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}

      {tab === 'documents' && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
          <Typography variant="h6" fontWeight={700} mb={2}>Clinical documents</Typography>
          <Stack spacing={2}>
            <Alert severity="info">Document processing status: In progress</Alert>
            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2 }}>
              <Typography variant="body1" fontWeight={700}>Clinical Notes.pdf</Typography>
              <Typography variant="body2" color="text.secondary">Uploaded • AI processing</Typography>
            </Box>
            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2 }}>
              <Typography variant="body1" fontWeight={700}>Imaging Report.pdf</Typography>
              <Typography variant="body2" color="text.secondary">Uploaded • Evidence extraction</Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      {tab === 'ai-analysis' && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
          <Typography variant="h6" fontWeight={700} mb={2}>AI Clinical Analysis</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>AI recommendation is advisory. Final authorization decision must be made by an authorized human reviewer.</Alert>

          {analysisLoading ? (
            <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Analyzing authorization...</Typography>
            </Box>
          ) : analysisError ? (
            <Stack spacing={2}>
              <Alert severity="error">Authorization created, but AI analysis could not be completed. {analysisError}</Alert>
              <Stack direction="row" spacing={2}>
                <Button variant="contained" onClick={async () => {
                  setAnalysisError(null);
                  setAnalysisLoading(true);
                  try {
                    await triggerAiAnalysis(item.id);
                    const fresh = await getAiAnalysis(item.id);
                    setAnalysis(fresh);
                  } catch (err: any) {
                    setAnalysisError(err?.message || 'Analysis failed.');
                  } finally {
                    setAnalysisLoading(false);
                  }
                }}>Retry Analysis</Button>
              </Stack>
            </Stack>
          ) : !analysis ? (
            <Stack spacing={2}>
              <Alert severity="info">No AI analysis available for this authorization.</Alert>
              <Button variant="outlined" onClick={async () => {
                setAnalysisLoading(true);
                setAnalysisError(null);
                try {
                  const res = await triggerAiAnalysis(item.id);
                  setAnalysis(res);
                } catch (err: any) {
                  setAnalysisError(err?.message || 'Analysis failed.');
                } finally {
                  setAnalysisLoading(false);
                }
              }}>Run AI Analysis</Button>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={700}>Clinical Summary</Typography>
              <Typography>{analysis.analysis?.clinicalSummary || '—'}</Typography>

              <Typography variant="subtitle1" fontWeight={700}>Evidence / Findings</Typography>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(analysis.analysis?.criteriaFindings || analysis.analysis?.explainability || {}, null, 2)}</pre>

              <Typography variant="subtitle1" fontWeight={700}>Rule Validation</Typography>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(analysis.analysis?.ruleValidationResults || analysis.ruleValidationResults || {}, null, 2)}</pre>

              <Typography variant="subtitle1" fontWeight={700}>Recommendation</Typography>
              <Typography>{analysis.recommendation?.summary || analysis.recommendation?.text || '—'}</Typography>

              <Typography variant="subtitle1" fontWeight={700}>Confidence</Typography>
              <Typography>{analysis.analysis?.confidenceScore != null ? `${Math.round(analysis.analysis.confidenceScore * 100)}%` : '—'}</Typography>

              <Typography variant="subtitle1" fontWeight={700}>Missing Information</Typography>
              <Typography>{(analysis.analysis?.missingDocuments && analysis.analysis.missingDocuments.length) ? analysis.analysis.missingDocuments.join(', ') : 'None reported'}</Typography>

              <Alert severity="info">AI recommendation is advisory. Final authorization decision must be made by an authorized human reviewer.</Alert>
            </Stack>
          )}
        </Paper>
      )}

      {tab === 'rule-validation' && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
          <Typography variant="h6" fontWeight={700} mb={2}>Rule Validation</Typography>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Rule</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Evidence</TableCell>
                <TableCell>Explanation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                { rule: 'Medical Necessity', status: 'Supported', proof: '✓', explanation: 'Clinical documentation is consistent with requested treatment.' },
                { rule: 'Required Documentation', status: 'Missing', proof: '⚠', explanation: 'Additional imaging summary is recommended.' },
                { rule: 'Coverage Criteria', status: 'Meets Criteria', proof: '✓', explanation: 'Plan criteria are met with available evidence.' },
              ].map((rule) => (
                <TableRow key={rule.rule}>
                  <TableCell>{rule.rule}</TableCell>
                  <TableCell>{rule.status}</TableCell>
                  <TableCell>{rule.proof}</TableCell>
                  <TableCell>{rule.explanation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 'review' && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
          <Typography variant="h6" fontWeight={700} mb={2}>Reviewer Decision</Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>Reviewer decision required.</Alert>
          <Stack spacing={2}>
            <Button variant="contained" color="success">Approve</Button>
            <Button variant="contained" color="error">Deny</Button>
            <Button variant="outlined">Request More Information</Button>
          </Stack>
        </Paper>
      )}

      {tab === 'audit' && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
          <Typography variant="h6" fontWeight={700} mb={2}>Audit Trail</Typography>
          <Stack spacing={2}>
            {[
              'Authorization created',
              'Clinical documents uploaded',
              'AI analysis completed',
              'Rule validation completed',
              'Reviewer opened request',
              'Reviewer requested additional information',
            ].map((event, index) => (
              <Box key={event} sx={{ borderLeft: '3px solid #cbd5e1', pl: 2 }}>
                <Typography variant="body2" fontWeight={700}>{event}</Typography>
                <Typography variant="caption" color="text.secondary">{index + 1} day ago · System</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

const NotificationsPage = () => {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const check = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/health`);
      setAvailable(res.ok);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { check(); }, []);

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
      <Typography variant="h5" fontWeight={800} mb={3}>Notifications</Typography>
      {loading ? (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
      ) : available ? (
        <Typography>No notifications available.</Typography>
      ) : (
        <Stack spacing={2}>
          <Alert severity="info">Unable to load notifications from the backend.</Alert>
          <Button variant="outlined" onClick={check}>Retry</Button>
        </Stack>
      )}
    </Paper>
  );
};

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const check = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/health`);
      setAvailable(res.ok);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { check(); }, []);

  return (
    <Stack spacing={3}>
      {loading ? (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
      ) : available ? (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
          <Typography variant="h6" fontWeight={700}>Authorization analytics</Typography>
          <Typography>No analytics data available in this demo.</Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
          <Alert severity="info">Unable to load analytics from the backend.</Alert>
          <Button variant="outlined" onClick={check}>Retry</Button>
        </Paper>
      )}
    </Stack>
  );
};

const AdminPage = () => (
  <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#fff' }}>
    <Typography variant="h5" fontWeight={800} mb={3}>Administration</Typography>
    <Stack spacing={2}>
      <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2 }}>
        <Typography variant="h6">Users</Typography>
        <Typography color="text.secondary">Provider, reviewer, and admin access</Typography>
      </Box>
      <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2 }}>
        <Typography variant="h6">Audit log</Typography>
        <Typography color="text.secondary">Track reviewer decisions and workflow activity</Typography>
      </Box>
    </Stack>
  </Paper>
);

const LoginPage = ({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) => {
  const [email, setEmail] = useState('provider@smartprior-demo.local');
  const [password, setPassword] = useState('LocalTestPass123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => consumeAuthNotice());
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onLogin(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)', p: 3 }}>
      <Paper elevation={0} sx={{ maxWidth: 440, width: '100%', borderRadius: 4, border: '1px solid #dbeafe', p: { xs: 3, md: 4 }, bgcolor: '#fff' }}>
        <Stack alignItems="center" spacing={2} mb={3}>
          <Avatar sx={{ bgcolor: '#0f6fff', width: 52, height: 52 }}>
            <HealthAndSafetyOutlined />
          </Avatar>
          <Typography variant="h4" fontWeight={800}>SmartPrior AI</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            AI-assisted prior authorization platform.
          </Typography>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              Sign in with your organizational credentials.
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
};

const App = () => {
  const { user, setUser, setToken } = useStoredUser();

  const handleLogin = async (email: string, password: string) => {
    const response = await loginWithEmail(email, password);
    const nextUser = response.user;
    setToken(response.accessToken);
    setUser(nextUser);
    return nextUser;
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
  };

  const isAuthenticated = Boolean(user && typeof window !== 'undefined' && localStorage.getItem(STORAGE_TOKEN));

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route element={isAuthenticated ? <ProtectedLayout user={user!} onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<DashboardPage user={user!} />} />
          <Route path="/authorizations" element={<AuthorizationsPage />} />
          <Route path="/authorizations/new" element={<NewAuthorizationPage />} />
          <Route path="/authorizations/:id" element={<AuthorizationDetailPage />} />
          <Route path="/review" element={<ReviewQueuePage />} />
          <Route path="/ai-analysis" element={<AIAnalysisPage />} />
          <Route path="/ai-analysis/:id" element={<AIAnalysisDetailPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
