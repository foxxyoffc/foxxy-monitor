import express from "express";
import { configureApplication } from "../../server/_core/app";

// Setiap procedure tRPC memakai satu segmen, misalnya `auth.settings` atau
// `auth.login`. Lokasi fungsi ini membuat Vercel memetakan /api/trpc/:trpc
// langsung ke aplikasi Express tanpa mengubah URL yang dibaca tRPC.
const app = configureApplication(express());

export default app;
