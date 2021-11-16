const assert = require('assert');
const helpers = require('../helpers/index.js');

describe('helpers work', () => {
  it('handles array option to object conversion', () => {
    const converted = helpers.arrayOptionToObject([
      {
        name: 'job',
        type: 'string',
        title: 'Job'
      }
    ]);
    assert(!Array.isArray(converted));
    assert((typeof converted) === 'object');
    assert(converted.job.type === 'string');
    assert(converted.job.title === 'Job');
  });
});
