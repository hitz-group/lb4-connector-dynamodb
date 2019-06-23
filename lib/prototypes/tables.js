
function tables(name) {
  if (!this.allTables[name]) {
    this.allTables[name] = name;
  }
  return this.allTables[name];
}

module.exports = tables;
