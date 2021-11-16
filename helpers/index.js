// This file was copied into your project by the 2.x to 3.x
// code migration tool. It helps with things the tool can't
// convert in the source code.
//
// You can remove it when none of your modules require it anymore.

module.exports = {
  // Invoked by converted code when schema field arrays are defined
  // somewhere other than directly in the addFields option.
  // You should update your code to avoid the need for this function ASAP.
  arrayOptionToObject(fields) {
    return Object.fromEntries(
      fields.map(field => {
        const withoutName = Object.fromEntries(Object.entries(field).filter(([ name, value ]) => name !== 'name'));
        return [ field.name, withoutName ];
      })
    );
  }
};
