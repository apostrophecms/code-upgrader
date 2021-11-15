// This file was copied into your project by the 2.x to 3.x
// code migration tool. It helps with things the tool can't
// convert in the source code.
//
// You can remove it when none of your modules require it anymore.

module.exports = {
  // Invoked by converted code when schema field arrays are defined
  // somewhere other than directly in the addFields option.
  // You should convert those yourself as soon as you are able
  // (hint: the spread operator is very helpful for merging
  // objects).
  arrayOptionToObject(fields) {
    return Object.fromEntries(
      fields.map(field => (
        [
          field.name,
          field
        ]
      ))
    );
  }
};
