import { Router } from "express"
import multer from "multer"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { generateText, Output } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { put, del } from "@vercel/blob"
import PDFDocument from "pdfkit"
import { authenticate, AuthRequest } from "../middleware/auth"
import { Profile } from "../models/Profile"

const router = Router()
router.use(authenticate)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    cb(null, allowed.includes(file.mimetype))
  },
})

// GET /api/profile
router.get("/", async (req: AuthRequest, res) => {
  try {
    let profile = await Profile.findOne({ userId: req.userId }).lean()
    if (!profile) {
      const created = await Profile.create({ userId: req.userId })
      profile = created.toObject() as any
    }
    res.json({ profile })
  } catch (error) {
    res.status(500).json({ error: "Failed to get profile" })
  }
})

// PUT /api/profile
router.put("/", async (req: AuthRequest, res) => {
  try {
    const { resumeUrl, resumeFilename, ...updateData } = req.body
    const profile = await Profile.findOneAndUpdate(
      { userId: req.userId },
      { ...updateData, userId: req.userId },
      { new: true, upsert: true, runValidators: true }
    ).lean()
    res.json({ profile })
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" })
  }
})

// POST /api/profile/resume - Upload resume
router.post("/resume", upload.single("resume"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    const blob = await put(`resumes/${req.userId}/${req.file.originalname}`, req.file.buffer, {
      access: "public",
      contentType: req.file.mimetype,
    })

    await Profile.findOneAndUpdate(
      { userId: req.userId },
      {
        userId: req.userId,
        resumeFilename: req.file.originalname,
        resumeUrl: blob.url,
      },
      { upsert: true }
    )

    res.json({
      filename: req.file.originalname,
      url: blob.url,
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to upload resume" })
  }
})

// GET /api/profile/resume - Download resume
router.get("/resume", async (req: AuthRequest, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.userId }).select("resumeUrl resumeFilename")
    if (!profile?.resumeUrl) {
      return res.status(404).json({ error: "No resume found" })
    }

    res.json({ url: profile.resumeUrl, filename: profile.resumeFilename })
  } catch (error) {
    res.status(500).json({ error: "Failed to get resume" })
  }
})

// DELETE /api/profile/resume - Delete resume
router.delete("/resume", async (req: AuthRequest, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.userId }).select("resumeUrl")
    if (profile?.resumeUrl) {
      try { await del(profile.resumeUrl) } catch {}
    }
    await Profile.findOneAndUpdate(
      { userId: req.userId },
      { $unset: { resumeUrl: 1, resumeFilename: 1 } }
    )
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to delete resume" })
  }
})

// POST /api/profile/parse-resume - Parse resume with AI
router.post("/parse-resume", upload.single("resume"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    // Extract text from file
    let text = ""
    if (req.file.mimetype === "application/pdf") {
      const parsed = await pdfParse(req.file.buffer)
      text = parsed.text
    } else {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer })
      text = result.value
    }

    if (!text.trim()) {
      return res.status(400).json({ error: "Could not extract text from file" })
    }

    // Also save the resume file
    const blob = await put(`resumes/${req.userId}/${req.file.originalname}`, req.file.buffer, {
      access: "public",
      contentType: req.file.mimetype,
    })

    await Profile.findOneAndUpdate(
      { userId: req.userId },
      {
        userId: req.userId,
        resumeFilename: req.file.originalname,
        resumeUrl: blob.url,
      },
      { upsert: true }
    )

    // Parse with AI SDK
    const resumeSchema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      phone: z.string(),
      address: z.string(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string(),
      country: z.string(),
      linkedIn: z.string(),
      github: z.string(),
      portfolio: z.string(),
      otherSocials: z.string(),
      summary: z.string(),
      education: z.array(z.object({
        school: z.string(),
        degree: z.string(),
        field: z.string(),
        startDate: z.string().describe("YYYY-MM or YYYY format"),
        endDate: z.string().describe("YYYY-MM, YYYY, or 'Present'"),
        gpa: z.string(),
        description: z.string(),
      })),
      experience: z.array(z.object({
        company: z.string(),
        title: z.string(),
        location: z.string(),
        startDate: z.string().describe("YYYY-MM or YYYY format"),
        endDate: z.string().describe("YYYY-MM, YYYY, or 'Present'"),
        current: z.boolean().describe("true if currently working here"),
        description: z.string(),
      })),
      projects: z.array(z.object({
        name: z.string(),
        url: z.string(),
        description: z.string(),
        technologies: z.string(),
      })),
      skills: z.array(z.string()).describe("Flat list of individual skills"),
    })

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelId = process.env.AI_MODEL || "gpt-4o-mini"

    const result = await generateText({
      model: openai(modelId),
      experimental_output: Output.object({ schema: resumeSchema }),
      system: `You are a resume parser. Extract structured data from the resume text. Extract as much information as possible. For dates, use YYYY-MM format when month is available, otherwise YYYY. If endDate is current/present, use "Present" and set current to true. Use empty strings for missing fields.`,
      prompt: `Parse this resume:\n\n${text.substring(0, 15000)}`,
    })

    const parsed = result.experimental_output

    res.json({
      parsed,
      filename: req.file.originalname,
    })
  } catch (error: any) {
    console.error("Resume parse error:", error)
    res.status(500).json({ error: error.message || "Failed to parse resume" })
  }
})

// POST /api/profile/generate-resume - Generate custom resume for a job
router.post("/generate-resume", async (req: AuthRequest, res) => {
  try {
    const { jobTitle, company, jobDescription } = req.body
    if (!jobDescription) {
      return res.status(400).json({ error: "Job description is required" })
    }

    const profile = await Profile.findOne({ userId: req.userId }).select("-generatedResumes")
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" })
    }

    const profileData = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zipCode: profile.zipCode,
      country: profile.country,
      linkedIn: profile.linkedIn,
      github: profile.github,
      portfolio: profile.portfolio,
      summary: profile.summary,
      education: profile.education,
      experience: profile.experience,
      projects: profile.projects,
      skills: profile.skills,
    }

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelId = process.env.AI_MODEL || "gpt-4o-mini"

    const resumeContentSchema = z.object({
      summary: z.string().describe("Professional summary tailored to the job"),
      experience: z.array(z.object({
        title: z.string(),
        company: z.string(),
        location: z.string(),
        dates: z.string(),
        bullets: z.array(z.string()),
      })),
      education: z.array(z.object({
        degree: z.string(),
        school: z.string(),
        dates: z.string(),
        details: z.string(),
      })),
      skills: z.array(z.string()),
      projects: z.array(z.object({
        name: z.string(),
        description: z.string(),
        technologies: z.string(),
      })),
    })

    const result = await generateText({
      model: openai(modelId),
      experimental_output: Output.object({ schema: resumeContentSchema }),
      system: `You are an expert ATS (Applicant Tracking System) resume writer. Generate a tailored, ATS-optimized resume designed to pass automated screening systems used by major job application platforms like Workday (myworkday.com), Greenhouse, Lever, iCIMS, Taleo, and BambooHR.

Key ATS optimization rules:
- Use standard section headings: "Professional Summary", "Experience", "Education", "Skills", "Projects"
- Include relevant keywords from the job description naturally in experience bullets and summary
- Use reverse chronological order for experience and education
- Write clear, quantified achievement bullets (use metrics, percentages, dollar amounts where possible)
- Match job title keywords and required skills exactly as they appear in the job posting
- Keep formatting simple - no tables, columns, or graphics (plain text structure)
- Include both spelled-out and abbreviated forms of technical terms (e.g., "Machine Learning (ML)")
- Prioritize hard skills and technical competencies that match the job requirements
- Tailor the professional summary to directly address the role's key requirements
- Keep it concise: ideally 1 page, max 2 pages`,
      prompt: `Candidate Profile:\n${JSON.stringify(profileData, null, 2)}\n\nJob Description:\n${jobDescription.substring(0, 10000)}`,
    })

    const content = result.experimental_output

    // Generate PDF
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 50, bottom: 50, left: 50, right: 50 } })
    const chunks: Buffer[] = []
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))

    const pdfDone = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)))
    })

    // Header
    const fullName = `${profile.firstName} ${profile.lastName}`.trim()
    doc.fontSize(20).font("Helvetica-Bold").text(fullName, { align: "center" })
    const contactParts = [profile.email, profile.phone, profile.city && profile.state ? `${profile.city}, ${profile.state}` : ""].filter(Boolean)
    if (contactParts.length) {
      doc.fontSize(9).font("Helvetica").text(contactParts.join(" | "), { align: "center" })
    }
    const linkParts = [profile.linkedIn, profile.github, profile.portfolio].filter(Boolean)
    if (linkParts.length) {
      doc.fontSize(9).font("Helvetica").text(linkParts.join(" | "), { align: "center" })
    }
    doc.moveDown(0.5)

    // Summary
    if (content.summary) {
      doc.fontSize(12).font("Helvetica-Bold").text("PROFESSIONAL SUMMARY")
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke()
      doc.moveDown(0.3)
      doc.fontSize(10).font("Helvetica").text(content.summary)
      doc.moveDown(0.5)
    }

    // Experience
    if (content.experience?.length) {
      doc.fontSize(12).font("Helvetica-Bold").text("EXPERIENCE")
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke()
      doc.moveDown(0.3)
      for (const exp of content.experience) {
        doc.fontSize(10).font("Helvetica-Bold").text(`${exp.title} — ${exp.company}`, { continued: false })
        doc.fontSize(9).font("Helvetica").text(`${exp.location}  |  ${exp.dates}`)
        for (const bullet of exp.bullets) {
          doc.fontSize(10).font("Helvetica").text(`• ${bullet}`, { indent: 10 })
        }
        doc.moveDown(0.3)
      }
    }

    // Education
    if (content.education?.length) {
      doc.fontSize(12).font("Helvetica-Bold").text("EDUCATION")
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke()
      doc.moveDown(0.3)
      for (const edu of content.education) {
        doc.fontSize(10).font("Helvetica-Bold").text(edu.degree, { continued: false })
        doc.fontSize(10).font("Helvetica").text(`${edu.school}  |  ${edu.dates}`)
        if (edu.details) doc.fontSize(9).font("Helvetica").text(edu.details)
        doc.moveDown(0.2)
      }
    }

    // Skills
    if (content.skills?.length) {
      doc.fontSize(12).font("Helvetica-Bold").text("SKILLS")
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke()
      doc.moveDown(0.3)
      doc.fontSize(10).font("Helvetica").text(content.skills.join(", "))
      doc.moveDown(0.5)
    }

    // Projects
    if (content.projects?.length) {
      doc.fontSize(12).font("Helvetica-Bold").text("PROJECTS")
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke()
      doc.moveDown(0.3)
      for (const proj of content.projects) {
        doc.fontSize(10).font("Helvetica-Bold").text(proj.name)
        if (proj.technologies) doc.fontSize(9).font("Helvetica").text(`Technologies: ${proj.technologies}`)
        doc.fontSize(10).font("Helvetica").text(proj.description)
        doc.moveDown(0.2)
      }
    }

    doc.end()
    const pdfBuffer = await pdfDone

    // Upload to Vercel Blob
    const now = new Date()
    const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const safeTitle = (jobTitle || "resume").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_").substring(0, 30)
    const safeCompany = (company || "unknown").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_").substring(0, 20)
    const filename = `${safeTitle}_${safeCompany}_${dateStr}.pdf`

    const blob = await put(`generated-resumes/${req.userId}/${filename}`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
    })

    // Save reference to profile
    await Profile.findOneAndUpdate(
      { userId: req.userId },
      {
        $push: {
          generatedResumes: {
            jobTitle: jobTitle || "",
            company: company || "",
            url: blob.url,
            createdAt: new Date(),
          },
        },
      }
    )

    res.json({
      url: blob.url,
      filename,
      jobTitle,
      company,
    })
  } catch (error: any) {
    console.error("Generate resume error:", error)
    res.status(500).json({ error: error.message || "Failed to generate resume" })
  }
})

// POST /api/profile/detect-fields - AI-powered field detection
router.post("/detect-fields", async (req: AuthRequest, res) => {
  try {
    const { fields } = req.body
    if (!fields?.length) {
      return res.status(400).json({ error: "No fields provided" })
    }

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelId = process.env.AI_MODEL || "gpt-4o-mini"

    const result = await generateText({
      model: openai(modelId),
      system: `You are a form field analyzer. Given a list of form fields from a job application page, map each field to the correct profile data key. Return a JSON array where each item has "index" (0-based) and "profileKey" (the mapped key or null if unknown).

Valid profileKey values:
- Personal: "firstName", "lastName", "fullName", "email", "phone", "address", "city", "state", "zipCode", "country"
- Links: "linkedIn", "github", "portfolio"
- Professional: "summary"
- Files: "resumeFile", "coverLetterFile"
- Equal Employment: "ee.authorizedToWork", "ee.disability", "ee.gender", "ee.requireSponsorship", "ee.lgbtq", "ee.veteran", "ee.race", "ee.hispanicOrLatino", "ee.sexualOrientation"
- null if you cannot determine what the field is for

Return ONLY a JSON array like: [{"index":0,"profileKey":"firstName"},{"index":1,"profileKey":null}]`,
      prompt: JSON.stringify(fields.slice(0, 50).map((f: any, i: number) => ({
        index: i,
        label: f.label,
        type: f.type,
        name: f.name,
        id: f.id,
      }))),
    })

    let mappings: any[] = []
    try {
      const text = result.text
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) mappings = JSON.parse(jsonMatch[0])
    } catch {}

    res.json({ mappings })
  } catch (error: any) {
    console.error("Field detection error:", error)
    res.status(500).json({ error: error.message || "Failed to detect fields" })
  }
})

export { router as profileRouter }
