import React, { useState } from 'react';
import { ChefHat, ShoppingCart, MapPin, Search, Menu, X, Navigation, Store, Cake, Calendar, LogIn, LogOut, ShieldCheck, Tag } from 'lucide-react';
import { useApp } from '../context/useApp';

export default function Navbar({ onOpenSearch, onOpenReservation }) {
  const {
    currentMode, setCurrentMode, selectedBranchId, setSelectedBranchId,
    activeBranch, branches, cart, setIsCartOpen, orders, authUser, signOut,
    resetToHome, setActiveCategory, setActiveSubCategory
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const activeOrdersCount = orders.filter(o => o.status !== 'Delivered').length;

  const changeMode = (mode) => {
    setCurrentMode(mode);
    setMobileOpen(false);
  };

  const handleNavClick = (targetId, mode = 'customer') => {
    if (currentMode !== mode) {
      changeMode(mode);
    }
    setMobileOpen(false);

    // Clear search query so full menu or home is displayed cleanly
    if (targetId === 'top' || targetId === 'home' || targetId === 'menu') {
      onOpenSearch?.('');
      const searchInputs = document.querySelectorAll('.global-search input');
      searchInputs.forEach(input => { input.value = ''; });
    }

    if (targetId === 'top' || targetId === 'home') {
      resetToHome?.();
      return;
    }

    if (targetId === 'menu') {
      setActiveCategory?.('all');
      setActiveSubCategory?.('all');
    }

    const performScroll = (attempts = 0) => {
      if (targetId === 'top' || targetId === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Try finding the primary target element or fallback to categories for menu
      const el = document.getElementById(targetId) || (targetId === 'menu' ? document.getElementById('categories') : null);
      if (el) {
        const header = document.querySelector('.site-header');
        const headerHeight = header ? header.offsetHeight : 130;
        const targetTop = el.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth'
        });
      } else if (attempts < 12) {
        // Retry every 80ms while lazy-loaded StorefrontPage finishes rendering
        setTimeout(() => performScroll(attempts + 1), 80);
      }
    };

    setTimeout(() => performScroll(0), 40);
  };

  const isStaff = authUser && (authUser.role === 'Admin' || authUser.role === 'SuperAdmin' || authUser.role === 'Cashier' || authUser.role === 'BranchManager');
  const isAdmin = authUser && (authUser.role === 'Admin' || authUser.role === 'SuperAdmin' || authUser.role === 'BranchManager');

  return (
    <header className="site-header">
      {/* ─── Top Trust & Status Bar (Pure Customer / Authenticated Staff Context) ─── */}
      <div className="system-bar" style={{ background: '#071711', borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
        <div className="system-bar__context">
          <span className="system-bar__brand" style={{ color: '#d4af37', letterSpacing: '0.12em', fontWeight: 900 }}>KABIR’S KITCHEN</span>
          <span className="system-bar__divider" style={{ background: 'rgba(212,175,55,0.3)' }} />
          <span>Artisanal Dining, Bakery & Fast Food</span>
          <span className="system-bar__status"><span /> Open today · 9 AM–10 PM</span>
        </div>

        {/* Right side: Staff Access (Only if authenticated staff) or Customer Account */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAdmin && (
            <button
              onClick={() => changeMode('admin')}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '0.66rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Access Management ERP Dashboard"
            >
              <ShieldCheck size={12} /> Management ERP
            </button>
          )}

          {isStaff && (
            <button
              onClick={() => changeMode('pos')}
              style={{
                background: 'rgba(212, 175, 55, 0.15)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                color: '#d4af37',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '0.66rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Access Staff Billing POS"
            >
              <Store size={12} /> Staff POS
            </button>
          )}

          {authUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c9d8ce', fontSize: '0.68rem' }}>
              <span>{authUser.fullName || authUser.email}</span>
              <button
                onClick={signOut}
                style={{ background: 'transparent', border: 0, color: '#f87171', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.66rem' }}
                title="Logout"
              >
                <LogOut size={11} /> Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => changeMode('login')}
              style={{ background: 'transparent', border: 0, color: '#9ab4a3', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem' }}
            >
              <LogIn size={11} /> Sign In
            </button>
          )}
        </div>
      </div>

      {/* ─── Main Brand & Actions Bar ─── */}
      <div className="main-nav" style={{ height: '76px', borderBottom: '1px solid #f1e8dc' }}>
        <button className="brand" onClick={() => handleNavClick('top', 'customer')} aria-label="Go to Kabir's Kitchen home">
          <span className="brand__mark" style={{ background: 'linear-gradient(135deg, #0c251c 0%, #ea580c 100%)', boxShadow: '0 6px 16px rgba(12,37,28,0.25)' }}>
            <ChefHat size={25} />
          </span>
          <span>
            <strong style={{ fontSize: '1.35rem', color: '#0c251c', fontFamily: "'Playfair Display', Georgia, serif" }}>Kabir’s Kitchen</strong>
            <small style={{ color: '#ea580c', fontWeight: 800 }}>Artisanal Dining & Cake Boutique</small>
          </span>
        </button>

        {/* Global Search */}
        <label className="global-search" style={{ border: '1.5px solid #e8decb', borderRadius: '12px', height: '42px', flex: '1', maxWidth: '420px', marginLeft: 'auto', marginRight: '16px' }}>
          <Search size={17} style={{ color: '#9c8b78' }} />
          <input type="text" placeholder="Search biryani, burgers, cakes..." onChange={e => onOpenSearch?.(e.target.value)} aria-label="Search menu" />
        </label>

        {/* Action Buttons */}
        <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {authUser ? (
            <button
              onClick={() => changeMode(authUser.role === 'Chef' ? 'kds' : (authUser.role === 'Admin' || authUser.role === 'SuperAdmin') ? 'admin' : 'pos')}
              style={{
                background: '#0c251c',
                color: '#fff',
                border: '1px solid #1e4535',
                borderRadius: '12px',
                padding: '10px 14px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Open Staff Dashboard"
            >
              <ShieldCheck size={16} style={{ color: '#22c55e' }} />
              <span>{authUser.fullName || 'Admin'}</span>
            </button>
          ) : (
            <button
              onClick={() => changeMode('login')}
              style={{
                background: '#0c251c',
                color: '#fff',
                border: '1px solid #1e4535',
                borderRadius: '12px',
                padding: '10px 15px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(12,37,28,0.18)'
              }}
              title="Staff Portal & Admin Sign In"
            >
              <LogIn size={16} style={{ color: '#ea580c' }} />
              <span>Sign In</span>
            </button>
          )}

          <button className="cart-button" onClick={() => setIsCartOpen(true)} aria-label={`Open cart with ${cartCount} items`} style={{ background: '#ea580c', borderRadius: '12px', padding: '10px 16px', boxShadow: '0 8px 20px rgba(234,88,12,0.25)' }}>
            <ShoppingCart size={18} />
            <span>Cart</span>
            <b style={{ color: '#ea580c', background: '#fff' }}>{cartCount}</b>
          </button>

          <button className="mobile-menu-button" onClick={() => setMobileOpen(v => !v)} aria-label="Toggle navigation">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ─── Streamlined Customer Main Navigation ─── */}
      <nav className="customer-subnav" style={{ background: '#fff', borderBottom: '1px solid #eee4d6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 20px', overflowX: 'auto', whiteSpace: 'nowrap' }} aria-label="Primary site navigation">
        <button
          type="button"
          className="subnav-link"
          onClick={() => handleNavClick('top', 'customer')}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 0, background: 'transparent', color: currentMode === 'customer' ? '#0c251c' : '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Store size={15} style={{ color: '#ea580c' }} /> Home
        </button>

        <button
          type="button"
          className="subnav-link"
          onClick={() => handleNavClick('menu', 'customer')}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 0, background: 'transparent', color: '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ChefHat size={15} style={{ color: '#ea580c' }} /> Menu
        </button>

        <button
          type="button"
          className="subnav-link"
          onClick={() => handleNavClick('offers', 'customer')}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 0, background: 'transparent', color: '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Tag size={15} style={{ color: '#ea580c' }} /> Offers
        </button>

        <button
          type="button"
          className="subnav-link"
          onClick={() => handleNavClick('cakes', 'customer')}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 0, background: 'transparent', color: '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Cake size={15} style={{ color: '#db2777' }} /> Cakes
        </button>

        <button
          type="button"
          className="subnav-link"
          onClick={() => onOpenReservation?.()}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 0, background: 'transparent', color: '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Calendar size={15} style={{ color: '#059669' }} /> Dine-in
        </button>

        <button
          type="button"
          className="subnav-link"
          onClick={() => changeMode('tracking')}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 0, background: currentMode === 'tracking' ? '#f1f5f9' : 'transparent', color: currentMode === 'tracking' ? '#0c251c' : '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Navigation size={15} style={{ color: '#2563eb' }} /> Track Order {activeOrdersCount > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px' }}>{activeOrdersCount}</span>}
        </button>

        <button
          type="button"
          className="subnav-link"
          onClick={() => changeMode(authUser ? (authUser.role === 'Chef' ? 'kds' : (authUser.role === 'Admin' || authUser.role === 'SuperAdmin') ? 'admin' : 'pos') : 'login')}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 0, background: currentMode === 'login' || currentMode === 'admin' ? '#f1f5f9' : 'transparent', color: '#0c251c', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ShieldCheck size={15} style={{ color: '#ea580c' }} /> {authUser ? 'Staff Dashboard' : 'Staff Portal'}
        </button>
      </nav>

      {/* ─── Mobile Drawer ─── */}
      {mobileOpen && (
        <div className="mobile-menu" style={{ background: '#fff', padding: '16px 20px', borderTop: '1px solid #eee4dc' }}>
          <label className="global-search global-search--mobile" style={{ marginBottom: '12px' }}>
            <Search size={18} />
            <input type="text" placeholder="Search menu..." onChange={e => onOpenSearch?.(e.target.value)} />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button className="button button--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => handleNavClick('top', 'customer')}>🏠 Home</button>
            <button className="button button--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => handleNavClick('menu', 'customer')}>🍽️ Menu</button>
            <button className="button button--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => handleNavClick('offers', 'customer')}>🔥 Offers</button>
            <button className="button button--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => handleNavClick('cakes', 'customer')}>🎂 Cakes</button>
            <button className="button button--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { setMobileOpen(false); onOpenReservation?.(); }}>🪑 Dine-in</button>
            <button className="button button--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => changeMode('tracking')}>🛵 Track Order</button>
            <button className="button button--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => changeMode('chat')}>💬 Help & Chat</button>
            <button
              className="button button--primary"
              style={{ justifyContent: 'flex-start', marginTop: '8px', background: '#0c251c', color: '#fff', border: 0 }}
              onClick={() => { setMobileOpen(false); changeMode(authUser ? (authUser.role === 'Chef' ? 'kds' : (authUser.role === 'Admin' || authUser.role === 'SuperAdmin') ? 'admin' : 'pos') : 'login'); }}
            >
              🔐 {authUser ? 'Staff Dashboard' : 'Staff Portal / Sign In'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
