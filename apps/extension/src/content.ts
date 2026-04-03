import { scrapeJobData } from "./scraper"
import { detectFormFields, getProfileValue, fillField, attachFileToInput, DetectedField } from "./detector"
import { login, logout, createApplication, isLoggedIn, getUser, getSettings, getProfile, getResumeInfo, generateResume, generateAnswer, getExtensionSettings, setExtensionSettings, generateCoverLetter, ExtSettings } from "./api"

let sidebarRoot: HTMLElement | null = null
let fab: HTMLElement | null = null
let isOpen = false
let detectedFields: DetectedField[] = []
let cachedProfile: any = null
let extSettings: ExtSettings = { autofillEnabled: true, saveResumeInApp: false }
let lastGeneratedResumeUrl: string | null = null

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

  // Pre-fetch profile and extension settings
  try {
    const result = await getProfile()
    cachedProfile = result.profile
  } catch {}
  try {
    extSettings = await getExtensionSettings()
  } catch {}

  // Scan fields
  detectedFields = detectFormFields()

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
      
      <div class="bidly-tabs">
        <button class="bidly-tab bidly-tab-active" data-tab="autofill">Auto-Fill</button>
        <button class="bidly-tab" data-tab="save">Save Job</button>
        <button class="bidly-tab" data-tab="settings">⚙️</button>
      </div>
      
      <div class="bidly-body" id="bidly-tab-autofill">
        <div class="bidly-section-title">Custom Resume</div>
        <p style="font-size:11px;color:#888;margin:0 0 8px">Generate an ATS-optimized resume tailored to this job</p>
        <button class="bidly-btn bidly-btn-secondary" id="bidly-generate-resume" style="margin-bottom:4px">📄 Generate Custom Resume</button>
        <div id="bidly-generate-result"></div>
        
        <div style="margin-top:8px">
          <div class="bidly-section-title">Cover Letter</div>
          <p style="font-size:11px;color:#888;margin:0 0 8px">Generate a cover letter tailored to this job</p>
          <button class="bidly-btn bidly-btn-secondary" id="bidly-generate-cover-letter" style="margin-bottom:4px">✉️ Generate Cover Letter</button>
          <div id="bidly-cover-letter-result"></div>
        </div>
        
        <div class="bidly-divider"></div>
        
        ${extSettings.autofillEnabled ? `
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button class="bidly-btn bidly-btn-primary" id="bidly-autofill-all" style="flex:1">
            ✨ Auto-fill All
          </button>
          <button class="bidly-btn bidly-btn-outline" id="bidly-scan" style="width:auto;padding:9px 14px" title="Re-scan fields">
            🔄
          </button>
        </div>
        
        ${!cachedProfile ? '<div class="bidly-message bidly-message-error">Could not load profile. Please set up your profile first.</div>' : ''}
        
        <div class="bidly-field-count">${detectedFields.length} field${detectedFields.length !== 1 ? 's' : ''} detected</div>
        
        <div id="bidly-fields-list">
          ${renderFieldsList(detectedFields, false)}
        </div>
        ` : `
        <div id="bidly-fields-list">
          ${renderFieldsList(detectedFields, true)}
        </div>
        ${detectedFields.filter(f => isCustomQuestion(f)).length === 0 ? '<div style="font-size:12px;color:#888;text-align:center;padding:12px 0">Auto-fill is disabled. Enable it in Settings (⚙️).</div>' : ''}
        `}
      </div>
      
      <div class="bidly-body" id="bidly-tab-save" style="display:none">
        ${hasScraped ? '<div class="bidly-scraped-bar">Scraped from page <span class="bidly-scraped-badge">Auto-detected</span></div>' : ''}
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
      
      <div class="bidly-body" id="bidly-tab-settings" style="display:none">
        <div class="bidly-section-title" style="margin-bottom:16px">Extension Settings</div>
        
        <div class="bidly-settings-row">
          <div>
            <div style="font-size:13px;font-weight:600;color:#171717">Auto-Fill</div>
            <div style="font-size:11px;color:#888;margin-top:2px">Detect form fields and show the auto-fill panel</div>
          </div>
          <label class="bidly-toggle">
            <input type="checkbox" id="bidly-setting-autofill" ${extSettings.autofillEnabled ? "checked" : ""} />
            <span class="bidly-toggle-slider"></span>
          </label>
        </div>
        
        <div class="bidly-settings-row">
          <div>
            <div style="font-size:13px;font-weight:600;color:#171717">Save Resume in Application</div>
            <div style="font-size:11px;color:#888;margin-top:2px">Save generated resume URL when saving a job application</div>
          </div>
          <label class="bidly-toggle">
            <input type="checkbox" id="bidly-setting-save-resume" ${extSettings.saveResumeInApp ? "checked" : ""} />
            <span class="bidly-toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  `

  bindClose()

  // Tab switching
  const tabs = sidebarRoot.querySelectorAll(".bidly-tab")
  const allTabPanels = ["#bidly-tab-autofill", "#bidly-tab-save", "#bidly-tab-settings"]
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("bidly-tab-active"))
      tab.classList.add("bidly-tab-active")
      const tabName = tab.getAttribute("data-tab")
      allTabPanels.forEach(id => {
        const panel = sidebarRoot!.querySelector(id) as HTMLElement
        if (panel) panel.style.display = id === `#bidly-tab-${tabName}` ? "" : "none"
      })
    })
  })

  // Settings toggles
  const autofillToggle = sidebarRoot.querySelector("#bidly-setting-autofill") as HTMLInputElement
  if (autofillToggle) {
    autofillToggle.addEventListener("change", async () => {
      extSettings.autofillEnabled = autofillToggle.checked
      await setExtensionSettings(extSettings)
    })
  }
  const saveResumeToggle = sidebarRoot.querySelector("#bidly-setting-save-resume") as HTMLInputElement
  if (saveResumeToggle) {
    saveResumeToggle.addEventListener("change", async () => {
      extSettings.saveResumeInApp = saveResumeToggle.checked
      await setExtensionSettings(extSettings)
    })
  }

  // Logout
  sidebarRoot.querySelector("#bidly-logout")!.addEventListener("click", async () => {
    await logout()
    renderSidebar()
  })

  // Scan button
  sidebarRoot.querySelector("#bidly-scan")?.addEventListener("click", () => {
    detectedFields = detectFormFields()
    const listEl = sidebarRoot!.querySelector("#bidly-fields-list")
    if (listEl) listEl.innerHTML = renderFieldsList(detectedFields, !extSettings.autofillEnabled)
    bindAIButtons()
    const countEl = sidebarRoot!.querySelector(".bidly-field-count")
    if (countEl) countEl.textContent = `${detectedFields.length} field${detectedFields.length !== 1 ? 's' : ''} detected`
  })

  // Auto-fill all button
  sidebarRoot.querySelector("#bidly-autofill-all")?.addEventListener("click", async () => {
    if (!cachedProfile) return

    const btn = sidebarRoot!.querySelector("#bidly-autofill-all") as HTMLButtonElement
    btn.disabled = true
    btn.textContent = "Filling..."

    for (const field of detectedFields) {
      if (field.filled || !field.profileKey) continue

      if (field.profileKey === "resumeFile" || field.profileKey === "coverLetterFile") {
        try {
          const resumeInfo = await getResumeInfo()
          if (resumeInfo.url) {
            const success = await attachFileToInput(
              field.element as HTMLInputElement,
              resumeInfo.url,
              resumeInfo.filename || "resume.pdf"
            )
            if (success) field.filled = true
          }
        } catch {}
      } else {
        const value = getProfileValue(cachedProfile, field.profileKey)
        if (value) {
          const success = fillField(field, value)
          if (success) field.filled = true
        }
      }
    }

    // Update the fields list UI
    const listEl = sidebarRoot!.querySelector("#bidly-fields-list")
    if (listEl) listEl.innerHTML = renderFieldsList(detectedFields, !extSettings.autofillEnabled)
    bindAIButtons()

    btn.disabled = false
    btn.textContent = "✨ Auto-fill All"
  })

  // Generate custom resume
  sidebarRoot.querySelector("#bidly-generate-resume")?.addEventListener("click", async () => {
    const btn = sidebarRoot!.querySelector("#bidly-generate-resume") as HTMLButtonElement
    const resultDiv = sidebarRoot!.querySelector("#bidly-generate-result") as HTMLElement

    btn.disabled = true
    btn.textContent = "Generating..."
    resultDiv.innerHTML = '<div style="font-size:11px;color:#888;margin-top:8px">⏳ AI is generating your custom resume...</div>'

    try {
      const scraped = scrapeJobData()
      const jobDescription = document.body.innerText.substring(0, 15000)

      const result = await generateResume({
        jobTitle: scraped.title,
        company: scraped.company,
        jobDescription,
      })

      lastGeneratedResumeUrl = result.url
      resultDiv.innerHTML = `
        <div class="bidly-message bidly-message-success" style="margin-top:8px">
          ✓ Resume generated!
          <a href="${escapeHtml(result.url)}" target="_blank" download="${escapeHtml(result.filename)}" 
             style="display:block;margin-top:6px;color:#1e40af;font-weight:600;text-decoration:underline">
            📥 Download Resume
          </a>
        </div>
      `
    } catch (err: any) {
      resultDiv.innerHTML = `<div class="bidly-message bidly-message-error" style="margin-top:8px">${escapeHtml(err.message)}</div>`
    }

    btn.disabled = false
    btn.textContent = "📄 Generate Custom Resume"
  })

  // Generate cover letter
  sidebarRoot.querySelector("#bidly-generate-cover-letter")?.addEventListener("click", async () => {
    const btn = sidebarRoot!.querySelector("#bidly-generate-cover-letter") as HTMLButtonElement
    const resultDiv = sidebarRoot!.querySelector("#bidly-cover-letter-result") as HTMLElement

    btn.disabled = true
    btn.textContent = "Generating..."
    resultDiv.innerHTML = '<div style="font-size:11px;color:#888;margin-top:8px">⏳ AI is writing your cover letter...</div>'

    try {
      const scraped = scrapeJobData()
      const jobDescription = document.body.innerText.substring(0, 12000)

      const result = await generateCoverLetter({
        jobTitle: scraped.title,
        company: scraped.company,
        jobDescription,
      })

      resultDiv.innerHTML = `
        <div class="bidly-message bidly-message-success" style="margin-top:8px">
          ✓ Cover letter generated!
          <div style="margin-top:8px;padding:10px;background:#f9fafb;border:1px solid #e5e5e5;border-radius:6px;font-size:12px;line-height:1.6;color:#333;max-height:200px;overflow-y:auto;white-space:pre-wrap">${escapeHtml(result.coverLetter)}</div>
          <button class="bidly-btn bidly-btn-outline" id="bidly-copy-cover-letter" style="margin-top:8px;font-size:12px">📋 Copy to Clipboard</button>
        </div>
      `

      sidebarRoot!.querySelector("#bidly-copy-cover-letter")?.addEventListener("click", () => {
        navigator.clipboard.writeText(result.coverLetter)
        const copyBtn = sidebarRoot!.querySelector("#bidly-copy-cover-letter") as HTMLButtonElement
        copyBtn.textContent = "✓ Copied!"
        setTimeout(() => { copyBtn.textContent = "📋 Copy to Clipboard" }, 2000)
      })
    } catch (err: any) {
      resultDiv.innerHTML = `<div class="bidly-message bidly-message-error" style="margin-top:8px">${escapeHtml(err.message)}</div>`
    }

    btn.disabled = false
    btn.textContent = "✉️ Generate Cover Letter"
  })

  // Save application
  const saveBtn = sidebarRoot.querySelector("#bidly-save") as HTMLButtonElement
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const company = (sidebarRoot!.querySelector("#bidly-company") as HTMLInputElement).value.trim()
      const title = (sidebarRoot!.querySelector("#bidly-title") as HTMLInputElement).value.trim()
      const msgArea = sidebarRoot!.querySelector("#bidly-message-area") as HTMLElement

      if (!company || !title) {
        msgArea.innerHTML = '<div class="bidly-message bidly-message-error">Company and job title are required.</div>'
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
          resume: extSettings.saveResumeInApp && lastGeneratedResumeUrl ? lastGeneratedResumeUrl : null,
        })

        msgArea.innerHTML = '<div class="bidly-message bidly-message-success">✓ Application saved!</div>'
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

  // Bind AI buttons for initial render
  bindAIButtons()
}

function isCustomQuestion(field: DetectedField): boolean {
  if (field.profileKey) return false
  if (field.type !== "text" && field.type !== "textarea") return false
  const label = field.label.toLowerCase()
  // Skip generic unlabeled fields
  if (label.startsWith("unlabeled")) return false
  // Consider it a question if label is long enough to be a question or contains question words
  if (label.length > 20) return true
  if (label.includes("?")) return true
  if (label.match(/^(why|how|what|describe|tell|explain|please|are you|do you|have you|would you|can you)/)) return true
  return false
}

function renderFieldsList(fields: DetectedField[], questionsOnly = false): string {
  if (fields.length === 0) {
    return '<div style="font-size:12px;color:#888;text-align:center;padding:20px 0">No form fields detected on this page.<br>Navigate to a job application form and click 🔄</div>'
  }

  const filtered = questionsOnly ? fields.filter(f => isCustomQuestion(f)) : fields
  if (filtered.length === 0 && questionsOnly) {
    return ''
  }

  return filtered.map((f) => {
    const idx = fields.indexOf(f)
    const matched = f.profileKey !== null
    const isQuestion = isCustomQuestion(f)
    const statusIcon = f.filled ? "✅" : (matched ? "⬜" : (isQuestion ? "💬" : "❌"))
    const labelClass = f.filled ? "bidly-field-label bidly-field-filled" : "bidly-field-label"
    const typeLabel = f.type === "file" ? "📎 file" : f.type === "checkbox" ? "☑ check" : f.type === "radio" ? "◉ radio" : f.type === "select" ? "▾ select" : "✎ text"
    const matchDot = matched ? '<span class="bidly-match-dot"></span>' : (isQuestion ? '<span class="bidly-match-dot" style="background:#f59e0b"></span>' : '<span class="bidly-unmatch-dot"></span>')

    const rowClass = isQuestion ? "bidly-field-row bidly-field-row-question" : "bidly-field-row"
    const aiBtn = isQuestion && !f.filled
      ? `<div class="bidly-field-actions"><button class="bidly-ai-btn" data-field-idx="${idx}" title="Generate AI answer">✨ AI</button></div>`
      : ""

    return `
      <div class="${rowClass}">
        <span class="bidly-field-status">${statusIcon}</span>
        <div class="bidly-field-info">
          <span class="${labelClass}">${escapeHtml(f.label)}</span>
          <span class="bidly-field-type">${typeLabel} ${matchDot}</span>
        </div>
        ${aiBtn}
      </div>
    `
  }).join("")
}

function bindClose() {
  sidebarRoot?.querySelector("#bidly-close")?.addEventListener("click", closeSidebar)
}

function bindAIButtons() {
  if (!sidebarRoot) return
  const btns = sidebarRoot.querySelectorAll<HTMLButtonElement>(".bidly-ai-btn")
  btns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation()
      const idx = parseInt(btn.getAttribute("data-field-idx") || "-1")
      if (idx < 0 || idx >= detectedFields.length) return

      const field = detectedFields[idx]
      const scraped = scrapeJobData()
      const jobDescription = document.body.innerText.substring(0, 8000)

      btn.disabled = true
      btn.classList.add("bidly-ai-btn-generating")
      btn.textContent = "⏳..."

      try {
        const { answer } = await generateAnswer({
          question: field.label,
          jobTitle: scraped.title,
          company: scraped.company,
          jobDescription,
        })

        if (answer) {
          const { fillField } = await import("./detector")
          const success = fillField(field, answer)
          if (success) field.filled = true

          // Update UI
          const listEl = sidebarRoot!.querySelector("#bidly-fields-list")
          if (listEl) {
            listEl.innerHTML = renderFieldsList(detectedFields)
            bindAIButtons()
          }
        }
      } catch (err: any) {
        btn.textContent = "❌ Error"
        setTimeout(() => {
          btn.textContent = "✨ AI"
          btn.classList.remove("bidly-ai-btn-generating")
          btn.disabled = false
        }, 2000)
        return
      }

      btn.disabled = false
      btn.classList.remove("bidly-ai-btn-generating")
      btn.textContent = "✨ AI"
    })
  })
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
