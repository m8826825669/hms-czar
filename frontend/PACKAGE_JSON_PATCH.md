// frontend/package.json — add these two scripts under "scripts":
//
//   "gen:api":       "node scripts/gen-api.js",
//   "gen:api:watch": "nodemon --watch ../backend --ext py --exec npm run gen:api"
//
// The second one is optional — it re-runs codegen any time you change Python files.
// If you don't have nodemon installed and don't want it, skip the watch variant.
//
// You do NOT need to add openapi-typescript to dependencies — the gen-api.js
// script uses `npx --yes openapi-typescript@7` which downloads it on demand.
// If you'd rather pin it locally, run:
//
//   npm install --save-dev openapi-typescript@^7
//
// and change the script in gen-api.js to `openapi-typescript` (drop the npx prefix).
