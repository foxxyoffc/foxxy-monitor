// Vercel mengenali file ini sebagai Function. Artefak tujuan dibuat oleh
// `pnpm build:vercel` dan disertakan melalui `includeFiles` di vercel.json.
module.exports = require("../../dist/vercel-trpc.cjs").default;
