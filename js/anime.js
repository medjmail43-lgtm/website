const apiKey = "dbb14198ea29a547de77343dc3fe7a37";
const baseURL = "https://api.themoviedb.org/3";
const imageBase = "https://image.tmdb.org/t/p/w500";

const contentGrid = document.getElementById("content-grid");
const searchInput = document.getElementById("search");
const filterSelect = document.getElementById("filter");
const paginationContainer = document.getElementById("pagination");

let animeData = [];
let currentPage = 1;
const itemsPerPage = 8;

// ===== تحميل الأنمي =====
async function loadAnime() {
  try {
    const url = `${baseURL}/tv/popular?api_key=${apiKey}&language=ja&page=1`;
    const data = await fetch(url).then(res => res.json());
    // فلترة الأنمي الياباني فقط
    animeData = data.results.filter(a => a.genre_ids?.includes(16) && a.poster_path)
      .map(a => ({
        ...a,
        titleFinal: a.name || "-",
        posterFinal: a.poster_path
      }));
    renderPage(currentPage);
  } catch(err) {
    console.error("خطأ في تحميل الأنمي:", err);
    contentGrid.innerHTML = "<p>فشل تحميل الأنمي</p>";
  }
}

// ===== عرض صفحة =====
function renderPage(page) {
  contentGrid.innerHTML = "";
  const filteredData = applySearchAndFilter();
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageData = filteredData.slice(start, end);

  pageData.forEach(item => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.innerHTML = `
      <img src="${imageBase}${item.posterFinal}" alt="${item.titleFinal}">
      <div class="info">
        <h3>${item.titleFinal}</h3>
        <span>${item.first_air_date?.split("-")[0] || "-"}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `details.html?type=anime&id=${item.id}`;
    });
    contentGrid.appendChild(card);
  });

  renderPagination(filteredData.length);
}

// ===== البحث والفلتر =====
function applySearchAndFilter() {
  const searchText = searchInput.value.toLowerCase();
  const filterValue = filterSelect.value;

  return animeData.filter(a => {
    const matchesSearch = a.titleFinal.toLowerCase().includes(searchText);
    const matchesFilter = filterValue ? a.genre_ids?.includes(Number(filterValue)) : true;
    return matchesSearch && matchesFilter;
  });
}

// ===== عرض الصفحات =====
function renderPagination(totalItems) {
  paginationContainer.innerHTML = "";
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active");
    btn.addEventListener("click", () => {
      currentPage = i;
      renderPage(currentPage);
    });
    paginationContainer.appendChild(btn);
  }
}

// ===== أحداث البحث والفلتر =====
searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderPage(currentPage);
});
filterSelect.addEventListener("change", () => {
  currentPage = 1;
  renderPage(currentPage);
});

// ===== القائمة الجانبية =====
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menu-btn");
const closeSidebar = document.getElementById("close-sidebar");

menuBtn.addEventListener("click", () => sidebar.classList.add("show"));
closeSidebar.addEventListener("click", () => sidebar.classList.remove("show"));
document.addEventListener("click", (e) => {
  if (sidebar.classList.contains("show") && !sidebar.contains(e.target) && e.target !== menuBtn) {
    sidebar.classList.remove("show");
  }
});

// ===== تحميل عند البداية =====
loadAnime();
