import express from "express";
import { configureApplication } from "./_core/app";

// Entry point ini dibundel oleh esbuild menjadi satu berkas CommonJS.
// Dengan begitu runtime Vercel tidak perlu mencari modul TypeScript server
// satu per satu di dalam direktori fungsi.
const app = configureApplication(express());

export default app;
