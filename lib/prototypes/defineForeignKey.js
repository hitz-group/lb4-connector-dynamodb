
function defineForeignKey(model, key, cb) {
  const { hashKey } = this.allModels[model];
  const attributeSpec = (this._attributeSpecs[model].id
    || this._attributeSpecs[model][hashKey]);

  if (attributeSpec === 'string') {
    cb(null, String);
  } else if (attributeSpec === 'number') {
    cb(null, Number);
  } else if (attributeSpec === 'date') {
    cb(null, Date);
  }
}

module.exports = defineForeignKey;
