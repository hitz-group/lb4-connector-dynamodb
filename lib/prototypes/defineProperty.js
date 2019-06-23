
function defineProperty(model, prop, params) {
  this.allModels[model].properties[prop] = params;
}

module.exports = defineProperty;
