import { Outlet } from 'react-router-dom';

import { Footer } from './Footer.js';
import { Navbar } from './Navbar.js';
import { PageTransition } from '../feedback/PageTransition.js';
import { ScanlineOverlay } from '../feedback/ScanlineOverlay.js';

export const MainLayout = () => (
  <>
    <Navbar />
    <main className="min-h-[80vh]">
      <PageTransition>
        <Outlet />
      </PageTransition>
    </main>
    <Footer />
    <ScanlineOverlay />
  </>
);

export default MainLayout;
