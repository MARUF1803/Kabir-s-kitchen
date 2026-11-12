import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUpDown, Cake, Calendar, Check, Clock3, Flame, MapPin, MessageCircle, Phone, Sparkles, Star, ChevronRight, ChevronLeft, Play, Pause } from 'lucide-react';
import { useApp } from '../context/useApp';
import ProductCard from '../components/ProductCard';
import ProductCarousel from '../components/ProductCarousel';
import apiClient, { bannersApi, mapMenuItemToProduct, promotionsApi, resolveApiUrl } from '../services/api';

const HERO_PRODUCT_COUNT = 10;
const PRODUCT_PAGE_SIZE = 100;
const CATEGORY_PREVIEW_PAGE_SIZE = 4;

const getHeroImageKey = imageUrl => String(imageUrl || '').split('?')[0].toLowerCase();
const getSafeBannerLink = link => {
  if (typeof link !== 'string' || link.includes('\\') ||
      [...link].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return '#menu';
  if (link.startsWith('#')) return link;
  return link.startsWith('/') && !link.startsWith('//') ? link : '#menu';
};
const findCategoryNode = (nodes, id, ancestors = []) => {
  for (const node of nodes || []) {
    const path = [...ancestors, node];
    if (String(node.categoryId) === String(id)) return { node, path };
    const match = findCategoryNode(node.children, id, path);
    if (match) return match;
  }
  return null;
};

const createProductHeroSlides = products => [...products]
  .sort((a, b) => Number(b.isPopular) - Number(a.isPopular) || b.rating - a.rating || (b.reviews || 0) - (a.reviews || 0))
  .reduce((slides, product) => {
    const imageUrl = product.image || product.imageUrl;
    const imageKey = getHeroImageKey(imageUrl);
    if (!imageUrl || !imageKey || slides.some(slide => slide.imageKey === imageKey) || slides.length >= HERO_PRODUCT_COUNT) {
      return slides;
    }

    slides.push({
      id: `product-${product.id}`,
      productId: product.id,
      imageKey,
      title: product.name,
      eyebrow: product.categoryName || 'From our kitchen',
      description: product.description,
      image: imageUrl,
      mediaUrl: imageUrl,
      mediaType: 'Image',
      tag: Number(product.prepTime || product.preparationTimeMinutes) > 0
        ? `${product.prepTime || product.preparationTimeMinutes} min preparation`
        : '',
      badgeTitle: product.isPopular ? 'Customer Favourite' : product.categoryName || 'From our menu',
      badgeSub: product.categoryName || ''
    });
    return slides;
  }, []);

const fillHeroSlidesWithProducts = (banners, productSlides) => {
  const slides = [...banners];
  const usedImages = new Set(slides.map(slide => getHeroImageKey(slide.image || slide.mediaUrl)));

  for (const slide of productSlides) {
    if (slides.length >= HERO_PRODUCT_COUNT) break;
    if (usedImages.has(slide.imageKey)) continue;
    slides.push(slide);
    usedImages.add(slide.imageKey);
  }

  return slides;
};

export default function StorefrontPage({ onSelectProduct, onOpenCakeCustomizer, onOpenChat, onOpenReservation, searchQuery }) {
  const {
    products, categories, branches, branchLoadError, productsLoading, productLoadError, categoryLoadError,
    productPage, productTotalCount, hasMoreProducts, loadProductPage,
    selectedBranchId, activePromotions, setAppliedCoupon, setIsCartOpen
  } = useApp();
  const productHeroSlides = useMemo(() => createProductHeroSlides(products), [products]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSubCategory, setActiveSubCategory] = useState('all');
  const [categoryPreviewProducts, setCategoryPreviewProducts] = useState([]);
  const [categoryPreviewCounts, setCategoryPreviewCounts] = useState({});
  const [categoryPreviewError, setCategoryPreviewError] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');

  // Hero Dynamic Slides with Reduced Motion & Visibility Detection
  const [heroBanners, setHeroBanners] = useState([]);
  const heroSlides = useMemo(
    () => fillHeroSlidesWithProducts(heroBanners, productHeroSlides),
    [heroBanners, productHeroSlides]
  );
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [heroPausedManually, setHeroPausedManually] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!selectedBranchId || categories.length === 0) return undefined;
    let active = true;

    Promise.all(categories.map(async category => {
      const response = await apiClient.get('/menu/items', {
        params: {
          page: 1,
          pageSize: CATEGORY_PREVIEW_PAGE_SIZE,
          categoryId: category.id,
          branchId: selectedBranchId
        }
      });
      if (!Array.isArray(response.data.items)) {
        throw new Error(`The menu API returned an invalid product page for ${category.name}.`);
      }
      return {
        slug: category.slug,
        totalCount: response.data.totalCount,
        products: response.data.items.map(mapMenuItemToProduct)
      };
    }))
      .then(categoryPages => {
        if (!active) return;
        setCategoryPreviewProducts(categoryPages.flatMap(category => category.products));
        setCategoryPreviewCounts(Object.fromEntries(categoryPages.map(category => [category.slug, category.totalCount])));
        setCategoryPreviewError('');
      })
      .catch(error => {
        if (active) {
          setCategoryPreviewError(error.response?.data?.message || error.message || 'Category menu previews could not be loaded.');
        }
      });

    return () => { active = false; };
  }, [categories, selectedBranchId]);

  // Load backend hero banners if available
  useEffect(() => {
    if (!selectedBranchId) return undefined;
    let active = true;
    const refreshBanners = () => bannersApi.getVisible(selectedBranchId)
      .then(banners => {
        if (active && Array.isArray(banners)) {
          const mapped = banners.map(b => ({
            title: b.title,
            eyebrow: b.campaignName || 'Kabir’s Kitchen',
            description: b.subtitle,
            image: resolveApiUrl(b.imageUrl || b.mediaUrl),
            altText: b.altText || b.title,
            mediaUrl: resolveApiUrl(b.mediaUrl || b.imageUrl),
            posterUrl: resolveApiUrl(b.posterUrl || b.imageUrl),
            mediaType: b.mediaType === 2 || b.mediaType === 'Video' ? 'Video' : 'Image',
            tag: b.badgeText || 'Featured menu',
            badgeTitle: b.badgeText || 'From our kitchen',
            badgeSub: b.badgeText ? b.buttonText : 'Explore the menu',
            buttonText: b.buttonText,
            buttonLink: getSafeBannerLink(b.buttonLink),
            campaignId: b.promotionCampaignId
          }));
          setHeroBanners(mapped);
          setHeroSlideIndex(0);
        }
      })
      .catch(() => {
        if (active) setHeroBanners([]);
      });
    refreshBanners();
    const timer = window.setInterval(refreshBanners, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedBranchId]);

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => setIsPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const totalHeroSlides = heroSlides.length;
  useEffect(() => {
    const campaignId = heroSlides[heroSlideIndex]?.campaignId;
    if (!campaignId || !selectedBranchId || !isPageVisible) return;
    promotionsApi.trackEngagement(campaignId, selectedBranchId, 1)
      .catch(error => console.warn('[Storefront] Campaign impression could not be recorded:', error.message));
  }, [heroSlides, heroSlideIndex, isPageVisible, selectedBranchId]);

  const trackBannerClick = (campaignId) => {
    if (!campaignId || !selectedBranchId) return;
    promotionsApi.trackEngagement(campaignId, selectedBranchId, 2)
      .catch(error => console.warn('[Storefront] Campaign click could not be recorded:', error.message));
  };
  const goToSlide = useCallback((index) => {
    setHeroSlideIndex((index + totalHeroSlides) % totalHeroSlides);
  }, [totalHeroSlides]);

  const nextHeroSlide = useCallback(() => {
    goToSlide(heroSlideIndex + 1);
  }, [goToSlide, heroSlideIndex]);

  const prevHeroSlide = useCallback(() => {
    goToSlide(heroSlideIndex - 1);
  }, [goToSlide, heroSlideIndex]);

  // Auto-advance every 4.5s for images, 7s for video (pauses when manually paused or tab hidden)
  useEffect(() => {
    if (prefersReducedMotion || heroPausedManually || !isPageVisible || totalHeroSlides < 2) return;
    const current = heroSlides[heroSlideIndex];
    const duration = current?.mediaType === 'Video' ? 7000 : 4500;
    const interval = setInterval(() => {
      setHeroSlideIndex(prev => (prev + 1) % totalHeroSlides);
    }, duration);
    return () => clearInterval(interval);
  }, [prefersReducedMotion, heroPausedManually, isPageVisible, totalHeroSlides, heroSlideIndex, heroSlides]);

  // Swipe / touch support
  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : null;
    if (touchEndX !== null) {
      const diff = touchStartX.current - touchEndX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) nextHeroSlide();
        else prevHeroSlide();
      }
    }
    touchStartX.current = null;
  };

  // Keyboard navigation
  const handleHeroKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextHeroSlide();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevHeroSlide();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToSlide(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToSlide(totalHeroSlides - 1);
    }
  };

  const categoryItems = useMemo(() => [
    {
      id: 'all',
      name: 'All Dishes',
      icon: '✨',
      slug: 'all',
      subCategories: [],
      img: products[0]?.image || ''
    },
    ...categories.map(category => ({
      ...category,
      id: category.slug,
      img: category.imageUrl || products.find(product => product.categoryId === category.slug)?.image || ''
    }))
  ], [categories, products]);

  const handleSelectCategory = (catSlug) => {
    setActiveCategory(catSlug);
    setActiveSubCategory('all');
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentCategoryObj = useMemo(() => {
    return categoryItems.find(category => category.slug === activeCategory) || null;
  }, [activeCategory, categoryItems]);

  const selectedSubCategory = useMemo(() => {
    if (activeSubCategory === 'all' || !currentCategoryObj) return null;
    return findCategoryNode(currentCategoryObj.subCategories, activeSubCategory);
  }, [activeSubCategory, currentCategoryObj]);

  useEffect(() => {
    const search = searchQuery?.trim() || undefined;
    const categoryId = activeSubCategory !== 'all'
      ? Number(activeSubCategory)
      : search
        ? undefined
        : categories.find(category => category.slug === activeCategory)?.id;
    const timer = setTimeout(() => {
      loadProductPage({ page: 1, pageSize: PRODUCT_PAGE_SIZE, categoryId, search });
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [activeCategory, activeSubCategory, categories, loadProductPage, searchQuery]);

  const loadNextProductPage = () => {
    const search = searchQuery?.trim() || undefined;
    const categoryId = activeSubCategory !== 'all'
      ? Number(activeSubCategory)
      : search
        ? undefined
        : categories.find(category => category.slug === activeCategory)?.id;
    loadProductPage({
      page: productPage + 1,
      pageSize: PRODUCT_PAGE_SIZE,
      categoryId,
      search,
      append: true
    });
  };

  const bestSellersList = useMemo(() => products
    .filter(product => product.isPopular)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0))
    .slice(0, 10), [products]);

  // Full Menu Filter (Search query searches across all categories)
  const filteredProducts = useMemo(() => products.filter(product => {
    const query = searchQuery?.trim().toLowerCase();
    const matchCategory = Boolean(query) || activeCategory === 'all' || product.categoryId === activeCategory;
    const matchSearch = !query || [product.name, product.description, product.categoryName, product.subCategoryName || ''].some(value => value.toLowerCase().includes(query));
    const matchDietary = dietaryFilter === 'all' || (dietaryFilter === 'veg' && product.isVeg) || (dietaryFilter === 'nonveg' && !product.isVeg) || (dietaryFilter === 'spicy' && product.isSpicy);
    return matchCategory && matchSearch && matchDietary;
  }).sort((a, b) => {
    const priceA = a.branchPrices?.[selectedBranchId] || a.basePrice;
    const priceB = b.branchPrices?.[selectedBranchId] || b.basePrice;
    if (sortBy === 'priceAsc') return priceA - priceB;
    if (sortBy === 'priceDesc') return priceB - priceA;
    if (sortBy === 'rating') return b.rating - a.rating;
    return Number(b.isPopular) - Number(a.isPopular) || b.rating - a.rating;
  }), [products, activeCategory, searchQuery, dietaryFilter, sortBy, selectedBranchId]);

  const menuProductGroups = useMemo(() => {
    const groups = new Map(categories.map(category => [
      category.slug,
      { slug: category.slug, name: category.name, products: [], totalCount: categoryPreviewCounts[category.slug] }
    ]));

    const categoryPreviewIsReady = activeCategory === 'all' && !searchQuery?.trim() && categoryPreviewProducts.length > 0;
    const productsToGroup = categoryPreviewIsReady ? categoryPreviewProducts : filteredProducts;
    for (const product of productsToGroup) {
      const slug = product.categoryId || 'uncategorized';
      if (!groups.has(slug)) {
        groups.set(slug, { slug, name: product.categoryName || 'Uncategorized', products: [], totalCount: categoryPreviewCounts[slug] });
      }
      groups.get(slug).products.push(product);
    }

    return [...groups.values()]
      .filter(group => group.products.length > 0)
      .map(group => ({ ...group, totalCount: group.totalCount ?? group.products.length }));
  }, [activeCategory, categories, categoryPreviewCounts, categoryPreviewProducts, filteredProducts, searchQuery]);

  const featuredCake = products.find(product => product.isCustomCake) || products.find(p => p.categoryId === 'bakery');

  return (
    <main className="storefront">
      {(productsLoading || branchLoadError || productLoadError || categoryLoadError || categoryPreviewError) && (
        <div role={branchLoadError || productLoadError || categoryLoadError || categoryPreviewError ? 'alert' : 'status'} style={{ margin: '12px 20px', color: branchLoadError || productLoadError || categoryLoadError || categoryPreviewError ? '#b91c1c' : '#475569' }}>
          {productsLoading && 'Loading menu from the database…'}
          {branchLoadError}
          {productLoadError}
          {categoryLoadError}
          {categoryPreviewError}
        </div>
      )}
      {/* ─── 3. FULL-SECTION LUXURY HERO MEDIA CAROUSEL ─── */}
      <section
        className="hero-carousel-section"
        id="home"
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured menu items and promotions"
        tabIndex={0}
        onKeyDown={handleHeroKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="hero-carousel-section__track"
          style={{
            transform: `translateX(-${heroSlideIndex * 100}%)`,
            transition: prefersReducedMotion ? 'none' : 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          {heroSlides.map((slide, idx) => {
            const isActive = idx === heroSlideIndex;
            return (
              <article
                key={slide.mediaUrl || slide.image || idx}
                className="hero-carousel-section__slide"
                aria-hidden={!isActive}
              >
                {/* Full-bleed background media for this slide */}
                {slide.mediaType === 'Video' ? (
                  <video
                    src={slide.mediaUrl}
                    poster={slide.posterUrl || slide.image}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="hero-carousel-section__bg-media"
                  />
                ) : (
                  <img
                    src={slide.mediaUrl || slide.image}
                    alt={slide.altText || slide.title}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="hero-carousel-section__bg-media"
                    onError={event => {
                      const image = event.currentTarget;
                      if (image.dataset.fallbackApplied) return;
                      image.dataset.fallbackApplied = 'true';
                      image.src = '/food-placeholder.svg';
                    }}
                  />
                )}

                {/* Luxury gradient overlay ensuring crystal-clear text readability */}
                <div className="hero-carousel-section__overlay" />

                {/* Content layer across the section */}
                <div className="hero-carousel-section__content">
                  <span className="eyebrow" style={{ color: '#ffd18b', background: 'rgba(212,175,55,0.18)', border: '1px solid rgba(212,175,55,0.35)', alignSelf: 'flex-start' }}>
                    <Sparkles size={14} /> {slide.eyebrow}
                  </span>
                  
                  <h1 className="hero-carousel-section__title">
                    {slide.title}
                  </h1>

                  <p className="hero-carousel-section__desc">
                    {slide.description}
                  </p>

                  <div className="hero__actions" style={{ flexWrap: 'wrap', gap: '12px' }}>
                    {slide.buttonText
                      ? <a className="button button--primary" href={slide.buttonLink || '#menu'} onClick={() => trackBannerClick(slide.campaignId)}>{slide.buttonText} <span>→</span></a>
                      : <button className="button button--primary" onClick={() => handleSelectCategory('all')}>Explore Menu <span>→</span></button>}
                    <button className="button button--ghost" onClick={() => featuredCake && onOpenCakeCustomizer(featuredCake)} style={{ borderColor: 'rgba(212,175,55,0.4)', color: '#fff', background: 'rgba(7,28,20,0.5)' }}>
                      <Cake size={18} style={{ color: '#d4af37' }} /> Design a Cake
                    </button>
                    <button className="button button--ghost" onClick={onOpenReservation} style={{ borderColor: 'rgba(255,255,255,0.25)', color: '#fff', background: 'rgba(7,28,20,0.5)' }}>
                      <Calendar size={18} style={{ color: '#34d399' }} /> Ask about a table
                    </button>
                  </div>
                </div>

                {/* Right side floating badges */}
                <div className="hero-carousel-section__badges">
                  <div className="hero__floating-card" style={{ position: 'relative', left: 'auto', top: 'auto', background: 'rgba(255,255,255,0.95)' }}>
                    <span>✓</span>
                    <div>
                      <strong>{slide.badgeTitle}</strong>
                      <small>{slide.badgeSub}</small>
                    </div>
                  </div>
                  {slide.tag && (
                    <span className="hero__tag" style={{ position: 'relative', left: 'auto', bottom: 'auto', background: 'rgba(7, 28, 20, 0.88)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.35)' }}>
                      <Clock3 size={15} /> {slide.tag}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Previous / Next Arrow Buttons */}
        <button
          type="button"
          className="hero-carousel-nav-btn hero-carousel-nav-btn--prev"
          onClick={prevHeroSlide}
          aria-label="Previous slide"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          type="button"
          className="hero-carousel-nav-btn hero-carousel-nav-btn--next"
          onClick={nextHeroSlide}
          aria-label="Next slide"
        >
          <ChevronRight size={24} />
        </button>

        {/* Bottom Floating Control Bar */}
        <div className="hero-carousel-control-bar">
          <div className="hero-carousel-control-bar__dots">
            {heroSlides.map((slide, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToSlide(idx)}
                style={{
                  width: heroSlideIndex === idx ? '32px' : '9px',
                  height: '9px',
                  borderRadius: '10px',
                  background: heroSlideIndex === idx ? '#ea580c' : 'rgba(255,255,255,0.38)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: 0
                }}
                aria-label={`Go to slide ${idx + 1}: ${slide.title}`}
                aria-current={heroSlideIndex === idx ? 'true' : 'false'}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setHeroPausedManually(v => !v)}
            aria-label={heroPausedManually ? 'Resume automatic slideshow' : 'Pause automatic slideshow'}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: '20px',
              color: '#ffd18b',
              padding: '3px 10px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {heroPausedManually ? <Play size={12} /> : <Pause size={12} />}
            <span>{heroPausedManually ? 'Paused' : 'Auto 4.5s'}</span>
          </button>
          
          <span style={{ fontSize: '0.72rem', color: '#c9d8ce', fontWeight: 600 }}>
            {heroSlideIndex + 1} / {totalHeroSlides}
          </span>
        </div>
      </section>

      {/* ─── LIVE SEARCH RESULTS (SHOWS INSTANTLY WHEN USER TYPES IN SEARCH) ─── */}
      {searchQuery?.trim() && (
        <section
          className="search-results-section"
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '32px 28px',
            margin: '28px 0',
            border: '2px solid #ea580c',
            boxShadow: '0 12px 35px rgba(234,88,12,0.12)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '22px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Instant Menu Search
              </span>
              <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.85rem', color: '#0f172a', margin: '4px 0 0' }}>
                Results for &ldquo;{searchQuery}&rdquo;
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Found <strong>{filteredProducts.length}</strong> matching dish{filteredProducts.length === 1 ? '' : 'es'}
              </p>
            </div>
            <div style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
              Showing real-time results
            </div>
          </div>

          {filteredProducts.length ? activeCategory === 'all' ? (
            <div className="menu-category-groups">
              {menuProductGroups.map(group => (
                <section className="menu-category-group" key={group.slug} aria-labelledby={`menu-category-${group.slug}`}>
                  <div className="menu-category-group__heading">
                    <h3 id={`menu-category-${group.slug}`}>{group.name}</h3>
                    <span>{group.products.length === group.totalCount ? `${group.totalCount} items` : `Showing ${group.products.length} of ${group.totalCount} items`}</span>
                  </div>
                  <div className="product-grid">
                    {group.products.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelectProduct={onSelectProduct}
                        onOpenCakeCustomizer={onOpenCakeCustomizer}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelectProduct={onSelectProduct}
                  onOpenCakeCustomizer={onOpenCakeCustomizer}
                />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🍽️</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>
                No dishes found matching &ldquo;{searchQuery}&rdquo;
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 16px' }}>
                We couldn&apos;t find an exact match. Try searching for common items:
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {['Biryani', 'Chicken', 'Burger', 'Cake', 'Pizza', 'Chow Mein'].map(keyword => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => handleSelectCategory('all')}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '6px 14px', fontSize: '0.8rem', color: '#334155', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── 4. FOOD CATEGORIES (EXACTLY ONE SECTION) ─── */}
      <section className="circular-categories-section" id="categories" style={{ margin: '42px 0 36px' }}>
        <div className="section-heading" style={{ marginBottom: '16px' }}>
          <div>
            <span className="eyebrow" style={{ color: '#ea580c' }}>Menu Categories</span>
            <h2>Explore by Category</h2>
          </div>
          <p>Select a category to browse its menu items.</p>
        </div>

        <div className="circular-shelf" aria-label="Visual cuisine categories">
          {categoryItems.map(item => (
            <button
              key={item.slug}
              type="button"
              className={`circular-cat-item ${activeCategory === item.slug ? 'active' : ''}`}
              onClick={() => handleSelectCategory(item.slug)}
            >
              <div className="circular-cat-item__avatar">
                <img src={item.img || '/food-placeholder.svg'} alt={item.name} loading="lazy" />
              </div>
              <span className="circular-cat-item__name">{item.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ─── 5. BEST SELLERS (HORIZONTAL REUSABLE PRODUCT CAROUSEL) ─── */}
      {bestSellersList.length > 0 && (
        <ProductCarousel
          id="bestsellers"
          eyebrow="Popular in our menu"
          icon={<Star size={14} fill="#d97706" color="#d97706" />}
          title="Popular Menu Items"
          subtitle="Items marked as popular by the restaurant."
          products={bestSellersList}
          onSelectProduct={onSelectProduct}
          onOpenCakeCustomizer={onOpenCakeCustomizer}
        />
      )}

      {activePromotions.length > 0 && (
        <section id="offers" className="menu-section" style={{ margin: '54px 0' }}>
          <div className="menu-section__heading">
            <div>
              <span className="eyebrow" style={{ color: '#ea580c' }}><Flame size={14} /> Active campaigns</span>
              <h2>Current Offers</h2>
              <p>Offers and eligibility are verified again by the server when you place an order.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {activePromotions.map(promotion => {
              const discount = promotion.discountType === 'Percentage'
                ? `${promotion.discountValue}% off eligible items`
                : `৳${Number(promotion.discountValue).toLocaleString()} off eligible items`;
              const target = promotion.targetType === 'Product'
                ? products.find(product => Number(product.id) === Number(promotion.menuItemId))?.name
                : promotion.targetType === 'Category'
                  ? categories.find(category => Number(category.id) === Number(promotion.categoryId))?.name
                  : promotion.targetType === 'Variant'
                    ? products.find(product => product.variants?.some(variant => Number(variant.id) === Number(promotion.menuItemVariantId)))?.name
                    : 'eligible menu items';
              return (
                <article key={promotion.id} style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff' }}>
                  <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>{promotion.name}</h3>
                  <p style={{ margin: '0 0 8px', color: '#c2410c', fontWeight: 800 }}>{discount}</p>
                  <p style={{ margin: '0 0 8px', color: '#475569' }}>
                    Applies to {target || 'eligible menu items'}.
                    {promotion.maximumDiscountAmount != null && ` Maximum discount ৳${Number(promotion.maximumDiscountAmount).toLocaleString()}.`}
                  </p>
                  {promotion.description && <p style={{ margin: '0 0 8px', color: '#475569' }}>{promotion.description}</p>}
                  {Number(promotion.minimumOrderAmount) > 0 && (
                    <p style={{ margin: '0 0 8px', color: '#475569' }}>Minimum order ৳{Number(promotion.minimumOrderAmount).toLocaleString()}.</p>
                  )}
                  {promotion.endDateUtc && (
                    <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.82rem' }}>
                      Ends {new Date(promotion.endDateUtc).toLocaleString()}
                    </p>
                  )}
                  {promotion.couponCode && (
                    <div style={{ margin: '10px 0 12px', padding: '8px 12px', background: '#fff7ed', border: '1.5px dashed #ea580c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#c2410c' }}>Promo Code: {promotion.couponCode}</span>
                      <button
                        type="button"
                        onClick={() => {
                          try { navigator.clipboard?.writeText(promotion.couponCode); } catch {}
                          setAppliedCoupon({ code: promotion.couponCode });
                          setIsCartOpen(true);
                        }}
                        style={{ fontSize: '0.74rem', background: '#ea580c', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Apply Code
                      </button>
                    </div>
                  )}
                  <button type="button" className="button button--primary" onClick={() => handleSelectCategory('all')}>
                    View menu <span>→</span>
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── 8. CUSTOM CAKE STUDIO ─── */}
      <section className="custom-cake-banner" id="cakes" style={{ margin: '54px 0' }}>
        <div className="custom-cake-banner__image">
          <img src={featuredCake?.image || '/food-placeholder.svg'} alt={featuredCake?.name || 'Custom cake options'} />
        </div>
        <div className="custom-cake-banner__content">
          <span className="eyebrow" style={{ color: '#d4af37' }}><Sparkles size={14} /> Custom Cake Options</span>
          <h2>Design Your Dream Celebration Cake</h2>
          <p>
            Choose from the options available in the cake customizer. The server confirms the final price before checkout; a 50% advance of the final quoted amount is required for custom cake orders.
          </p>
          <div className="custom-cake-banner__features">
            <span><Check size={16} /> Server-verified final quote</span>
            <span><Check size={16} /> 50% advance of the final quote</span>
          </div>
          <button className="button button--light" onClick={() => featuredCake && onOpenCakeCustomizer(featuredCake)}>
            Customize a Cake <span>→</span>
          </button>
        </div>
      </section>

      {/* ─── 9. RECOMMENDED FOR YOU (HORIZONTAL REUSABLE PRODUCT CAROUSEL) ─── */}
      {/* ─── FULL MENU SECTION WITH SEARCH & FILTERS ─── */}
      <section className="menu-section" id="menu" style={{ margin: '54px 0' }}>
        <div className="menu-section__heading">
          <div>
            <span className="eyebrow" style={{ color: '#ea580c' }}>Full Catalog</span>
            <h2>Explore Our Complete Menu</h2>
            <p>Crafted fresh with dependable quality and authentic culinary taste</p>
          </div>
          <div className="menu-controls">
            <div className="dietary-filter" aria-label="Dietary filters">
              {[
                ['all', 'All'],
                ['veg', '🌿 Veg'],
                ['nonveg', '🍖 Non-veg'],
                ['spicy', '🌶️ Spicy']
              ].map(([id, label]) => (
                <button key={id} className={dietaryFilter === id ? 'active' : ''} onClick={() => setDietaryFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="sort-control">
              <ArrowUpDown size={15} />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="popularity">Most popular</option>
                <option value="priceAsc">Price: low to high</option>
                <option value="priceDesc">Price: high to low</option>
                <option value="rating">Highest rated</option>
              </select>
            </label>
          </div>
        </div>

        {/* Subcategories Shelf if available */}
        {currentCategoryObj?.subCategories?.length > 0 && (
          <div className="subcategory-shelf" aria-label="Sub-categories" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '0 0 20px', padding: '4px 0' }}>
            <button
              className={activeSubCategory === 'all' ? 'category-pill active' : 'category-pill'}
              style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', border: '1px solid #e2e8f0', background: activeSubCategory === 'all' ? '#0f172a' : '#fff', color: activeSubCategory === 'all' ? '#fff' : '#475569', fontWeight: 600 }}
              onClick={() => setActiveSubCategory('all')}
            >
              All {currentCategoryObj.name}
            </button>
            {selectedSubCategory?.path.length > 1 && (
              <button
                className="category-pill"
                style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600 }}
                onClick={() => setActiveSubCategory(String(selectedSubCategory.path.at(-2).categoryId))}
              >
                ← {selectedSubCategory.path.at(-2).name}
              </button>
            )}
            {selectedSubCategory?.node.children?.length > 0 && (
              <button
                className="category-pill active"
                style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', border: '1px solid #ea580c', background: '#ea580c', color: '#fff', fontWeight: 600 }}
                onClick={() => setActiveSubCategory(String(selectedSubCategory.node.categoryId))}
              >
                All {selectedSubCategory.node.name}
              </button>
            )}
            {(selectedSubCategory?.node.children?.length
              ? selectedSubCategory.node.children
              : selectedSubCategory?.path.length > 1
                ? selectedSubCategory.path.at(-2).children || []
                : currentCategoryObj.subCategories).map(sub => (
              <button
                key={sub.categoryId}
                className={activeSubCategory === String(sub.categoryId) ? 'category-pill active' : 'category-pill'}
                style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', border: '1px solid #e2e8f0', background: activeSubCategory === String(sub.categoryId) ? '#ea580c' : '#fff', color: activeSubCategory === String(sub.categoryId) ? '#fff' : '#475569', fontWeight: 600 }}
                onClick={() => setActiveSubCategory(String(sub.categoryId))}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}

        {/* Product Cards Grid */}
        {filteredProducts.length ? activeCategory === 'all' ? (
          <div className="menu-category-groups">
            {menuProductGroups.map(group => (
              <section className="menu-category-group" key={group.slug} aria-labelledby={`menu-category-${group.slug}`}>
                <div className="menu-category-group__heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <h3 id={`menu-category-${group.slug}`} style={{ margin: 0, fontSize: '1.4rem' }}>{group.name}</h3>
                  {group.totalCount > 4 && (
                    <button
                      type="button"
                      className="view-all-category-btn"
                      onClick={() => handleSelectCategory(group.slug)}
                      style={{
                        background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                        border: '1.5px solid #ea580c',
                        color: '#c2410c',
                        padding: '6px 18px',
                        borderRadius: '24px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(234, 88, 12, 0.1)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      View All <ChevronRight size={15} style={{ strokeWidth: 2.5 }} />
                    </button>
                  )}
                </div>
                <div className="product-grid">
                  {group.products.slice(0, 4).map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelectProduct={onSelectProduct}
                      onOpenCakeCustomizer={onOpenCakeCustomizer}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '22px', padding: '14px 20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Category</span>
                <h3 style={{ margin: '2px 0 0', color: '#0f172a', fontSize: '1.35rem', fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {currentCategoryObj?.name || activeCategory}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleSelectCategory('all')}
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  color: '#334155',
                  padding: '7px 18px',
                  borderRadius: '10px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                ← Back to All Categories
              </button>
            </div>
            <div className="product-grid">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelectProduct={onSelectProduct}
                  onOpenCakeCustomizer={onOpenCakeCustomizer}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <Cake size={32} />
            <h3>No items found</h3>
            <p>Try another category or clear your filters.</p>
            <button className="button button--primary" onClick={() => { setActiveCategory('all'); setDietaryFilter('all'); }}>
              Clear filters
            </button>
          </div>
        )}
        {hasMoreProducts && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '22px' }}>
            <button className="button button--primary" onClick={loadNextProductPage} disabled={productsLoading}>
              {productsLoading ? 'Loading more products…' : `Load more products (${productTotalCount - products.length} left)`}
            </button>
          </div>
        )}
      </section>

      {/* ─── 10. BRANCH / DELIVERY & TRUST INFORMATION ─── */}
      <section className="branches-section" id="branches" style={{ margin: '54px 0' }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow" style={{ color: '#dc2626' }}><MapPin size={14} /> Our Branches & Policies</span>
            <h2>Find and Contact a Branch</h2>
          </div>
          <p>Contact a branch to confirm current hours, service availability, delivery coverage, and table reservations.</p>
        </div>

        {/* Branches Grid */}
        <div className="branches-grid">
          {branches.map(branch => (
            <div key={branch.id} className="branch-card">
              <h3>{branch.name}</h3>
              <p>{branch.address}</p>
              <div className="branch-card__actions">
                {branch.phone ? (
                  <>
                    <a
                      href={`https://wa.me/${String(branch.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hello Kabir's Kitchen, I would like to contact ${branch.name}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-whatsapp"
                    >
                      <MessageCircle size={15} /> WhatsApp branch
                    </a>
                    <a href={`tel:${branch.phone}`} className="btn-call">
                      <Phone size={14} /> Call {branch.phone}
                    </a>
                  </>
                ) : <span>Branch phone not available.</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 11. COMPACT FLOATING SUPPORT BUTTONS (WHATSAPP & LIVE CHAT) ─── */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 99,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'center'
        }}
      >
        {/* WhatsApp Circular Icon Button */}
        <a
          href="https://wa.me/8801791665634?text=Hello%20Kabir's%20Kitchen!%20I%20have%20an%20inquiry%20about%20your%20food%20and%20orders."
          target="_blank"
          rel="noopener noreferrer"
          title="Chat on WhatsApp"
          aria-label="Chat on WhatsApp"
          className="floating-whatsapp-btn"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.187-2.59-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.15.57 4.168 1.564 5.918l-1.657 6.05 6.223-1.632c1.69.924 3.633 1.464 5.71 1.464 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>

        {/* Live Chat Circular Icon Button */}
        <button
          type="button"
          onClick={onOpenChat}
          title="Live Support Chat"
          aria-label="Live Support Chat"
          className="floating-livechat-btn"
        >
          <MessageCircle size={21} />
          {/* Online green indicator badge */}
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#22c55e',
              border: '2px solid #071c14'
            }}
          />
        </button>
      </div>
    </main>
  );
}
