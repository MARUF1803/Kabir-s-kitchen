import React from 'react';
import { ChefHat, Clock, MapPin, Phone, ShieldCheck, Lock } from 'lucide-react';
import { useApp } from '../context/useApp';

const CURRENT_YEAR = new Date().getFullYear();

export default function Footer() {
  const { setCurrentMode, authUser, activeBranch } = useApp();

  return (
    <footer className="site-footer">
      <div className="site-footer__main">
        <div className="footer-brand">
          <div className="footer-brand__logo"><ChefHat size={25} /></div>
          <div><h2>Kabir’s Kitchen</h2><p>Cake & Pastry Shop</p></div>
          <p className="footer-brand__copy">Cakes, pastries, desserts and everyday menu favourites for Dhaka.</p>
          <div className="footer-brand__trust"><ShieldCheck size={17} /> Contact your branch for current service information.</div>
        </div>

        <div className="footer-column footer-column--contact">
          <h3>Contact & Support</h3>
          {activeBranch?.address && <p><MapPin size={16} /> {activeBranch.address}</p>}
          <p>
            <Phone size={16} />
            <a href="tel:01791665634" style={{ color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
              01791665634
            </a>
          </p>
          <p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink: 0 }}>
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.187-2.59-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.15.57 4.168 1.564 5.918l-1.657 6.05 6.223-1.632c1.69.924 3.633 1.464 5.71 1.464 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z"/>
              </svg>
              <a
                href="https://wa.me/8801791665634?text=Hello%20Kabir's%20Kitchen!%20I%20have%20an%20inquiry%20about%20your%20food%20and%20orders."
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#25D366', fontWeight: 700, textDecoration: 'none' }}
              >
                WhatsApp: 01791665634
              </a>
            </span>
          </p>
        </div>

        <div className="footer-column">
          <h3>Shop</h3>
          <a href="#categories">Celebration cakes</a><a href="#categories">Pastries & chocolate</a><a href="#categories">Biscuits & toast</a><a href="#categories">Customized cakes</a><a href="#categories">Fresh breads</a>
        </div>

        <div className="footer-column">
          <h3>Help & Staff</h3>
          <a href="#branches">Contact a branch</a>
          <a href="#branches">Delivery availability</a>
          <button
            type="button"
            onClick={() => setCurrentMode('login')}
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              color: '#d4af37',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '6px'
            }}
          >
            <Lock size={12} /> Staff Portal &amp; POS Login
          </button>
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>© {CURRENT_YEAR} Kabir’s Kitchen. All rights reserved.</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span><Clock size={14} /> Contact the branch for current opening hours</span>
          <button
            type="button"
            onClick={() => setCurrentMode('login')}
            style={{
              background: 'rgba(212,175,55,0.1)',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '6px',
              color: '#d4af37',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              cursor: 'pointer'
            }}
          >
            {authUser ? `Logged as ${authUser.role}` : 'Staff Portal'}
          </button>
        </div>
      </div>
    </footer>
  );
}
