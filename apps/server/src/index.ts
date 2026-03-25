import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import { authRouter } from "./routes/auth"
import { applicationsRouter } from "./routes/applications"
import { dashboardRouter } from "./routes/dashboard"
import { settingsRouter } from "./routes/settings"
import { profileRouter } from "./routes/profile"

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json({ limit: "10mb" }))

app.use("/api/auth", authRouter)
app.use("/api/applications", applicationsRouter)
app.use("/api/dashboard", dashboardRouter)
app.use("/api/settings", settingsRouter)
app.use("/api/profile", profileRouter)

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" })
})

mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log("Connected to MongoDB")
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err)
    process.exit(1)
  })
