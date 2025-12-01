// ملف details.js النهائي – TAFLIM 2025
const TMDB_KEY = "dbb14198ea29a547de77343dc3fe7a37";
const OMDB_KEY = "6584b042";
const WATCHMODE_KEY = "OxatsNqfOlchppjmnwDGXWmBQ1Ff9hAh72nVVdoz";
const TASTEDIVE_KEY = "1063414-sfinxcre-2FF487CB";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const params = new URLSearchParams(window.location.search);
const mediaType = params.get("type") || "movie"; // movie أو tv
const mediaId = params.get("id");

if (!mediaId) {
  document.body.innerHTML = "<h1 style='color:#ff3b3b;text-align:center;margin:100px'>المحتوى غير موجود!</h1>";
  throw new Error("No ID");
}

// ترجمة تلقائية للقصة لو مفيش عربي
async function translateToArabic(text) {
  if (!text || text.length < 10) return "القصة غير متوفرة";
  try {
    const res = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      body: JSON.stringify({ q: text, source: "en", target: "ar", format: "text" }),
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    return data.translatedText || text;
  } catch (e) {
    return text;
  }
}

// جلب كل البيانات من 4 مصادر
async function getFullDetails() {
  let movie = {
    title: "جاري التحميل...",
    overview: "جاري التحميل...",
    poster: "img/loading.jpg",
    trailer: null,
    year: "",
    rating: "",
    streaming: [],
    recommendations: [],
    original_language: ""
  };

  // 1. TMDB أولاً
  try {
    const tmdbRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${TMDB_KEY}&language=ar`);
    const t = await tmdbRes.json();

    movie.original_language = t.original_language || "";

    // العنوان حسب نوع المحتوى
    if (mediaType === "anime" || movie.original_language === "ja") {
      // أنمي → إنجليزي فقط
      movie.title = t.original_title || t.title || t.name || t.original_name || "غير معروف";
    }
    else if (movie.original_language === "ko") {
      // K-Drama → إنجليزي (العربي بين قوسين)
      const eng = t.original_name || t.original_title;
      const ara = t.name || t.title;
      movie.title = ara && eng && ara !== eng ? `${eng} (${ara})` : (ara || eng || "غير معروف");
    }
    else {
      // باقي المحتوى → عربي إن وجد، وإلا إنجليزي
      movie.title = t.title || t.name || t.original_title || t.original_name || "غير معروف";
    }

    movie.overview = t.overview || "";
    movie.poster = t.poster_path ? IMAGE_BASE + t.poster_path : null;
    movie.year = (t.release_date || t.first_air_date || "").split("-")[0] || "غير معروف";
    movie.rating = t.vote_average ? t.vote_average.toFixed(1) : "";

    // تريلر أصلي
    const videos = await fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/videos?api_key=${TMDB_KEY}`).then(r => r.json());
    const trailer = videos.results.find(v => v.type === "Trailer" && v.site === "YouTube") || videos.results[0];
    movie.trailer = trailer ? `https://www.youtube.com/embed/${trailer.key}` : null;

  } catch (e) { console.log("TMDB فشل"); }

  // 2. OMDb كـ fallback
  if (!movie.overview || !movie.poster || movie.rating === "") {
    try {
      const o = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=tt${mediaId}&plot=full`).then(r => r.json());
      if (o.Response === "True") {
        if (!movie.overview) movie.overview = o.Plot === "N/A" ? "" : o.Plot;
        if (!movie.poster) movie.poster = o.Poster === "N/A" ? null : o.Poster;
        if (!movie.rating) movie.rating = o.imdbRating || "غير متوفر";
      }
    } catch (e) {}
  }

  // 3. ترجمة القصة للعربي لو مفيش
  if (!movie.overview || movie.overview.length < 50) {
    const englishOverview = movie.overview || (await fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${TMDB_KEY}`).then(r => r.json())).overview;
    movie.overview = await translateToArabic(englishOverview);
  }

  // 4. Watchmode – أماكن المشاهدة
  try {
    const w = await fetch(`https://api.watchmode.com/v1/title/${mediaType}-${mediaId}/sources/?apiKey=${WATCHMODE_KEY}`).then(r => r.json());
    const platforms = [...new Set(w.map(s => s.name))].slice(0, 10);
    movie.streaming = platforms.length ? platforms : ["غير متوفر حاليًا"];
  } catch (e) { movie.streaming = ["غير متوفر حاليًا"]; }

  // 5. TasteDive – توصيات
  try {
    const q = encodeURIComponent(movie.title);
    const t = await fetch(`https://tastedive.com/api/similar?q=${q}&k=${TASTEDIVE_KEY}&type=${mediaType === "movie" ? "movies" : "shows"}&info=1`).then(r => r.json());
    movie.recommendations = t.Similar?.Results?.slice(0, 12) || [];
  } catch (e) {}

  // صورة احتياطية لو كل شيء فشل
  if (!movie.poster) movie.poster = "img/no-poster.jpg";

  return movie;
}

// عرض البيانات
getFullDetails().then(m => {
  document.getElementById("detail-title").textContent = m.title;
  document.getElementById("detail-poster").src = m.poster;
  document.getElementById("detail-description").textContent = m.overview;
  document.getElementById("detail-meta").textContent = `${m.year} • ${m.rating} ★`;

  // التريلر
  if (m.trailer) {
    document.getElementById("trailer-iframe").src = m.trailer;
  } else {
    document.querySelector(".trailer-section").innerHTML = "<p style='text-align:center;color:#ccc;padding:30px'>لا يوجد تريلر حاليًا</p>";
  }

  // روابط المشاهدة
  const streamDiv = document.createElement("div");
  streamDiv.style = "margin:20px 0; padding:15px; background:#161b20; border-radius:12px;";
  streamDiv.innerHTML = `<h3 style="color:#ff3b3b;margin-bottom:10px">شاهد على:</h3><p style="color:#ccc">${m.streaming.join(" • ")}</p>`;
  document.querySelector(".detail-info").appendChild(streamDiv);

  // التوصيات
  if (m.recommendations.length) {
    const recSection = document.createElement("section");
    recSection.innerHTML = `<h3 style="color:#ff3b3b;margin:30px 0 15px">توصيات مشابهة</h3><div class="grid-container" id="rec-grid"></div>`;
    document.querySelector("main").appendChild(recSection);

    m.recommendations.forEach(r => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <img src="${r.wTeaser || 'img/no-poster.jpg'}" alt="${r.Name}">
        <div class="info"><h3>${r.Name}</h3></div>
      `;
      card.onclick = () => location.href = `details.html?type=${mediaType}&id=${r.yID || r.ID}`;
      document.getElementById("rec-grid").appendChild(card);
    });
  }
});