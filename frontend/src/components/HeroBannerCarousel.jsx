import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles } from 'lucide-react';
import apiClient from '../services/api';
import './HeroBannerCarousel.css';

const AUTOPLAY_MS = 6000;

export default function HeroBannerCarousel({ branchId }) {
  const [banners, setBanners] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- Prevent stale banners from another branch flashing during reload.
    setBanners([]);
    const loadBanners = async () => {
      try {
        const response = await apiClient.get('/hero-banners', { params: { branchId } });
        if (active && Array.isArray(response.data)) {
          setBanners(response.data);
          setActiveIndex(0);
        }
      } catch (error) {
        console.error('[HeroBannerCarousel] Published banners could not be loaded:', error);
        if (active) setBanners([]);
      }
    };
    loadBanners();
    return () => { active = false; };
  }, [branchId]);

  useEffect(() => {
    if (isPaused || banners.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex(current => (current + 1) % banners.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [banners.length, isPaused]);

  const goTo = (index) => setActiveIndex((index + banners.length) % banners.length);
  const next = () => goTo(activeIndex + 1);
  const previous = () => goTo(activeIndex - 1);

  const handleTouchStart = (event) => { touchStartX.current = event.changedTouches[0].screenX; };
  const handleTouchEnd = (event) => {
    touchEndX.current = event.changedTouches[0].screenX;
    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) > 50) {
      if (distance > 0) next();
      else previous();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      previous();
    }
  };

  if (!banners.length) return null;

  const banner = banners[activeIndex];
  return (
    <section className="hero-carousel" aria-roledescription="carousel" aria-label="Featured offers" tabIndex="0" onKeyDown={handleKeyDown} onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} onFocus={() => setIsPaused(true)} onBlur={() => setIsPaused(false)}>
      <div className="hero-carousel__track" style={{ transform: `translateX(-${activeIndex * 100}%)` }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {banners.map((item, index) => {
          const imgSrc = item.imageUrl?.startsWith('http')
            ? item.imageUrl
            : new URL(item.imageUrl || '', apiClient.defaults.baseURL).toString();

          return (
            <article className="hero-carousel__slide" key={item.id} aria-hidden={item.id !== banner.id}>
              {item.imageUrl && <img className="hero-carousel__image" src={imgSrc} alt={item.altText || item.title} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />}
              <div className="hero-carousel__overlay" />
              <div className="hero-carousel__content">
                <span className="hero-carousel__eyebrow"><Sparkles size={14} /> {item.subtitle || 'A Kabir’s Kitchen special'}</span>
                <h1>{item.title}</h1>
                <p>{item.subtitle}</p>
                {item.badgeText && <strong>{item.badgeText}</strong>}
                {item.buttonText && <a className="button button--light" href={item.buttonLink || '#menu'}>{item.buttonText}<span>→</span></a>}
              </div>
            </article>
          );
        })}
      </div>
      <div className="hero-carousel__controls">
        <button type="button" className="hero-carousel__arrow" onClick={previous} aria-label="Previous banner"><ChevronLeft size={20} /></button>
        <div className="hero-carousel__dots" role="tablist" aria-label="Choose banner">
          {banners.map((item, index) => <button type="button" key={item.id} className={index === activeIndex ? 'active' : ''} onClick={() => goTo(index)} role="tab" aria-selected={index === activeIndex} aria-label={`Show banner ${index + 1}`} />)}
        </div>
        <button type="button" className="hero-carousel__arrow" onClick={next} aria-label="Next banner"><ChevronRight size={20} /></button>
        <button type="button" className="hero-carousel__pause" onClick={() => setIsPaused(value => !value)} aria-label={isPaused ? 'Resume autoplay' : 'Pause autoplay'}>{isPaused ? <Play size={16} /> : <Pause size={16} />}</button>
      </div>
    </section>
  );
}
