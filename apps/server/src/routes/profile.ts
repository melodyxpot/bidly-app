import { Router } from "express"
import multer from "multer"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { generateText, Output } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
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
    let profile = await Profile.findOne({ userId: req.userId }).select("-resumeData").lean()
    if (!profile) {
      const created = await Profile.create({ userId: req.userId })
      profile = created.toObject() as any
      delete (profile as any).resumeData
    }
    res.json({ profile })
  } catch (error) {
    res.status(500).json({ error: "Failed to get profile" })
  }
})

// PUT /api/profile
router.put("/", async (req: AuthRequest, res) => {
  try {
    const { resumeData, resumeFilename, resumeMimeType, ...updateData } = req.body
    const profile = await Profile.findOneAndUpdate(
      { userId: req.userId },
      { ...updateData, userId: req.userId },
      { new: true, upsert: true, runValidators: true }
    ).select("-resumeData").lean()
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

    await Profile.findOneAndUpdate(
      { userId: req.userId },
      {
        userId: req.userId,
        resumeFilename: req.file.originalname,
        resumeData: req.file.buffer,
        resumeMimeType: req.file.mimetype,
      },
      { upsert: true }
    )

    res.json({
      filename: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to upload resume" })
  }
})

// GET /api/profile/resume - Download resume
router.get("/resume", async (req: AuthRequest, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.userId }).select("resumeData resumeFilename resumeMimeType")
    if (!profile?.resumeData) {
      return res.status(404).json({ error: "No resume found" })
    }

    res.set({
      "Content-Type": profile.resumeMimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${profile.resumeFilename || "resume"}"`,
    })
    res.send(profile.resumeData)
  } catch (error) {
    res.status(500).json({ error: "Failed to download resume" })
  }
})

// DELETE /api/profile/resume - Delete resume
router.delete("/resume", async (req: AuthRequest, res) => {
  try {
    await Profile.findOneAndUpdate(
      { userId: req.userId },
      { $unset: { resumeData: 1, resumeFilename: 1, resumeMimeType: 1 } }
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
    await Profile.findOneAndUpdate(
      { userId: req.userId },
      {
        userId: req.userId,
        resumeFilename: req.file.originalname,
        resumeData: req.file.buffer,
        resumeMimeType: req.file.mimetype,
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

export { router as profileRouter }
