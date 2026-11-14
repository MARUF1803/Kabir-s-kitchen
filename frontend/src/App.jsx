import { lazy, Suspense, useState } from 'react';
import { AppProvider } from './context/AppContext.jsx';
import { useApp } from './context/useApp';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import OrderTracker from './components/OrderTracker';
import ProductModal from './components/ProductModal';
import CakeCustomizerModal from './components/CakeCustomizerModal';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import TableReservationModal from './components/TableReservationModal';

const StorefrontPage = lazy(() => import('./pages/StorefrontPage'));
const PosPage = lazy(() => import('./pages/PosPage'));
const KdsPage = lazy(() => import('./pages/KdsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const CustomerChatPage = lazy(() => import('./pages/CustomerChatPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

function AppContent() {
  const { currentMode, setCurrentMode, setActiveTrackedOrderId } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cakeProduct, setCakeProduct] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);

  const closeProductModal = () => setSelectedProduct(null);
  const closeCakeModal = () => setCakeProduct(null);
  const closeCheckout = () => setCheckoutOpen(false);
  const closeReservation = () => setReservationOpen(false);

  const handleOrderPlaced = (order) => {
    setActiveTrackedOrderId(order.id);
    setCurrentMode('tracking');
  };

  const renderPage = () => {
    switch (currentMode) {
      case 'customer':
        return (
          <StorefrontPage
            onSelectProduct={setSelectedProduct}
            onOpenCakeCustomizer={setCakeProduct}
            onOpenChat={() => setCurrentMode('chat')}
            onOpenReservation={() => setReservationOpen(true)}
            searchQuery={searchQuery}
          />
        );
      case 'tracking':
        return <OrderTracker onBackToMenu={() => setSelectedProduct(null)} />;
      case 'pos':
        return <PosPage />;
      case 'kds':
        return <KdsPage />;
      case 'admin':
        return <AdminPage />;
      case 'support':
        return <SupportPage />;
      case 'chat':
        return <CustomerChatPage />;
      case 'login':
        return <LoginPage onBack={() => setCurrentMode('customer')} />;
      default:
        return null;
    }
  };

  // Hide Navbar/Footer for full-screen staff pages
  const isFullScreen = ['login', 'pos', 'kds', 'admin'].includes(currentMode);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {!isFullScreen && <Navbar onOpenSearch={setSearchQuery} onOpenReservation={() => setReservationOpen(true)} />}
      <Suspense fallback={<div role="status" style={{ padding: 24, textAlign: 'center' }}>Loading page...</div>}>
        {renderPage()}
      </Suspense>
      {!isFullScreen && <Footer />}

      <ProductModal product={selectedProduct} onClose={closeProductModal} />
      <CakeCustomizerModal
        key={cakeProduct?.id ? `cake-customizer-${cakeProduct.id}` : 'custom-cake-customizer'}
        isOpen={Boolean(cakeProduct)}
        onClose={closeCakeModal}
        product={cakeProduct}
      />
      <CartDrawer onProceedToCheckout={() => setCheckoutOpen(true)} />
      <CheckoutModal isOpen={checkoutOpen} onClose={closeCheckout} onOrderPlaced={handleOrderPlaced} />
      <TableReservationModal isOpen={reservationOpen} onClose={closeReservation} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
