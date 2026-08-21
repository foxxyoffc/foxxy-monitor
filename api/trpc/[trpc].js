// Vercel mengenali file .js ini sebagai Serverless Function. Express 4 masih
// memakai dynamic require internal, sehingga bundel CommonJS dimuat melalui
// createRequire dari wrapper ESM ini.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const app = require("../../dist/vercel-trpc.cjs").default;

export default app;
