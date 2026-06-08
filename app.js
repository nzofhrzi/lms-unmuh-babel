function saveSession(user) {
  localStorage.setItem(
    "user",
    JSON.stringify(user)
  );
}

function getSession() {
  return JSON.parse(
    localStorage.getItem("user")
  );
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

function requireAuth() {
  const user = getSession();

  if (!user) {
    window.location.href = "login.html";
  }

  return user;
}
