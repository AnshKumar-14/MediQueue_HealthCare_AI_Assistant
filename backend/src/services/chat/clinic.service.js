const ClinicInfo = require("../../models/ClinicInfo");
const { normalizeLocale } = require("./i18n");

function localize(doc, locale) {
  if (!doc) return null;
  const lang = normalizeLocale(locale);
  const override = doc.translations?.[lang];
  return {
    key: doc.key,
    category: doc.category,
    title: override?.title || doc.title,
    content: override?.content || doc.content,
  };
}

async function getClinicInfo(key, locale = "en") {
  if (!key) return null;
  const doc = await ClinicInfo.findOne({ key, isActive: true }).lean();
  return localize(doc, locale);
}

async function listClinicInfo(locale = "en", category) {
  const filter = { isActive: true };
  if (category) filter.category = category;
  const docs = await ClinicInfo.find(filter).sort({ category: 1, key: 1 }).lean();
  return docs.map((doc) => localize(doc, locale));
}

async function searchClinicInfo(keywords = [], locale = "en") {
  if (!keywords.length) return null;
  const docs = await ClinicInfo.find({ isActive: true }).lean();
  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());

  const scored = docs
    .map((doc) => {
      const haystack = [doc.key, doc.title, doc.content, ...(doc.keywords || [])]
        .join(" ")
        .toLowerCase();
      const score = lowerKeywords.reduce(
        (total, keyword) => total + (haystack.includes(keyword) ? 1 : 0),
        0
      );
      return { doc, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length ? localize(scored[0].doc, locale) : null;
}

module.exports = { getClinicInfo, listClinicInfo, searchClinicInfo, localize };
