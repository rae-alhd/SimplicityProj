// Task Q1: used when building server-generated upload filenames out of a
// route param (product/collection/variant id). Strips everything except
// [A-Za-z0-9_-] so a malformed or spoofed param can never inject a "/" or
// ".." into the filename multer.diskStorage joins onto its destination
// directory — i.e. this can't become a path-traversal write, regardless
// of whether the id was already validated elsewhere.
function sanitizeIdForFilename(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "");
}

module.exports = { sanitizeIdForFilename };
