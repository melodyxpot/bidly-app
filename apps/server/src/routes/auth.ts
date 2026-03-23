import { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { User } from "../models/User"
import { authenticate, AuthRequest } from "../middleware/auth"

const router = Router()

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return res.status(400).json({ error: "Email already in use" })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await User.create({ email: email.toLowerCase(), password: hashedPassword, name })

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as string & { __brand: "ms" },
    } as jwt.SignOptions)

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
    })
  } catch (error) {
    res.status(500).json({ error: "Registration failed" })
  }
})

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as string & { __brand: "ms" },
    } as jwt.SignOptions)

    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
    })
  } catch (error) {
    res.status(500).json({ error: "Login failed" })
  }
})

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("-password")
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }
    res.json({ user: { id: user._id, email: user.email, name: user.name } })
  } catch (error) {
    res.status(500).json({ error: "Failed to get user" })
  }
})

export { router as authRouter }
