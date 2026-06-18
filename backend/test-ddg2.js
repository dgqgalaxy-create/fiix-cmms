const { imageSearch } = require('@mudbill/duckduckgo-images-api');
async function test() {
  const results = await imageSearch({ query: 'apple' });
  console.log(results[0]);
}
test();
