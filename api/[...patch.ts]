import express from "express";
import { configureApplication } from "../server/_core/app";

// Vercel mengenali berkas dalam folder api sebagai Function. Nama catch-all ini
// menjaga path asli, misalnya /api/trpc/auth.settings, untuk middleware tRPC.
const app = configureApplication(express());

export default app;
