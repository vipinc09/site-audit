import fs from "fs";
import path from "path";

const cjsContent = `// Generated file - DO NOT EDIT
const SiteChecker = require('./index.js').default;
module.exports = SiteChecker;
`;

const distPath = path.join(process.cwd(), "dist");
fs.writeFileSync(path.join(distPath, "index.cjs"), cjsContent);
