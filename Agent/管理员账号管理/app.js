const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");
const loginMessage = document.getElementById("login-message");
const adminMessage = document.getElementById("admin-message");
const userRows = document.getElementById("user-rows");
const authKey = "ppp-rural-sewage-admin-auth";
let apiBase = "";
let auth = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}
function showMessage(target, text, type = "error") {
  target.textContent = text;
  target.className = `notice ${type}`;
}
function clearMessage(target) { target.textContent = ""; target.className = "notice"; }
async function discoverApi() {
  const candidates = [...new Set([`${location.origin}/api`, "http://127.0.0.1:8000/api", ...Array.from({ length: 100 }, (_, i) => `http://127.0.0.1:${8100 + i}/api`)])];
  for (const candidate of candidates) {
    try { if ((await fetch(`${candidate.replace(/\/api$/, "")}/health`, { cache: "no-store" })).ok) return candidate; } catch (_) {}
  }
  return "http://127.0.0.1:8000/api";
}
function headers() { return { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` }; }
async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "操作失败，请检查后端服务。");
  return data;
}
function renderUsers(users) {
  userRows.innerHTML = users.map(user => {
    const state = user.isActive ? "启用" : "停用";
    const action = user.isActive ? "停用" : "启用";
    return `<tr><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.name)}</td><td>${user.role === "admin" ? "管理员" : "普通用户"}</td><td>${state}</td><td class="actions"><button data-reset="${user.id}">重置密码</button> <button data-toggle="${user.id}" data-active="${user.isActive}" class="${user.isActive ? "danger" : ""}">${action}</button></td></tr>`;
  }).join("") || '<tr><td colspan="5" class="muted">暂无账号。</td></tr>';
}
async function loadUsers() {
  const data = await request("/auth/users", { headers: headers() });
  renderUsers(data.items || []);
}
async function enterAdmin() {
  const me = await request("/auth/me", { headers: headers() });
  if (me.user?.role !== "admin") throw new Error("当前账号不是管理员，不能进入账号管理。");
  document.getElementById("operator").textContent = `当前管理员：${me.user.name}（${me.user.username}）`;
  loginView.classList.add("hidden"); adminView.classList.remove("hidden");
  await loadUsers();
}
document.getElementById("login-button").addEventListener("click", async () => {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  if (!username || !password) return showMessage(loginMessage, "请输入管理员账号和密码。");
  clearMessage(loginMessage);
  try {
    const response = await fetch(`${apiBase}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "登录失败。");
    auth = data;
    localStorage.setItem(authKey, JSON.stringify(auth));
    await enterAdmin();
  } catch (error) { showMessage(loginMessage, error.message); }
});
document.getElementById("login-password").addEventListener("keydown", event => { if (event.key === "Enter") document.getElementById("login-button").click(); });
document.getElementById("refresh-button").addEventListener("click", async () => { try { await loadUsers(); clearMessage(adminMessage); } catch (error) { showMessage(adminMessage, error.message); } });
document.getElementById("create-button").addEventListener("click", async () => {
  const username = document.getElementById("new-username").value.trim();
  const displayName = document.getElementById("new-name").value.trim();
  const role = document.getElementById("new-role").value;
  if (!username || !displayName) return showMessage(adminMessage, "请填写账号名和姓名。");
  try {
    const data = await request("/auth/users", { method: "POST", headers: headers(), body: JSON.stringify({ username, displayName, role }) });
    showMessage(adminMessage, `账号已创建。请立即记录初始密码：${data.temporaryPassword}`, "success");
    document.getElementById("new-username").value = ""; document.getElementById("new-name").value = "";
    await loadUsers();
  } catch (error) { showMessage(adminMessage, error.message); }
});
userRows.addEventListener("click", async event => {
  const button = event.target.closest("button"); if (!button) return;
  try {
    if (button.dataset.reset) {
      if (!confirm("确认重置该账号密码？系统会生成新的随机密码。")) return;
      const data = await request(`/auth/users/${button.dataset.reset}/reset-password`, { method: "POST", headers: headers(), body: "{}" });
      showMessage(adminMessage, `密码已重置。请立即记录新密码：${data.temporaryPassword}`, "success");
    }
    if (button.dataset.toggle) {
      const active = button.dataset.active === "true";
      if (!confirm(`确认${active ? "停用" : "启用"}该账号？`)) return;
      await request(`/auth/users/${button.dataset.toggle}`, { method: "PUT", headers: headers(), body: JSON.stringify({ isActive: !active }) });
      showMessage(adminMessage, `账号已${active ? "停用" : "启用"}。`, "success");
    }
    await loadUsers();
  } catch (error) { showMessage(adminMessage, error.message); }
});
document.getElementById("logout-button").addEventListener("click", () => { localStorage.removeItem(authKey); auth = null; adminView.classList.add("hidden"); loginView.classList.remove("hidden"); clearMessage(adminMessage); });
(async () => {
  apiBase = await discoverApi();
  try { auth = JSON.parse(localStorage.getItem(authKey) || "null"); if (auth?.token) await enterAdmin(); } catch (_) { localStorage.removeItem(authKey); }
})();
