import { Router } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { JobApplication } from "../models/JobApplication"

const router = Router()
router.use(authenticate)

// GET /api/applications
router.get("/", async (req: AuthRequest, res) => {
  try {
    const {
      page = "1",
      pageSize = "20",
      search,
      status,
      platform,
      dateFrom,
      dateTo,
      sortBy = "appliedAt",
      sortOrder = "desc",
    } = req.query as Record<string, string>

    const filter: any = { userId: req.userId }

    if (search) {
      filter.$or = [
        { company: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
      ]
    }

    if (status && status !== "all") {
      filter.status = status
    }

    if (platform && platform !== "all") {
      filter.platform = platform
    }

    if (dateFrom || dateTo) {
      filter.appliedAt = {}
      if (dateFrom) filter.appliedAt.$gte = new Date(dateFrom)
      if (dateTo) filter.appliedAt.$lte = new Date(dateTo)
    }

    const pageNum = parseInt(page)
    const size = parseInt(pageSize)
    const skip = (pageNum - 1) * size
    const sort: any = { [sortBy]: sortOrder === "asc" ? 1 : -1 }

    const [data, count] = await Promise.all([
      JobApplication.find(filter).sort(sort).skip(skip).limit(size).lean(),
      JobApplication.countDocuments(filter),
    ])

    res.json({ data, count })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch applications" })
  }
})

// GET /api/applications/:id
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const app = await JobApplication.findOne({ _id: req.params.id, userId: req.userId }).lean()
    if (!app) {
      return res.status(404).json({ error: "Application not found" })
    }
    res.json({ data: app })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch application" })
  }
})

// POST /api/applications
router.post("/", async (req: AuthRequest, res) => {
  try {
    const app = await JobApplication.create({ ...req.body, userId: req.userId })
    res.status(201).json({ data: app })
  } catch (error) {
    res.status(500).json({ error: "Failed to create application" })
  }
})

// PUT /api/applications/:id
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const app = await JobApplication.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    ).lean()

    if (!app) {
      return res.status(404).json({ error: "Application not found" })
    }
    res.json({ data: app })
  } catch (error) {
    res.status(500).json({ error: "Failed to update application" })
  }
})

// DELETE /api/applications/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const app = await JobApplication.findOneAndDelete({ _id: req.params.id, userId: req.userId })
    if (!app) {
      return res.status(404).json({ error: "Application not found" })
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to delete application" })
  }
})

// POST /api/applications/bulk
router.post("/bulk", async (req: AuthRequest, res) => {
  try {
    const { applications } = req.body
    const docs = applications.map((app: any) => ({ ...app, userId: req.userId }))
    const result = await JobApplication.insertMany(docs, { ordered: false })
    res.status(201).json({ insertedCount: result.length })
  } catch (error: any) {
    const insertedCount = error.insertedDocs?.length || 0
    res.status(207).json({ insertedCount, error: error.message })
  }
})

export { router as applicationsRouter }
