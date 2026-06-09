// auth.js
// Client-side auth helper untuk LMS
// Include di semua halaman yang butuh auth

const Auth = (() => {
  const TOKEN_KEY  = 'lms_token';
  const USER_KEY   = 'lms_user';
  const BASE_URL   = '/api/auth';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function login(nim_nip, password) {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nim_nip, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal.');
    setSession(data.token, data.user);
    return data.user;
  }

  async function verify() {
    const token = getToken();

    // Bypass khusus admin login menggunakan ADMIN_KEY
    if (token === 'admin-key-auth') {
      return getUser();
    }

    if (!token) return null;
    try {
      const res = await fetch(`${BASE_URL}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': token,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        clearSession();
        return null;
      }
      // Update cache user terbaru
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    } catch {
      return null;
    }
  }

  async function changePassword(oldPassword, newPassword) {
    const token = getToken();
    if (!token) throw new Error('Sesi tidak ditemukan.');
    const res = await fetch(`${BASE_URL}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengubah password.');
    return data;
  }

  function logout() {
    clearSession();
    sessionStorage.removeItem('lms_admin_key');
    window.location.href = '/login.html';
  }

  // Guard: redirect ke login jika belum login
  // Gunakan: Auth.requireLogin(['mahasiswa','dosen'])
  async function requireLogin(allowedRoles = null) {
    const cached = getUser();
    if (!cached) {
      window.location.href = '/login.html';
      return null;
    }
    // Verify ke server di background
    const user = await verify();
    if (!user) {
      window.location.href = '/login.html';
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      window.location.href = '/login.html';
      return null;
    }
    return user;
  }

  // Guard: redirect ke dashboard jika sudah login
  async function redirectIfLoggedIn() {
    const cached = getUser();
    if (!cached) return;
    const user = await verify();
    if (user) redirectToDashboard(user.role);
  }

  function redirectToDashboard(role) {
    const routes = {
      mahasiswa: '/mahasiswa/dashboard.html',
      dosen:     '/dosen/dashboard.html',
      admin:     '/admin/dashboard.html',
    };
    window.location.href = routes[role] || '/login.html';
  }

  return {
    getToken,
    getUser,
    setSession,
    clearSession,
    login,
    verify,
    logout,
    changePassword,
    requireLogin,
    redirectIfLoggedIn,
    redirectToDashboard,
  };
})();
