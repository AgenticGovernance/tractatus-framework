const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const loginBtn = document.getElementById('login-btn');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  // Hide previous errors
  errorMessage.classList.add('hidden');

  // Disable button
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span>Signing in...</span>';

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Store token
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));

      // Redirect to dashboard
      window.location.href = '/admin/dashboard.html';
    } else {
      // Show error
      showError(data.message || 'Invalid credentials');
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Sign in';
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Network error. Please try again.');
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Sign in';
  }
});

function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.remove('hidden');
}

// Auto-fill for development (optional)
if (window.location.hostname === 'localhost') {
  document.getElementById('email').value = 'admin@tractatus.local';
}
