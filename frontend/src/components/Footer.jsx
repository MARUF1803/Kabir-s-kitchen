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
          <h3>Visit us</h3>
          {activeBranch?.address && <p><MapPin size={16} /> {activeBranch.address}</p>}
          {activeBranch?.phone
            ? <p><Phone size={16} /> <a href={`tel:${activeBranch.phone}`}>{activeBranch.phone}</a></p>
            : <p>Branch contact details are not available.</p>}
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
