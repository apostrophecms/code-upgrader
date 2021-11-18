module.exports = (o, s) => {
  if (o == null) {
    return null;
  }

  const clauses = s.split(/\./);

  for (const c of clauses) {
    if (o[c] == null) {
      return null;
    }
    o = o[c];
  }
  return o;
};
