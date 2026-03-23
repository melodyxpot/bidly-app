import { scrapeJobData, ScrapedJob } from "./scraper"
import { login, logout, createApplication, isLoggedIn, getUser, getSettings } from "./api"

let sidebarRoot: HTMLElement | null = null
let isOpen = false

function createSidebar() {
  if (sidebarRoot) return

  sidebarRoot = document.createElement("div")
  sidebarRoot.id = "bidly-sidebar-root"
  document.body.appendChild(sidebarRoot)

  renderSidebar()
}

function toggleSidebar() {
  if (!sidebarRoot) createSidebar()
  isOpen = !isOpen
  if (isOpen) {
    sidebarRoot!.classList.add("bidly-open")
    renderSidebar()
  } else {
    sidebarRoot!.classList.remove("bidly-open")
  }
}

async function renderSidebar() {
  if (!sidebarRoot) return

  const loggedIn = await isLoggedIn()
  const user = await getUser()

  if (!loggedIn) {
    renderLogin()
  } else {
    renderMain(user)
  }
}

function renderLogin() {
  if (!sidebarRoot) return

  sidebarRoot.innerHTML = `
    <div class="bidly-sidebar">
      <div class="bidly-header">
        <div class="bidly-header-title">📋 Bidly</div>
        <button class="bidly-close-btn" id="bidly-close">&times;</button>
      </div>
      <div class="bidly-body">
        <div class="bidly-login-container">
          <h2>Sign In</h2>
          <p>Sign in to your Bidly account to track job applications.</p>
          <div class="bidly-login-form">
            <div class="bidly-form-group">
              <label>Email</label>
              <input type="email" id="bidly-email" placeholder="you@example.com" />
            </div>
            <div class="bidly-form-group">
              <label>Password</label>
              <input type="password" id="bidly-password" placeholder="Password" />
            </div>
            <div id="bidly-login-error" class="bidly-message bidly-message-error" style="display:none"></div>
            <button class="bidly-btn bidly-btn-primary" id="bidly-login-btn">Sign In</button>
          </div>
        </div>
      </div>
    </div>
  `

  sidebarRoot.querySelector("#bidly-close")!.addEventListener("click", toggleSidebar)

  const loginBtn = sidebarRoot.querySelector("#bidly-login-btn") as HTMLButtonElement
  const emailInput = sidebarRoot.querySelector("#bidly-email") as HTMLInputElement
  const passwordInput = sidebarRoot.querySelector("#bidly-password") as HTMLInputElement
  const errorDiv = sidebarRoot.querySelector("#bidly-login-error") as HTMLElement

  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim()
    const password = passwordInput.value
    if (!email || !password) {
      errorDiv.textContent = "Please enter email and password"
      errorDiv.style.display = "block"
      return
    }

    loginBtn.disabled = true
    loginBtn.textContent = "Signing in..."
    errorDiv.style.display = "none"

    try {
      await login(email, password)
      renderSidebar()
    } catch (err: any) {
      errorDiv.textContent = err.message
      errorDiv.style.display = "block"
      loginBtn.disabled = false
      loginBtn.textContent = "Sign In"
    }
  })

  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginBtn.click()
  })
}

async function renderMain(user: any) {
  if (!sidebarRoot) return

  const scraped = scrapeJobData()

  // Get settings for defaults
  let settings: any = null
  try {
    const result = await getSettings()
    settings = result.settings
  } catch {}

  const platforms = settings?.platformOptions || ["LinkedIn", "Wellfound", "Indeed", "Company Website", "Other"]
  const statuses = ["Applied", "Interview", "Offer", "Rejected", "Withdrawn", "No Response"]
  const jobTypes = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"]
  const workLocations = settings?.workLocationOptions || ["Remote", "Hybrid", "Onsite"]

  const now = new Date().toISOString().slice(0, 16)
  const followUpDate = new Date()
  followUpDate.setDate(followUpDate.getDate() + (settings?.followUpOffsetDays || 7))
  const followUp = followUpDate.toISOString().split("T")[0]

  sidebarRoot.innerHTML = `
    <div class="bidly-sidebar">
      <div class="bidly-header">
        <div class="bidly-header-title">📋 Bidly</div>
        <button class="bidly-close-btn" id="bidly-close">&times;</button>
      </div>
      <div class="bidly-user-bar">
        <span>${user?.email || "User"}</span>
        <button class="bidly-btn-danger bidly-btn" style="width:auto;padding:4px 12px;font-size:12px" id="bidly-logout">Sign Out</button>
      </div>
      <div class="bidly-body">
        ${scraped.title || scraped.company ? `
          <div class="bidly-section">
            <div class="bidly-section-title">Scraped from page <span class="bidly-scraped-badge">Auto-detected</span></div>
          </div>
        ` : ""}
        <div id="bidly-message-area"></div>
        <div class="bidly-section">
          <div class="bidly-form-group">
            <label>Company *</label>
            <input type="text" id="bidly-company" value="${escapeHtml(scraped.company)}" />
          </div>
          <div class="bidly-form-group">
            <label>Job Title *</label>
            <input type="text" id="bidly-title" value="${escapeHtml(scraped.title)}" />
          </div>
          <div class="bidly-form-group">
            <label>Job Link</label>
            <input type="url" id="bidly-link" value="${escapeHtml(scraped.link)}" />
          </div>
          <div class="bidly-form-row">
            <div class="bidly-form-group">
              <label>Platform</label>
              <select id="bidly-platform">
                ${platforms.map((p: string) => `<option value="${p}" ${p === scraped.platform ? "selected" : ""}>${p}</option>`).join("")}
              </select>
            </div>
            <div class="bidly-form-group">
              <label>Status</label>
              <select id="bidly-status">
                ${statuses.map((s: string) => `<option value="${s}" ${s === (settings?.defaultStatus || "Applied") ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="bidly-form-row">
            <div class="bidly-form-group">
              <label>Job Type</label>
              <select id="bidly-jobtype">
                <option value="">Select type</option>
                ${jobTypes.map((t: string) => `<option value="${t}" ${t === scraped.jobType ? "selected" : ""}>${t}</option>`).join("")}
              </select>
            </div>
            <div class="bidly-form-group">
              <label>Work Location</label>
              <select id="bidly-worklocation">
                <option value="">Select</option>
                ${workLocations.map((w: string) => `<option value="${w}" ${w === scraped.workLocation ? "selected" : ""}>${w}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="bidly-form-group">
            <label>Location</label>
            <input type="text" id="bidly-location" value="${escapeHtml(scraped.location)}" />
          </div>
          <div class="bidly-form-row">
            <div class="bidly-form-group">
              <label>Applied Date</label>
              <input type="datetime-local" id="bidly-appliedat" value="${now}" />
            </div>
            <div class="bidly-form-group">
              <label>Follow-up Date</label>
              <input type="date" id="bidly-followup" value="${followUp}" />
            </div>
          </div>
          <div class="bidly-form-group">
            <label>Notes</label>
            <textarea id="bidly-notes" rows="3" placeholder="Add any notes..."></textarea>
          </div>
          <button class="bidly-btn bidly-btn-primary" id="bidly-save" style="margin-top:8px">Save Application</button>
        </div>
      </div>
    </div>
  `

  sidebarRoot.querySelector("#bidly-close")!.addEventListener("click", toggleSidebar)
  sidebarRoot.querySelector("#bidly-logout")!.addEventListener("click", async () => {
    await logout()
    renderSidebar()
  })

  const saveBtn = sidebarRoot.querySelector("#bidly-save") as HTMLButtonElement
  saveBtn.addEventListener("click", async () => {
    const company = (sidebarRoot!.querySelector("#bidly-company") as HTMLInputElement).value.trim()
    const title = (sidebarRoot!.querySelector("#bidly-title") as HTMLInputElement).value.trim()
    const msgArea = sidebarRoot!.querySelector("#bidly-message-area") as HTMLElement

    if (!company || !title) {
      msgArea.innerHTML = `<div class="bidly-message bidly-message-error">Company and job title are required.</div>`
      return
    }

    saveBtn.disabled = true
    saveBtn.textContent = "Saving..."

    try {
      await createApplication({
        company,
        title,
        link: (sidebarRoot!.querySelector("#bidly-link") as HTMLInputElement).value || null,
        platform: (sidebarRoot!.querySelector("#bidly-platform") as HTMLSelectElement).value,
        status: (sidebarRoot!.querySelector("#bidly-status") as HTMLSelectElement).value,
        jobType: (sidebarRoot!.querySelector("#bidly-jobtype") as HTMLSelectElement).value || null,
        workLocation: (sidebarRoot!.querySelector("#bidly-worklocation") as HTMLSelectElement).value || null,
        location: (sidebarRoot!.querySelector("#bidly-location") as HTMLInputElement).value || null,
        appliedAt: new Date((sidebarRoot!.querySelector("#bidly-appliedat") as HTMLInputElement).value).toISOString(),
        followUpAt: (sidebarRoot!.querySelector("#bidly-followup") as HTMLInputElement).value
          ? new Date((sidebarRoot!.querySelector("#bidly-followup") as HTMLInputElement).value).toISOString()
          : null,
        notes: (sidebarRoot!.querySelector("#bidly-notes") as HTMLTextAreaElement).value || null,
      })

      msgArea.innerHTML = `<div class="bidly-message bidly-message-success">✓ Application saved successfully!</div>`
      saveBtn.textContent = "Saved!"
      setTimeout(() => {
        saveBtn.disabled = false
        saveBtn.textContent = "Save Application"
      }, 2000)
    } catch (err: any) {
      msgArea.innerHTML = `<div class="bidly-message bidly-message-error">${err.message}</div>`
      saveBtn.disabled = false
      saveBtn.textContent = "Save Application"
    }
  })
}

function escapeHtml(str: string): string {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML.replace(/"/g, "&quot;")
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TOGGLE_SIDEBAR") {
    toggleSidebar()
  }
})
