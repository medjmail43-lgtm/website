const sliderWrapper = document.getElementById("slider-wrapper");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
let slides = [];
let currentIndex = 0;

const apiKey = "dbb14198ea29a547de77343dc3fe7a37";
const baseURL = "https://api.themoviedb.org/3";
const imageBase = "https://image.tmdb.org/t/p/original";

// جلب المحتوى الأكثر شعبية هذا الأسبوع (Trending)
async function loadSlider() {
  try {
    const res = await fetch(`${baseURL}/trending/all/week?api_key=${apiKey}&language=ar`);
    const data = await res.json();
    const items = data.results.slice(0, 8); // أفضل 8 فقط للسلايدر

    items.forEach((item, index) => {
      const slide = document.createElement("div");
      slide.classList.add("slide");
      if(index === 0) slide.classList.add("active");

      slide.style.backgroundImage = `url('${imageBase}${item.backdrop_path || item.poster_path}')`;
      slide.innerHTML = `
        <div class="overlay">
          <h2>${item.title || item.name}</h2>
          <p>${item.media_type === "movie" ? item.release_date?.split("-")[0] : item.first_air_date?.split("-")[0]} • ${item.media_type}</p>
          <a href="details.html?type=${item.media_type}&id=${item.id}" class="btn">شاهد الآن</a>
        </div>
      `;
      sliderWrapper.appendChild(slide);
      slides.push(slide);
    });

    // تشغيل الانيميشن التلقائي
    startAutoSlide();

    // أزرار السابق / التالي
    prevBtn.addEventListener("click", () => {
      prevSlide();
      resetAutoSlide();
    });
    nextBtn.addEventListener("click", () => {
      nextSlide();
      resetAutoSlide();
    });

    // دعم السحب بالماوس واللمس
    let startX = 0;
    sliderWrapper.addEventListener("mousedown", e => startX = e.clientX);
    sliderWrapper.addEventListener("mouseup", e => {
      const diff = e.clientX - startX;
      if(diff > 50) prevBtn.click();
      if(diff < -50) nextBtn.click();
    });
    sliderWrapper.addEventListener("touchstart", e => startX = e.touches[0].clientX);
    sliderWrapper.addEventListener("touchend", e => {
      const diff = e.changedTouches[0].clientX - startX;
      if(diff > 50) prevBtn.click();
      if(diff < -50) nextBtn.click();
    });

  } catch (err) {
    console.error("خطأ في تحميل السلايدر:", err);
    sliderWrapper.innerHTML = "<p>فشل تحميل السلايدر</p>";
  }
}

function showSlide(index) {
  slides.forEach((s, i) => {
    s.classList.remove("active");
    if(i === index) s.classList.add("active");
  });
  currentIndex = index;
}

function nextSlide() {
  const newIndex = (currentIndex + 1) % slides.length;
  showSlide(newIndex);
}

function prevSlide() {
  const newIndex = (currentIndex - 1 + slides.length) % slides.length;
  showSlide(newIndex);
}

// الانيميشن التلقائي
let autoSlideInterval;
function startAutoSlide() {
  autoSlideInterval = setInterval(() => {
    nextSlide();
  }, 5000); // تغيير كل 5 ثواني
}

function resetAutoSlide() {
  clearInterval(autoSlideInterval);
  startAutoSlide();
}

// تحميل السلايدر عند البداية
loadSlider();
