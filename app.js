// DLIMS Verification - Interactive Scripts

document.addEventListener('DOMContentLoaded', () => {
  // --- Carousel Logic ---
  const slides = document.querySelectorAll('.carousel-slide');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  let currentSlide = 0;
  let autoSlideTimer = null;

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });
    currentSlide = index;
  }

  function nextSlide() {
    const newIndex = (currentSlide + 1) % slides.length;
    showSlide(newIndex);
  }

  function prevSlide() {
    const newIndex = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(newIndex);
  }

  if (nextBtn && prevBtn && slides.length > 1) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetAutoSlide();
    });

    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetAutoSlide();
    });

    function startAutoSlide() {
      autoSlideTimer = setInterval(nextSlide, 6000);
    }

    function resetAutoSlide() {
      clearInterval(autoSlideTimer);
      startAutoSlide();
    }

    startAutoSlide();
  }

  // --- Dynamic Verification Form Inputs ---
  const methodSelect = document.getElementById('verificationMethod');
  const detailsInput = document.getElementById('detailsInput');
  const inputLabel = document.getElementById('inputLabel');
  const verifyForm = document.getElementById('verifyForm');
  const btnSubmit = document.getElementById('btnSubmit');
  const resultBox = document.getElementById('resultBox');
  const closeResultBtn = document.getElementById('closeResultBtn');

  const resLicNo = document.getElementById('resLicNo');
  const resCnic = document.getElementById('resCnic');

  if (methodSelect && detailsInput) {
    methodSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'license') {
        detailsInput.placeholder = 'Enter your license number e.g: 123123400000';
      } else if (val === 'cnic') {
        detailsInput.placeholder = 'Enter 13 digit CNIC e.g: 37405-1234567-1';
      } else if (val === 'tracking') {
        detailsInput.placeholder = 'Enter application tracking ID e.g: TRK-987213';
      }
      detailsInput.focus();
    });
  }

  // --- Verification Form Submission Handling ---
  if (verifyForm) {
    verifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputVal = detailsInput.value.trim();

      if (!inputVal) {
        detailsInput.focus();
        return;
      }

      // Show temporary loading state
      const originalText = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Verifying...</span>';
      btnSubmit.disabled = true;

      setTimeout(() => {
        btnSubmit.innerHTML = originalText;
        btnSubmit.disabled = false;

        // Populate sample data
        if (methodSelect.value === 'cnic') {
          resCnic.textContent = inputVal;
        } else {
          resLicNo.textContent = inputVal;
        }

        // Show result
        resultBox.style.display = 'block';
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 700);
    });
  }

  // Close Result Button
  if (closeResultBtn && resultBox) {
    closeResultBtn.addEventListener('click', () => {
      resultBox.style.display = 'none';
    });
  }
});
