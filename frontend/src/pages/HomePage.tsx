import React from 'react';
import { Box, Paper, Typography, Grid, Card, CardContent, Alert, Stack, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorageIcon from '@mui/icons-material/Storage';
import SecurityIcon from '@mui/icons-material/Security';
import MemoryIcon from '@mui/icons-material/Memory';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
}

const fetchHealth = async (): Promise<HealthResponse> => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new Error('Failed to fetch backend health status');
  }
  return response.json();
};

export const HomePage: React.FC = () => {
  const { data: health, isLoading, error } = useQuery<HealthResponse>({
    queryKey: ['backend-health'],
    queryFn: fetchHealth,
    retry: 1,
  });

  return (
    <Box sx={{ py: 2 }}>
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 3, border: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)' }}>
        <Typography variant="h4" component="h1" fontWeight={700} gutterBottom color="#0f172a">
          SmartPrior AI
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph sx={{ maxWidth: 800 }}>
          SmartPrior AI assists authorized clinical reviewers with evidence-based decision support for prior authorizations. AI provides advisory analysis grounded in uploaded clinical documentation; final authorization decisions remain with authorized human reviewers.
        </Typography>
        <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
          <strong>AI-assisted recommendation:</strong> AI provides clinical summaries and supporting evidence. Reviewer decision is required to complete authorization.
        </Alert>
      </Paper>

      <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
        System Health & Services Status
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
                <MemoryIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Backend API Service
                </Typography>
              </Stack>
              {isLoading ? (
                <Stack direction="row" alignItems="center" spacing={1} py={1}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Checking API Health...</Typography>
                </Stack>
              ) : error ? (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  API Offline / Unreachable (Run <code>npm run dev:backend</code>)
                </Alert>
              ) : (
                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                    <CheckCircleOutlineIcon color="success" fontSize="small" />
                    <Typography variant="body2" fontWeight={600} color="success.main">
                      Status: {health?.status.toUpperCase()}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Service: {health?.service}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Uptime: {health?.uptime ? `${Math.floor(health.uptime)} seconds` : 'N/A'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
                <StorageIcon color="secondary" />
                <Typography variant="h6" fontWeight={600}>
                  Database & ORM
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Prisma ORM configured with PostgreSQL connection schema validation.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
                <SecurityIcon color="info" />
                <Typography variant="h6" fontWeight={600}>
                  Target Architecture Layering
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" paragraph>
                Strict Controller → Service → Repository → Prisma → PostgreSQL architecture configured.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
