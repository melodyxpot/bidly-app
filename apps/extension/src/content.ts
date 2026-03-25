import { scrapeJobData } from "./scraper"
import { login, logout, createApplication, isLoggedIn, getUser, getSettings } from "./api"

let sidebarRoot: HTMLElement | null = null
let fab: HTMLElement | null = null
let isOpen = false

// Create floating action button on page load
function createFab() {
  if (fab) return
  fab = document.createElement("button")
  fab.id = "bidly-fab"
  fab.innerHTML = "📋"
  fab.title = "Bidly - Track this job"
  fab.addEventListener("click", toggleSidebar)
  document.body.appendChild(fab)
}

function createSidebar() {
  if (sidebarRoot) return
  sidebarRoot = document.createElement("div")
  sidebarRoot.id = "bidly-sidebar-root"
  document.body.appendChild(sidebarRoot)
}

function toggleSidebar() {
  if (!sidebarRoot) createSidebar()
  isOpen = !isOpen
  if (isOpen) {
    sidebarRoot!.classList.add("bidly-open")
    fab?.classList.add("bidly-fab-hidden")
    renderSidebar()
  } else {
    sidebarRoot!.classList.remove("bidly-open")
    fab?.classList.remove("bidly-fab-hidden")
  }
}

function closeSidebar() {
  isOpen = false
  sidebarRoot?.classList.remove("bidly-open")
  fab?.classList.remove("bidly-fab-hidden")
}

async function renderSidebar() {
  if (!sidebarRoot) return
  const loggedIn = await isLoggedIn()
  if (!loggedIn) {
    renderLogin()
  } else {
    const user = await getUser()
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
          <p>Sign in to your Bidly account to start tracking job applications.</p>
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

  bindClose()

  const loginBtn = sidebarRoot.querySelector("#bidly-login-btn") as HTMLButtonElement
  const emailInput = sidebarRoot.querySelector("#bidly-email") as HTMLInputElement
  const passwordInput = sidebarRoot.querySelector("#bidly-password") as HTMLInputElement
  const errorDiv = sidebarRoot.querySelector("#bidly-login-error") as HTMLElement

  setTimeout(() => emailInput.focus(), 50)

  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim()
    const password = passwordInput.value
    if (!email || !password) {
      showError(errorDiv, "Please enter email and password")
      return
    }

    loginBtn.disabled = true
    loginBtn.textContent = "Signing in..."
    errorDiv.style.display = "none"

    try {
      await login(email, password)
      renderSidebar()
    } catch (err: any) {
      showError(errorDiv, err.message)
      loginBtn.disabled = false
      loginBtn.textContent = "Sign In"
    }
  })

  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginBtn.click()
  })
  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") passwordInput.focus()
  })
}

async function renderMain(user: any) {
  if (!sidebarRoot) return

  const scraped = scrapeJobData()

  let settings: any = null
  try {
    const result = await getSettings()
    settings = result.settings
  } catch {}

  const jobTypes = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"]
  const workLocations = settings?.workLocationOptions || ["Remote", "Hybrid", "Onsite"]

  const now = new Date().toISOString().slice(0, 16)
  const followUpDate = new Date()
  followUpDate.setDate(followUpDate.getDate() + (settings?.followUpOffsetDays || 7))
  const followUp = followUpDate.toISOString().split("T")[0]

  const hasScraped = !!(scraped.title || scraped.company)

  sidebarRoot.innerHTML = `
    <div class="bidly-sidebar">
      <div class="bidly-header">
        <div class="bidly-header-title">📋 Bidly</div>
        <button class="bidly-close-btn" id="bidly-close">&times;</button>
      </div>
      <div class="bidly-user-bar">
        <span class="bidly-user-email">${escapeHtml(user?.email || "User")}</span>
        <button class="bidly-signout-btn" id="bidly-logout">Sign Out</button>
      </div>
      <div class="bidly-body">
        ${hasScraped ? `<div class="bidly-scraped-bar">Scraped from page <span class="bidly-scraped-badge">Auto-detected</span></div>` : ""}
        <div id="bidly-message-area"></div>

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

        <div class="bidly-form-group">
          <label>Platform</label>
          <input type="text" id="bidly-platform" value="${escapeHtml(scraped.platform)}" />
        </div>

        <div class="bidly-form-row">
          <div class="bidly-form-group">
            <label>Job Type</label>
            <select id="bidly-jobtype">
              <option value="">—</option>
              ${jobTypes.map((t: string) => `<option value="${t}" ${t === scraped.jobType ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="bidly-form-group">
            <label>Work Location</label>
            <select id="bidly-worklocation">
              <option value="">—</option>
              ${workLocations.map((w: string) => `<option value="${w}" ${w === scraped.workLocation ? "selected" : ""}>${w}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="bidly-form-group">
          <label>Location</label>
          <input type="text" id="bidly-location" value="${escapeHtml(scraped.location)}" />
        </div>

        <div class="bidly-divider"></div>

        <div class="bidly-form-row">
          <div class="bidly-form-group">
            <label>Applied Date</label>
            <input type="datetime-local" id="bidly-appliedat" value="${now}" />
          </div>
          <div class="bidly-form-group">
            <label>Follow-up</label>
            <input type="date" id="bidly-followup" value="${followUp}" />
          </div>
        </div>

        <div class="bidly-form-group">
          <label>Notes</label>
          <textarea id="bidly-notes" rows="2" placeholder="Optional notes..."></textarea>
        </div>

        <button class="bidly-btn bidly-btn-primary" id="bidly-save">Save Application</button>
      </div>
    </div>
  `

  bindClose()

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
    msgArea.innerHTML = ""

    try {
      await createApplication({
        company,
        title,
        link: (sidebarRoot!.querySelector("#bidly-link") as HTMLInputElement).value || null,
        platform: (sidebarRoot!.querySelector("#bidly-platform") as HTMLInputElement).value || "Other",
        status: settings?.defaultStatus || "Applied",
        jobType: (sidebarRoot!.querySelector("#bidly-jobtype") as HTMLSelectElement).value || null,
        workLocation: (sidebarRoot!.querySelector("#bidly-worklocation") as HTMLSelectElement).value || null,
        location: (sidebarRoot!.querySelector("#bidly-location") as HTMLInputElement).value || null,
        appliedAt: new Date((sidebarRoot!.querySelector("#bidly-appliedat") as HTMLInputElement).value).toISOString(),
        followUpAt: (sidebarRoot!.querySelector("#bidly-followup") as HTMLInputElement).value
          ? new Date((sidebarRoot!.querySelector("#bidly-followup") as HTMLInputElement).value).toISOString()
          : null,
        notes: (sidebarRoot!.querySelector("#bidly-notes") as HTMLTextAreaElement).value || null,
      })

      msgArea.innerHTML = `<div class="bidly-message bidly-message-success">✓ Application saved!</div>`
      saveBtn.textContent = "Saved!"
      setTimeout(() => {
        saveBtn.disabled = false
        saveBtn.textContent = "Save Application"
      }, 2000)
    } catch (err: any) {
      msgArea.innerHTML = `<div class="bidly-message bidly-message-error">${escapeHtml(err.message)}</div>`
      saveBtn.disabled = false
      saveBtn.textContent = "Save Application"
    }
  })
}

function bindClose() {
  sidebarRoot?.querySelector("#bidly-close")?.addEventListener("click", closeSidebar)
}

function showError(el: HTMLElement, msg: string) {
  el.textContent = msg
  el.style.display = "block"
}

function escapeHtml(str: string): string {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML.replace(/"/g, "&quot;")
}

// Init: inject the floating button
createFab()

// Listen for messages from extension icon click
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TOGGLE_SIDEBAR") {
    toggleSidebar()
  }
})
