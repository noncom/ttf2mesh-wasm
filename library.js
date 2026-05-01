//@ts-expect-error
addToLibrary({
    /**
     * Send the addres and the length of the string to print on the JS side.
     * For example `asprintf()` to prepare the string
     * @param {number} addr 
     * @param {number} length 
     */
    jsLog: function(address, length) {}
})