// main.js – TAFLIM - النسخة النهائية مع نظام اللغات الذكي

const apiKey = "dbb14198ea29a547de77343dc3fe7a37";
const baseURL = "https://api.themoviedb.org/3";
const imageBase = "https://image.tmdb.org/t/p/w500";

// ===== نظام اللغات الذكي =====
const LANGUAGE_PREFERENCES = {
  // محتوى هندي: عربي > إنجليزي
  "hi": { primary: "ar", fallback: "en", flag: "🇮🇳", name: "هندي" },
  
  // كي دراما (كوري): عربي > إنجليزي
  "ko": { primary: "ar", fallback: "en", flag: "🇰🇷", name: "كوري" },
  
  // محتوى تركي: عربي > إنجليزي
  "tr": { primary: "ar", fallback: "en", flag: "🇹🇷", name: "تركي" },
  
  // محتويات آسيوية أخرى: عربي > إنجليزي
  "zh": { primary: "ar", fallback: "en", flag: "🇨🇳", name: "صيني" },
  "ja": { primary: "ar", fallback: "en", flag: "🇯🇵", name: "ياباني" },
  "th": { primary: "ar", fallback: "en", flag: "🇹🇭", name: "تايلاندي" },
  "vi": { primary: "ar", fallback: "en", flag: "🇻🇳", name: "فيتنامي" },
  
  // محتوى عربي
  "ar": { primary: "ar", fallback: null, flag: "🇸🇦", name: "عربي" },
  
  // إنجليزي
  "en": { primary: "en", fallback: null, flag: "🇺🇸", name: "إنجليزي" },
  
  // باقي المحتويات: تبقى بلغتها الأصلية
  "default": { primary: null, fallback: null, flag: "🌍", name: "أجنبي" }
};

// ===== دالة مساعدة للحصول على معلومات اللغة =====
function getLanguageInfo(langCode) {
  return LANGUAGE_PREFERENCES[langCode] || LANGUAGE_PREFERENCES["default"];
}

// ===== عناصر DOM =====
const trendingContainer = document.getElementById("trending-container");
const mainContent = document.getElementById("main-content");
const searchInput = document.getElementById("search");
const loadMoreBtn = document.querySelector(".load-more");
const backToTopBtn = document.getElementById("back-to-top");
const menuBtn = document.getElementById("menu-btn");
const sidebar = document.getElementById("sidebar");
const closeSidebar = document.getElementById("close-sidebar");
const overlay = document.getElementById("overlay");
const leftArrow = document.querySelector('.trending-arrow.left');
const rightArrow = document.querySelector('.trending-arrow.right');
const suggestionsContainer = document.getElementById("search-suggestions");

// ===== متغيرات السلايدر Netflix Style =====
let sliderAnimation = null;
let isSliderPaused = false;
let isUserInteracting = false;
let lastScrollTime = 0;
let scrollDirection = 1;
let currentTargetIndex = 0;

// إعدادات السلايدر البطيء جداً (Netflix Style)
const SLIDER_CONFIG = {
  speed: 0.18,
  pauseDuration: 3200,
  autoPlayDelay: 3500,
  scrollThreshold: 25,
  easing: 0.055,
  snapDuration: 800
};

// ===== متغيرات عامة =====
let originalAllContent = [];
let allContent = [];
let displayedCount = 0;
const itemsPerLoad = 20;
let searchTimer = null;
const globalCache = {};
let activeSuggestionIndex = -1;

// ===== دالة ذكية لجلب العنوان باللغة المناسبة =====
async function getSmartTitle(item) {
  if (!item) return "غير معروف";
  
  const originalLang = item.original_language || "en";
  const langInfo = getLanguageInfo(originalLang);
  
  // إذا كانت اللغة الأصلية عربية أو إنجليزية، نستخدمها مباشرة
  if (originalLang === "ar" || originalLang === "en") {
    return item.title || item.name || "غير معروف";
  }
  
  // إذا كان المحتوى من الأنواع المطلوبة (هندي/كوري/تركي/آسيوي)
  if (langInfo.primary === "ar") {
    try {
      // أولاً: نحاول جلب النسخة العربية
      const type = item.media_type || (item.title ? "movie" : "tv");
      const arabicRes = await fetch(
        `${baseURL}/${type}/${item.id}?api_key=${apiKey}&language=ar`
      );
      
      if (arabicRes.ok) {
        const arabicData = await arabicRes.json();
        const arabicTitle = arabicData.title || arabicData.name;
        if (arabicTitle && arabicTitle !== item.title && arabicTitle !== item.name) {
          return arabicTitle;
        }
      }
      
      // إذا لم توجد ترجمة عربية، نستخدم الإنجليزية
      if (langInfo.fallback === "en") {
        const englishRes = await fetch(
          `${baseURL}/${type}/${item.id}?api_key=${apiKey}&language=en`
        );
        
        if (englishRes.ok) {
          const englishData = await englishRes.json();
          const englishTitle = englishData.title || englishData.name;
          if (englishTitle) {
            return englishTitle;
          }
        }
      }
    } catch (error) {
      console.warn(`خطأ في ترجمة المحتوى ${item.id}:`, error);
    }
  }
  
  // إذا فشل كل شيء، نستخدم العنوان الأصلي
  return item.title || item.name || "غير معروف";
}

// ===== دالة محسنة لجلب الصفحات مع العناوين الذكية =====
async function fetchPages(endpoint, pages = [1]) {
  const results = [];
  
  for (const p of pages) {
    try {
      const res = await fetch(
        `${baseURL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}&language=ar&page=${p}`
      );
      
      if (!res.ok) continue;
      const data = await res.json();
      
      if (data.results) {
        // معالجة كل عنصر للحصول على العنوان الذكي
        for (const item of data.results) {
          if (!item.poster_path) continue;
          
          // الحصول على العنوان الذكي (سيتم جلب الترجمة إذا لزم الأمر)
          const smartTitle = await getSmartTitle(item);
          
          const enhancedItem = {
            ...item,
            // نستخدم العنوان الذكي بدلاً من العنوان الأصلي
            title: item.title ? smartTitle : undefined,
            name: item.name ? smartTitle : undefined,
            // نضيف معلومات اللغة
            original_language: item.original_language || "en",
            language_info: getLanguageInfo(item.original_language || "en")
          };
          
          // تحديد نوع المحتوى
          enhancedItem.type = item.title ? "movie" : "tv";
          if (item.genre_ids?.includes(16) || item.original_language === "ja") {
            enhancedItem.type = "anime";
          }
          
          results.push(enhancedItem);
        }
      }
    } catch (e) {
      console.warn(`fetchPages error page ${p}:`, e);
    }
  }
  
  return results;
}

// ===== دالة إنشاء كروت السلايدر المعدلة =====
function createSliderCard(item) {
  const card = document.createElement("div");
  card.className = "trending-card";
  card.dataset.id = item.id;
  
  const title = item.title || item.name || "غير معروف";
  const originalLang = item.original_language || "en";
  const langInfo = getLanguageInfo(originalLang);
  
  // اختيار الصورة المناسبة بناءً على اللغة
  let poster = "";
  if (["hi", "ko", "tr", "zh", "ja", "th", "vi"].includes(originalLang)) {
    // محتوى هندي/كوري/تركي/آسيوي: نفضل الصورة المحلية
    poster = item.poster_path ? `${imageBase}${item.poster_path}` : "";
  } else {
    // باقي المحتويات
    poster = item.backdrop_path 
      ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` 
      : item.poster_path 
        ? `${imageBase}${item.poster_path}`
        : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMTYxQjIwIi8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPlRBRkxJTTwvdGV4dD4KPC9zdmc+';
  }
  
  card.innerHTML = `
    <img src="${poster}" alt="${title}" loading="lazy">
    <h3>${title}</h3>
  `;
  
  card.onclick = () => {
    const type = item.media_type === "movie" ? "movie" : "tv";
    window.location.href = `details.html?type=${type}&id=${item.id}`;
  };
  
  return card;
}

// ===== دالة إنشاء كروت المحتوى المعدلة =====
function createCardElement(item) {
  const card = document.createElement("div");
  card.className = "card";
  const title = item.title || item.name || "غير معروف";
  const originalLang = item.original_language || "en";
  const langInfo = getLanguageInfo(originalLang);
  
  // اختيار الصورة المناسبة بناءً على اللغة
  let poster = "";
  if (["hi", "ko", "tr", "zh", "ja", "th", "vi"].includes(originalLang)) {
    // محتوى هندي/كوري/تركي/آسيوي: نفضل الصورة المحلية
    poster = item.poster_path ? `${imageBase}${item.poster_path}` : "";
  } else {
    // باقي المحتويات: الصورة الأصلية
    poster = item.poster_path ? `${imageBase}${item.poster_path}` : "";
  }
  
  // إضافة شارة اللغة
  const langBadge = langInfo.flag;
  const langName = langInfo.name;
  
  card.innerHTML = `
  <img src="${poster}" alt="${title}" loading="lazy">
  <div style="padding: 12px; text-align: center;">
    <h3>${title}</h3>
  </div>
`;
  
  card.onclick = () => {
    const type = (item.media_type === "movie" || item.type === "movie") ? "movie" : "tv";
    window.location.href = `details.html?type=${type}&id=${item.id}`;
  };
  return card;
}

// ===== دالة محسنة لعرض الاقتراحات =====
async function showSearchSuggestions(query) {
  if (!suggestionsContainer) return;
  
  if (!query || query.trim().length < 2) {
    suggestionsContainer.style.display = 'none';
    activeSuggestionIndex = -1;
    return;
  }
  
  const searchTerm = query.toLowerCase().trim();
  
  // البحث في المحتوى المحلي أولاً
  const localResults = originalAllContent.filter(item => {
    const title = (item.title || item.name || "").toLowerCase();
    return title.includes(searchTerm);
  }).slice(0, 8);
  
  suggestionsContainer.innerHTML = '';
  activeSuggestionIndex = -1;
  
  if (localResults.length > 0) {
    localResults.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.dataset.index = index;
      
      const year = (item.release_date || item.first_air_date || "").substring(0, 4);
      const langInfo = getLanguageInfo(item.original_language || "en");
      const typeIcon = item.type === 'movie' ? '🎬' : item.type === 'anime' ? '🇯🇵' : '📺';
      const typeText = item.type === 'movie' ? 'فيلم' : item.type === 'anime' ? 'أنمي' : 'مسلسل';
      
      div.innerHTML = `
        <img src="${item.poster_path ? imageBase + item.poster_path : 'https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png'}" 
             alt="${item.title || item.name}"
             onerror="this.src='https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png'">
        <div class="suggestion-info">
          <div class="suggestion-title">${item.title || item.name}</div>
          <div class="suggestion-type">
          ${typeIcon} ${typeText} • ${langInfo.flag} ${langInfo.name} • ${year || 'غير معروف'}
          </div>
        </div>
      `;
      
      div.onclick = () => {
        const type = item.media_type === "movie" ? "movie" : "tv";
        window.location.href = `details.html?type=${type}&id=${item.id}`;
      };
      
      div.onmouseenter = () => {
        document.querySelectorAll('.suggestion-item').forEach(s => s.classList.remove('active'));
        div.classList.add('active');
        activeSuggestionIndex = index;
      };
      
      suggestionsContainer.appendChild(div);
    });
    
    suggestionsContainer.style.display = 'block';
  } else {
    suggestionsContainer.innerHTML = `
      <div class="no-results">
        <div>🔍 جاري البحث عن "${query}"...</div>
      </div>
    `;
    suggestionsContainer.style.display = 'block';
  }
}

// ===== السلايدر Netflix Style =====
function initSlider() {
  if (!trendingContainer) return;
  
  trendingContainer.innerHTML = "";
  
  // الحصول على المحتوى المتداول
  const trendingList = [...allContent]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 15);

  if (trendingList.length === 0) {
    trendingContainer.innerHTML = "<p style='padding:20px;color:#aaa;text-align:center;width:100%'>لا يوجد عناصر شائعة الآن</p>";
    return;
  }

  // إضافة 3 مجموعات من الكروت لضمان الحركة اللانهائية
  for (let i = 0; i < 3; i++) {
    trendingList.forEach((item) => {
      const card = createSliderCard(item);
      trendingContainer.appendChild(card);
    });
  }

  // إعداد التمرير الأولي
  trendingContainer.scrollLeft = 0;
  currentTargetIndex = 0;
  
  // بدء الحركة التلقائية
  setTimeout(() => {
    startNetflixStyleSlider();
  }, 1000);
  
  // إعداد عناصر التحكم
  setupSliderControls();
}

// حركة السلايدر على طريقة Netflix
function startNetflixStyleSlider() {
  if (!trendingContainer || trendingContainer.children.length === 0) return;
  
  stopSlider();
  
  let lastTime = performance.now();
  let pauseTimer = null;
  let isPausedAtCenter = false;
  let velocity = 0;
  let targetScroll = 0;
  let lastPauseTime = 0;
  
  const animate = (currentTime) => {
    if (!trendingContainer) return;
    
    const deltaTime = Math.min(currentTime - lastTime, 32);
    lastTime = currentTime;
    
    if (isUserInteracting) {
      sliderAnimation = requestAnimationFrame(animate);
      return;
    }
    
    if (isPausedAtCenter) {
      sliderAnimation = requestAnimationFrame(animate);
      return;
    }
    
    const timeSinceLastPause = currentTime - lastPauseTime;
    if (timeSinceLastPause < SLIDER_CONFIG.pauseDuration) {
      sliderAnimation = requestAnimationFrame(animate);
      return;
    }
    
    const cardWidth = trendingContainer.children[0]?.offsetWidth || 200;
    const gap = 20;
    const cardStep = cardWidth + gap;
    const containerWidth = trendingContainer.clientWidth;
    const centerPosition = containerWidth / 2;
    const currentScroll = trendingContainer.scrollLeft;
    
    const closestIndex = Math.round((currentScroll + centerPosition) / cardStep);
    const closestCardCenter = (closestIndex * cardStep) - centerPosition + (cardWidth / 2);
    const distanceToCenter = Math.abs(closestCardCenter - (currentScroll + centerPosition));
    
    if (distanceToCenter < SLIDER_CONFIG.scrollThreshold) {
      isPausedAtCenter = true;
      lastPauseTime = currentTime;
      
      trendingContainer.style.scrollBehavior = 'smooth';
      trendingContainer.scrollLeft = closestCardCenter - (cardWidth / 2);
      
      pauseTimer = setTimeout(() => {
        isPausedAtCenter = false;
        currentTargetIndex = (closestIndex + 1) % (trendingContainer.children.length / 3);
        velocity = SLIDER_CONFIG.speed;
      }, SLIDER_CONFIG.pauseDuration);
      
      sliderAnimation = requestAnimationFrame(animate);
      return;
    }
    
    if (targetScroll === 0) {
      targetScroll = currentScroll + cardStep;
    }
    
    const diff = targetScroll - currentScroll;
    velocity = diff * SLIDER_CONFIG.easing;
    
    const moveAmount = velocity * (deltaTime / 16.67) * (SLIDER_CONFIG.speed / 0.3);
    trendingContainer.scrollLeft += moveAmount;
    
    if (Math.abs(diff) < 5) {
      targetScroll = 0;
    }
    
    const totalWidth = trendingContainer.scrollWidth;
    const oneThirdWidth = totalWidth / 3;
    
    if (trendingContainer.scrollLeft >= oneThirdWidth * 2) {
      trendingContainer.style.transition = 'none';
      trendingContainer.scrollLeft -= oneThirdWidth;
      setTimeout(() => {
        trendingContainer.style.transition = 'scroll-left 0.5s ease';
      }, 50);
      targetScroll = trendingContainer.scrollLeft + cardStep;
    }
    
    sliderAnimation = requestAnimationFrame(animate);
  };
  
  setTimeout(() => {
    sliderAnimation = requestAnimationFrame(animate);
  }, 1000);
}

// إيقاف السلايدر
function stopSlider() {
  if (sliderAnimation) {
    cancelAnimationFrame(sliderAnimation);
    sliderAnimation = null;
  }
}

// إعداد عناصر التحكم بالسلايدر
function setupSliderControls() {
  if (!trendingContainer) return;
  
  if (leftArrow) {
    leftArrow.addEventListener('click', () => {
      navigateToCard('prev');
    });
  }
  
  if (rightArrow) {
    rightArrow.addEventListener('click', () => {
      navigateToCard('next');
    });
  }
  
  trendingContainer.addEventListener('mouseenter', () => {
    isUserInteracting = true;
    trendingContainer.style.cursor = 'grab';
  });
  
  trendingContainer.addEventListener('mouseleave', () => {
    setTimeout(() => {
      isUserInteracting = false;
      trendingContainer.style.cursor = 'default';
    }, SLIDER_CONFIG.autoPlayDelay);
  });
  
  let isDragging = false;
  let startX;
  let scrollLeftStart;
  
  trendingContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    isUserInteracting = true;
    startX = e.pageX - trendingContainer.offsetLeft;
    scrollLeftStart = trendingContainer.scrollLeft;
    trendingContainer.style.cursor = 'grabbing';
    trendingContainer.style.scrollBehavior = 'auto';
    stopSlider();
  });
  
  trendingContainer.addEventListener('mouseup', () => {
    isDragging = false;
    trendingContainer.style.cursor = 'grab';
    
    setTimeout(() => {
      snapToNearestCard();
    }, 100);
    
    setTimeout(() => {
      trendingContainer.style.cursor = 'default';
      isUserInteracting = false;
      startNetflixStyleSlider();
    }, SLIDER_CONFIG.autoPlayDelay);
  });
  
  trendingContainer.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - trendingContainer.offsetLeft;
    const walk = (x - startX) * 1.5;
    trendingContainer.scrollLeft = scrollLeftStart - walk;
  });
  
  trendingContainer.addEventListener('touchstart', (e) => {
    isUserInteracting = true;
    startX = e.touches[0].pageX - trendingContainer.offsetLeft;
    scrollLeftStart = trendingContainer.scrollLeft;
    stopSlider();
  }, { passive: true });
  
  trendingContainer.addEventListener('touchend', () => {
    setTimeout(() => {
      snapToNearestCard();
      setTimeout(() => {
        isUserInteracting = false;
        startNetflixStyleSlider();
      }, SLIDER_CONFIG.autoPlayDelay);
    }, 100);
  });
}

// التمرير إلى كرت معين
function navigateToCard(direction) {
  if (!trendingContainer) return;
  
  isUserInteracting = true;
  stopSlider();
  
  const cardWidth = trendingContainer.children[0]?.offsetWidth || 200;
  const gap = 20;
  const cardStep = cardWidth + gap;
  const containerWidth = trendingContainer.clientWidth;
  const centerPosition = containerWidth / 2;
  const currentScroll = trendingContainer.scrollLeft;
  
  let targetScroll;
  
  if (direction === 'next') {
    targetScroll = currentScroll + cardStep;
    currentTargetIndex++;
  } else {
    targetScroll = currentScroll - cardStep;
    currentTargetIndex--;
  }
  
  const targetCenter = (currentTargetIndex * cardStep) - centerPosition + (cardWidth / 2);
  
  trendingContainer.style.scrollBehavior = 'smooth';
  trendingContainer.scrollLeft = targetCenter - (cardWidth / 2);
  
  setTimeout(() => {
    isUserInteracting = false;
    startNetflixStyleSlider();
  }, SLIDER_CONFIG.autoPlayDelay + 1000);
}

// الانتقال لأقرب كرت
function snapToNearestCard() {
  if (!trendingContainer) return;
  
  const cardWidth = trendingContainer.children[0]?.offsetWidth || 200;
  const gap = 20;
  const cardStep = cardWidth + gap;
  const containerWidth = trendingContainer.clientWidth;
  const centerPosition = containerWidth / 2;
  const currentScroll = trendingContainer.scrollLeft;
  
  const closestIndex = Math.round((currentScroll + centerPosition) / cardStep);
  const targetCenter = (closestIndex * cardStep) - centerPosition + (cardWidth / 2);
  
  trendingContainer.style.scrollBehavior = 'smooth';
  trendingContainer.scrollLeft = targetCenter - (cardWidth / 2);
  
  currentTargetIndex = closestIndex;
}

// ===== دالة محسنة لجلب كل المحتوى =====
async function loadAllContent() {
  try {
    mainContent.innerHTML = "<p style='grid-column:1/-1;text-align:center;color:#ff3b3b;padding:40px'>جاري تحميل المحتوى بلغاته المناسبة...</p>";
    
    // جلب المحتوى بنظام اللغات الذكي
    const [trending, movies, series, anime] = await Promise.all([
      fetchPages("/trending/all/week", [1]),
      fetchPages("/movie/popular", [1, 2]),
      fetchPages("/tv/popular", [1, 2]),
      fetchPages("/discover/tv?with_genres=16", [1, 2])
    ]);

    let merged = [...trending, ...movies, ...series, ...anime];
    
    // إزالة التكرارات
    const seen = new Set();
    merged = merged.filter(item => !seen.has(item.id) && seen.add(item.id));

    originalAllContent = merged;
    allContent = [...originalAllContent];
    displayedCount = 0;
    mainContent.innerHTML = "";
    loadMoreContent();
    
    // تهيئة السلايدر بعد تحميل المحتوى
    setTimeout(() => {
      initSlider();
    }, 500);
    
  } catch (err) {
    console.error("خطأ في تحميل المحتوى:", err);
    mainContent.innerHTML = `
      <p style='grid-column:1/-1;text-align:center;color:#ff3b3b;padding:50px'>
        فشل تحميل المحتوى
        <br>
        <button id='retry-load' style='
          background:#ff3b3b;
          color:white;
          border:none;
          padding:10px 20px;
          border-radius:8px;
          cursor:pointer;
          margin-top:15px;
          font-family: inherit;
        '>
          إعادة المحاولة
        </button>
      </p>
    `;
    document.getElementById('retry-load')?.addEventListener('click', loadAllContent);
  }
}

function loadMoreContent() {
  const nextItems = allContent.slice(displayedCount, displayedCount + itemsPerLoad);
  nextItems.forEach(item => mainContent.appendChild(createCardElement(item)));
  displayedCount += nextItems.length;
  if (loadMoreBtn) {
    loadMoreBtn.style.display = displayedCount >= allContent.length ? "none" : "block";
  }
}

function setupBackToTop() {
  if (!backToTopBtn) return;
  
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      backToTopBtn.style.display = "flex";
    } else {
      backToTopBtn.style.display = "none";
    }
  });
  
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function setupSidebar() {
  if (!menuBtn || !sidebar || !overlay || !closeSidebar) return;
  
  menuBtn.onclick = (e) => { 
    e.stopPropagation();
    sidebar.classList.add("show"); 
    overlay.classList.add("show"); 
  };
  
  closeSidebar.onclick = (e) => { 
    e.stopPropagation();
    sidebar.classList.remove("show"); 
    overlay.classList.remove("show"); 
  };
  
  overlay.onclick = (e) => { 
    if (e.target === overlay) {
      sidebar.classList.remove("show"); 
      overlay.classList.remove("show"); 
    }
  };
  
  // إغلاق السايدبار عند النقر على رابط
  document.querySelectorAll('#sidebar a').forEach(link => {
    link.addEventListener('click', () => {
      sidebar.classList.remove("show");
      overlay.classList.remove("show");
    });
  });
}

// ===== نظام الفلاتر =====
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = (e) => {
      const dropdown = btn.nextElementSibling;
      const isActive = dropdown.classList.contains('active');

      document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));

      if (!isActive) {
        dropdown.classList.add('active');
        btn.classList.add('active');
      }
      e.stopPropagation();
    };
  });

  document.querySelectorAll('.filter-dropdown button').forEach(item => {
    item.onclick = (e) => {
      const dropdown = item.closest('.filter-dropdown');
      dropdown.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      item.classList.add('active');
      
      applyFilters();
      
      dropdown.classList.remove('active');
      item.closest('.filter-group').querySelector('.filter-btn').classList.remove('active');
      e.stopPropagation();
    };
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  });
}

function applyFilters() {
  let filtered = [...originalAllContent];
  
  document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
    const activeBtn = dropdown.querySelector('button.active');
    if (!activeBtn) return;
    
    const value = activeBtn.dataset.value || "";
    const filterType = dropdown.closest('.filter-group').querySelector('.filter-btn').dataset.filter;
    
    if (!value) return;
    
    switch(filterType) {
      case 'category':
        if (value === 'kdrama') filtered = filtered.filter(i => i.original_language === "ko");
        else if (value === 'anime') filtered = filtered.filter(i => i.type === "anime" || (i.genre_ids?.includes(16)));
        else if (value === 'foreign') filtered = filtered.filter(i => i.original_language && !["ar","ko","ja","zh"].includes(i.original_language));
        else if (value === 'arabic') filtered = filtered.filter(i => i.original_language === "ar");
        break;
      case 'genre':
        filtered = filtered.filter(i => i.genre_ids?.includes(Number(value)));
        break;
      case 'year':
        if (value === 'older') {
          filtered = filtered.filter(i => {
            const y = (i.release_date || i.first_air_date || "").split("-")[0];
            return y && parseInt(y) < 2020;
          });
        } else {
          filtered = filtered.filter(i => (i.release_date || i.first_air_date || "").split("-")[0] === value);
        }
        break;
      case 'rating':
        if (value === 'family') filtered = filtered.filter(i => !i.adult);
        else filtered = filtered.filter(i => i.vote_average >= Number(value));
        break;
    }
  });
  
  allContent = filtered;
  displayedCount = 0;
  mainContent.innerHTML = "";
  loadMoreContent();
  
  setTimeout(() => {
    initSlider();
  }, 300);
}

// ===== البحث والاقتراحات =====
function setupSearch() {
  if (!searchInput || !suggestionsContainer) return;
  
  const quickFix = {
    "فينسنزو": "Vincenzo", "فينسينزو": "Vincenzo",
    "لعبة الحبار": "Squid Game", "الحبار": "Squid Game",
    "هبوط اضطراري": "Crash Landing on You",
    "الغوبلن": "Goblin", "الغوبلين": "Goblin",
    "المجد": "The Glory", "ذي غلوري": "The Glory",
    "جوكر": "Joker", "الجوكر": "Joker",
    "الملك": "The King Eternal Monarch",
    "الوريثة": "The Heirs",
    "الكيمياء": "Alchemy of Souls",
    "القمر": "Moon Lovers",
    "الشمس": "Descendants of the Sun"
  };
  
  // البحث أثناء الكتابة (للاقتراحات)
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    
    // عرض الاقتراحات مباشرة
    showSearchSuggestions(q);
    
    // البحث الكامل بعد تأخير
    searchTimer = setTimeout(async () => {
      if (!q) {
        allContent = [...originalAllContent];
        displayedCount = 0;
        mainContent.innerHTML = "";
        loadMoreContent();
        initSlider();
        return;
      }
      
      mainContent.innerHTML = "<p style='grid-column:1/-1;text-align:center;color:#ff3b3b;padding:40px'>جاري البحث...</p>";
      
      let query = q;
      for (const [wrong, correct] of Object.entries(quickFix)) {
        if (q.toLowerCase().includes(wrong.toLowerCase())) {
          query = correct;
          break;
        }
      }
      
      let results = originalAllContent.filter(i => 
        (i.title || "").toLowerCase().includes(query.toLowerCase()) ||
        (i.name || "").toLowerCase().includes(query.toLowerCase())
      );
      
      if (results.length === 0 && !globalCache[query]) {
        try {
          const res = await fetch(`${baseURL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=ar`);
          const data = await res.json();
          globalCache[query] = data.results?.filter(i => i?.poster_path) || [];
        } catch {}
        results = globalCache[query] || [];
      }
      
      mainContent.innerHTML = "";
      if (results.length === 0) {
        mainContent.innerHTML = `
          <p style='grid-column:1/-1;text-align:center;color:#aaa;padding:60px'>
            لا توجد نتائج لـ "${q}"
          </p>
        `;
      } else {
        results.forEach(item => mainContent.appendChild(createCardElement(item)));
      }
      
      if (trendingContainer && results.length > 0) {
        trendingContainer.innerHTML = "";
        const trendingResults = results.slice(0, 15);
        for (let i = 0; i < 3; i++) {
          trendingResults.forEach(item => {
            const card = createSliderCard(item);
            trendingContainer.appendChild(card);
          });
        }
        trendingContainer.scrollLeft = 0;
        setTimeout(() => {
          startNetflixStyleSlider();
        }, 300);
      }
    }, 800);
  });
  
  // إخفاء الاقتراحات عند النقر خارجها
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.style.display = 'none';
      activeSuggestionIndex = -1;
    }
  });
  
  // التنقل بالأسهم في الاقتراحات
  searchInput.addEventListener('keydown', (e) => {
    const suggestions = document.querySelectorAll('.suggestion-item');
    
    if (suggestions.length === 0 || suggestionsContainer.style.display === 'none') return;
    
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (activeSuggestionIndex < suggestions.length - 1) {
          if (activeSuggestionIndex >= 0) {
            suggestions[activeSuggestionIndex].classList.remove('active');
          }
          activeSuggestionIndex++;
          suggestions[activeSuggestionIndex].classList.add('active');
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (activeSuggestionIndex > 0) {
          suggestions[activeSuggestionIndex].classList.remove('active');
          activeSuggestionIndex--;
          suggestions[activeSuggestionIndex].classList.add('active');
        }
        break;
        
      case 'Enter':
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
          e.preventDefault();
          suggestions[activeSuggestionIndex].click();
        }
        break;
        
      case 'Escape':
        suggestionsContainer.style.display = 'none';
        activeSuggestionIndex = -1;
        break;
    }
  });
}

// ===== تهيئة التطبيق =====
function initApp() {
  console.log("🚀 تطبيق TAFLIM يعمل...");
  
  // تحميل المحتوى أولاً
  loadAllContent();
  
  // إعداد المكونات الأخرى
  setTimeout(() => {
    setupSidebar();
    setupBackToTop();
    setupSearch();
    setupFilters();
  }, 100);
}

// ===== التعريفات العامة =====
window.loadMore = loadMoreContent;

// بدء التطبيق
document.addEventListener('DOMContentLoaded', initApp);

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
  stopSlider();
});

// إعادة تحميل السلايدر عند تغيير الحجم
window.addEventListener('resize', () => {
  if (trendingContainer && trendingContainer.children.length > 0) {
    trendingContainer.scrollLeft = 0;
    stopSlider();
    setTimeout(() => {
      startNetflixStyleSlider();
    }, 500);
  }
});
