import express from "express";
import { configureApplication } from "./server/_core/app";
import { serveStatic } from "./server/_core/vite";

const app = configureApplication(express());

// Pada Vercel, aset hasil build disajikan dari direktori public/ oleh CDN.
// Fallback ini menjaga mode Node/Express biasa tetap dapat menyajikan SPA.
if (process.env.NODE_ENV === "production") {
  serveStatic(app);
}

export default app;
