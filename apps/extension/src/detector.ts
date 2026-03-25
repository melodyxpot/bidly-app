export interface DetectedField {
  id: string
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  label: string
  type: "text" | "email" | "tel" | "url" | "textarea" | "select" | "checkbox" | "file" | "radio" | "date"
  profileKey: string | null
  filled: boolean
}

function getFieldLabel(el: HTMLElement): string {
  // Try: associated label element
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`)
    if (label?.textContent?.trim()) return label.textContent.trim()
  }
  // Try: parent label
  const parentLabel = el.closest("label")
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement
    clone.querySelectorAll("input,select,textarea").forEach(c => c.remove())
    if (clone.textContent?.trim()) return clone.textContent.trim()
  }
  // Try: aria-label
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label")!
  // Try: placeholder
  if ((el as HTMLInputElement).placeholder) return (el as HTMLInputElement).placeholder
  // Try: name attribute cleaned up
  if (el.getAttribute("name")) {
    return el.getAttribute("name")!.replace(/[_\-\[\]]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
  }
  return ""
}

function matchProfileKey(label: string, type: string): string | null {
  const l = label.toLowerCase()

  // Personal info
  if (l.match(/first\s*name/)) return "firstName"
  if (l.match(/last\s*name/)) return "lastName"
  if (l.match(/full\s*name/)) return "fullName"
  if (type === "email" || l.match(/e[\-\s]?mail/)) return "email"
  if (type === "tel" || l.match(/phone|mobile|cell/)) return "phone"
  if (l.match(/^address$|street\s*address|address\s*line\s*1/)) return "address"
  if (l.match(/city/)) return "city"
  if (l.match(/state|province/)) return "state"
  if (l.match(/zip|postal/)) return "zipCode"
  if (l.match(/country/)) return "country"

  // Links
  if (l.match(/linkedin/)) return "linkedIn"
  if (l.match(/github/)) return "github"
  if (l.match(/portfolio|website|personal\s*site/)) return "portfolio"

  // Summary
  if (l.match(/summary|about|cover\s*letter|tell\s*us\s*about/)) return "summary"

  // File uploads
  if (type === "file" && l.match(/resume|cv/i)) return "resumeFile"
  if (type === "file" && l.match(/cover/i)) return "coverLetterFile"
  if (type === "file") return "resumeFile"

  // Equal employment
  if (l.match(/authorized.*work|work.*authori[sz]/)) return "ee.authorizedToWork"
  if (l.match(/disability|disabled/)) return "ee.disability"
  if (l.match(/gender/)) return "ee.gender"
  if (l.match(/sponsor/)) return "ee.requireSponsorship"
  if (l.match(/lgbtq/)) return "ee.lgbtq"
  if (l.match(/veteran/)) return "ee.veteran"
  if (l.match(/race|ethnicity/)) return "ee.race"
  if (l.match(/hispanic|latino/)) return "ee.hispanicOrLatino"
  if (l.match(/sexual\s*orientation/)) return "ee.sexualOrientation"

  return null
}

export function detectFormFields(): DetectedField[] {
  const fields: DetectedField[] = []
  const seen = new Set<HTMLElement>()

  const selectors = "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), textarea, select"
  const elements = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selectors)

  elements.forEach((el, index) => {
    if (seen.has(el)) return
    // Skip elements inside the bidly sidebar
    if (el.closest("#bidly-sidebar-root") || el.closest("#bidly-fab")) return
    // Skip hidden elements
    if (el.offsetParent === null && (el as HTMLInputElement).type !== "file") return

    seen.add(el)

    const inputType = el.tagName === "TEXTAREA" ? "textarea"
      : el.tagName === "SELECT" ? "select"
      : (el as HTMLInputElement).type || "text"

    const type = inputType as DetectedField["type"]
    const label = getFieldLabel(el)
    const profileKey = matchProfileKey(label, type)

    fields.push({
      id: `bidly-field-${index}`,
      element: el,
      label: label || `Field ${index + 1}`,
      type,
      profileKey,
      filled: false,
    })
  })

  return fields
}

export function getProfileValue(profile: any, key: string): any {
  if (key === "fullName") {
    return `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
  }
  if (key.startsWith("ee.")) {
    const eeKey = key.replace("ee.", "")
    return profile.equalEmployment?.[eeKey] || ""
  }
  return profile[key] || ""
}

export function fillField(field: DetectedField, value: any): boolean {
  const el = field.element

  try {
    if (field.type === "checkbox" || field.type === "radio") {
      const input = el as HTMLInputElement
      const shouldCheck = value === true || value === "Yes" || value === input.value
      if (input.checked !== shouldCheck) {
        input.checked = shouldCheck
        input.dispatchEvent(new Event("change", { bubbles: true }))
        input.dispatchEvent(new Event("input", { bubbles: true }))
      }
      return true
    }

    if (field.type === "select") {
      const select = el as HTMLSelectElement
      const options = Array.from(select.options)
      const match = options.find(opt => {
        const optText = opt.textContent?.toLowerCase() || ""
        const val = String(value).toLowerCase()
        return optText.includes(val) || val.includes(optText) || opt.value.toLowerCase() === val
      })
      if (match) {
        select.value = match.value
        select.dispatchEvent(new Event("change", { bubbles: true }))
        select.dispatchEvent(new Event("input", { bubbles: true }))
        return true
      }
      return false
    }

    if (field.type === "file") {
      return false
    }

    // Text, email, tel, url, textarea, date
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      field.type === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      "value"
    )?.set

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, String(value))
    } else {
      (el as HTMLInputElement).value = String(value)
    }
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    el.dispatchEvent(new Event("blur", { bubbles: true }))
    return true
  } catch {
    return false
  }
}

export async function attachFileToInput(input: HTMLInputElement, fileUrl: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(fileUrl)
    const blob = await response.blob()
    const file = new File([blob], filename, { type: blob.type })
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
    input.dispatchEvent(new Event("change", { bubbles: true }))
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return true
  } catch {
    return false
  }
}
