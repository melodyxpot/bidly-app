import mongoose, { Schema, Document } from "mongoose"

export interface IUser extends Document {
  email: string
  password: string
  name?: string
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, trim: true },
  },
  { timestamps: true }
)

export const User = mongoose.model<IUser>("User", userSchema)
