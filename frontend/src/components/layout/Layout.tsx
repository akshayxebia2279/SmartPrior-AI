import React from 'react';
import { Box, Container } from '@mui/material';
import { Header } from './Header';
import { Navigation } from './Navigation';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Header />
      <Navigation />
      <Container maxWidth="lg" component="main" sx={{ flexGrow: 1, pb: 6 }}>
        {children}
      </Container>
    </Box>
  );
};
