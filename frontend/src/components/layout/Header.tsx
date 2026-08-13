import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip } from '@mui/material';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';

export const Header: React.FC = () => {
  return (
    <AppBar position="static" elevation={1} sx={{ backgroundColor: '#0f172a' }}>
      <Toolbar>
        <HealthAndSafetyIcon sx={{ mr: 1.5, color: '#38bdf8' }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 0.5 }}>
          SmartPrior <Box component="span" sx={{ color: '#38bdf8' }}>AI</Box>
        </Typography>
        <Chip
          label="Initial Foundation"
          size="small"
          sx={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600 }}
        />
      </Toolbar>
    </AppBar>
  );
};
