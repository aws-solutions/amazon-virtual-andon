/**
 * If the SOLUTION_ID and SOLUTION_VERSION environment variables are set, this will return 
 * an object with a custom user agent string. Otherwise, the object returned will be empty
 * @returns {object} Either object with `customUserAgent` string or an empty object
 */
exports.getOptions = function () {
    const options = {};

    const { SOLUTION_ID, SOLUTION_VERSION } = process.env;
    if (SOLUTION_ID && SOLUTION_VERSION) {
        if (SOLUTION_ID.trim() !== '' && SOLUTION_VERSION.trim() !== '') {
            options.customUserAgent = `AwsSolution/${SOLUTION_ID}/${SOLUTION_VERSION}`;
        }
    }

    return options;
}
