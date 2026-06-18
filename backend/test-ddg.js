const { searchImages } = require('duck-duck-scrape');
async function test() {
  const results = await searchImages('apple');
  console.log(results.results[0]);
}
test();
