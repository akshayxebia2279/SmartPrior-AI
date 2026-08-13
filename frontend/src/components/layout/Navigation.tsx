import React from 'react';
import { Box, Tabs, Tab, Paper } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';

export const Navigation: React.FC = () => {
  const location = useLocation();
  const currentTab = location.pathname;

  return (
    <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Box sx={{ maxWidth: 1200, margin: '0 auto', px: 2 }}>
        <Tabs value={currentTab === '/' ? '/' : false} indicatorColor="primary" textColor="primary">
          <Tab
            label="Foundation Overview"
            value="/"
            component={Link}
            to="/"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          />
          <Tab label="Prior Authorization (Placeholder)" disabled sx={{ textTransform: 'none' }} />
          <Tab label="Reviewer Workspace (Placeholder)" disabled sx={{ textTransform: 'none' }} />
          <Tab label="Analytics (Placeholder)" disabled sx={{ textTransform: 'none' }} />
        </Tabs>
      </Box>
    </Paper>
  );
};
