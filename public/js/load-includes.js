/**
 * Common Header & Footer Loader
 * Loads the header and footer includes on all pages
 */
document.addEventListener('DOMContentLoaded', function() {
  // Find header and footer containers
  const headerContainer = document.getElementById('header-container');
  const footerContainer = document.getElementById('footer-container');
  
  // Load header if container exists
  if (headerContainer) {
    fetch('/includes/header.html')
      .then(response => response.text())
      .then(html => {
        headerContainer.innerHTML = html;
        
        // Initialize mobile menu after header is loaded
        setTimeout(() => {
          const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
          const mobileNav = document.querySelector('.mobile-nav');
          
          if (mobileMenuToggle && mobileNav) {
            mobileMenuToggle.addEventListener('click', () => {
              mobileMenuToggle.classList.toggle('open');
              mobileNav.classList.toggle('mobile-nav-active');
            });
          }
        }, 100);
      })
      .catch(error => console.error('Error loading header:', error));
  }
  
  // Load footer if container exists
  if (footerContainer) {
    fetch('/includes/footer.html')
      .then(response => response.text())
      .then(html => {
        footerContainer.innerHTML = html;
      })
      .catch(error => console.error('Error loading footer:', error));
  }
});