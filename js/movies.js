const TMDB_KEY = "dbb14198ea29a547de77343dc3fe7a37";
const OMDB_KEY = "6584b042";
const WATCHMODE_KEY = "OxatsNqfOlchppjmnwDGXWmBQ1Ff9hAh72nVVdoz";
const TASTEDIVE_KEY = "1063414-sfinxcre-2FF487CB";

const baseURL = "https://api.themoviedb.org/3";
const imageBase = "https://image.tmdb.org/t/p/w500";

const contentGrid = document.getElementById("content-grid");
const searchInput = document.getElementById("search");
const filterSelect = document.getElementById("filter");
const paginationContainer = document.getElementById("pagination");

let moviesData = [];
let currentPage = 1;
const itemsPerPage = 20;
let searchTimer;
const globalCache = {};

// تصحيح إملائي ذكي + فهم نية
const quickFix = {
  "فينسنزو": "Vincenzo", "فينسينزو": "Vincenzo",
  "لعبة الحبار": "Squid Game", "الحبار": "Squid Game",
  "هبوط اضطراري": "Crash Landing on You",
  "الغوبلن": "Goblin", "الغوبلين": "Goblin",
  "المجد": "The Glory", "ذي غلوري": "The Glory",
  "جوكر": "Joker", "الجوكر": "Joker"
};

async function smartCorrect(query) {
  if (query.length < 3) return query;
  const lower = query.toLowerCase();
  for (const [wrong, correct] of Object.entries(quickFix)) {
    if (lower.includes(wrong.toLowerCase())) return correct;
  }
  return query;
}

// جلب الأفلام من TMDB (مع fallback لـ OMDb لو TMDB وقع)
async function loadMovies() {
  try {
    const res = await fetch(`${baseURL}/movie/popular?api_key=${TMDB_KEY}&language=ar&page=1,2`);
    if (!res.ok) throw new Error("TMDB فشل");
    const data = await res.json();
    moviesData = data.results.filter(m => m.poster_path).map(m => ({
      ...m,
      titleFinal: m.title || "غير معروف",
      posterFinal: m.poster_path
    }));
  } catch (e) {
    console.log("TMDB فشل → نجرب OMDb...");
    try {
      const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&s=movie&type=movie&page=1`);
      const data = await res.json();
      moviesData = (data.Search || []).map(item => ({
        id: item.imdbID?.replace("tt", ""),
        titleFinal: item.Title,
        posterFinal: item.Poster !== "N/A" ? null : "img/no-poster.jpg",
        release_date: item.Year ? `${item.Year}-01-01` : null
      }));
    } catch (e2) {
      contentGrid.innerHTML = "<p style='color:#ff3b3b;text-align:center;padding:50px'>فشل تحميل الأفلام من كل المصادر</p>";
      return;
    }
  }
  renderPage(currentPage);
}

// عرض الصفحة
function renderPage(page) {
  contentGrid.innerHTML = "";
  const filtered = applySearchAndFilter();
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageData = filtered.slice(start, end);

  if (pageData.length === 0) {
    contentGrid.innerHTML = "<p style='grid-column:1/-1;text-align:center;color:#aaa;padding:60px'>لا توجد نتائج</p>";
    paginationContainer.innerHTML = "";
    return;
  }

  pageData.forEach(movie => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${movie.posterFinal?.startsWith("http") ? movie.posterFinal : imageBase + movie.posterFinal}" alt="${movie.titleFinal}">
      <div class="info"><h3>${movie.titleFinal}</h3></div>
    `;
    card.onclick = () => location.href = `details.html?type=movie&id=${movie.id}`;
    contentGrid.appendChild(card);
  });

  renderPagination(filtered.length);
}

// فلتر + بحث محلي
function applySearchAndFilter() {
  const query = searchInput.value.toLowerCase();
  const genre = filterSelect.value;

  return moviesData.filter(m => {
    const matchesSearch = m.titleFinal.toLowerCase().includes(query);
    const matchesGenre = genre ? m.genre_ids?.includes(Number(genre)) : true;
    return matchesSearch && matchesGenre;
  });
}

function renderPagination(total) {
  paginationContainer.innerHTML = "";
  const pages = Math.ceil(total / itemsPerPage);
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active");
    btn.onclick = () => { currentPage = i; renderPage(currentPage); };
    paginationContainer.appendChild(btn);
  }
}

// البحث الذكي العالمي (لو النتيجة مش موجودة)
async function globalSearch(query) {
  if (globalCache[query]) return globalCache[query];
  try {
    const res = await fetch(`${baseURL}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=ar`);
    const data = await res.json();
    globalCache[query] = data.results?.filter(m => m.poster_path) || [];
    return globalCache[query];
  } catch (e) { return []; }
}

// البحث مع تصحيح + عالمي
searchInput.oninput = () => {
  clearTimeout(searchTimer);
  const userQuery = searchInput.value.trim();

  if (!userQuery) {
    currentPage = 1;
    renderPage(currentPage);
    return;
  }

  contentGrid.innerHTML = "<p style='grid-column:1/-1;text-align:center;color:#ff3b3b;padding:40px'>جاري البحث الذكي...</p>";

  searchTimer = setTimeout(async () => {
    const smartQuery = await smartCorrect(userQuery);

    let results = moviesData.filter(m => m.titleFinal.toLowerCase().includes(smartQuery.toLowerCase()));

    if (results.length === 0) {
      results = await globalSearch(smartQuery);
    }

    moviesData = results.length ? results : moviesData;
    currentPage = 1;
    renderPage(currentPage);

    if (smartQuery !== userQuery && results.length > 0) {
      contentGrid.insertAdjacentHTML("afterbegin",
        `<div style='grid-column:1/-1;text-align:center;background:#001a00;color:#00ff88;padding:14px;border-radius:14px;margin:15px;font-weight:bold'>
          هل كنت تقصد: <strong>${smartQuery}</strong>؟
        </div>`
      );
    }
  }, 500);
};

// زر التصنيفات شغال 100%
filterSelect.onchange = () => {
  currentPage = 1;
  renderPage(currentPage);
};

// القائمة الجانبية
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menu-btn");
const closeSidebar = document.getElementById("close-sidebar");

menuBtn.onclick = () => sidebar.classList.add("show");
closeSidebar.onclick = () => sidebar.classList.remove("show");
document.addEventListener("click", e => {
  if (sidebar.classList.contains("show") && !sidebar.contains(e.target) && e.target !== menuBtn) {
    sidebar.classList.remove("show");
  }
});

// بدء التحميل
loadMovies();