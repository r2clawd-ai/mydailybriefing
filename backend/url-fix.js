// Shared URL normalizer — imported by all modules that build URL fields
function fixUrl(url) {
  if (!url) return '';
  return url.replace('news.google.com/rss/articles/', 'news.google.com/articles/');
}
module.exports = { fixUrl };
