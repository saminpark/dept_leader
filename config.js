/* Optional public configuration. You can instead enter these in the UI.
 * OAuth client IDs are public identifiers. Never put a client secret,
 * access token, task backup or private business record in this file.
 */
window.FRAND_CONFIG = {
  clientId: '',
  mode: 'drive.file', // default: authorize selected files only
  apiKey: '',        // browser-restricted Google Picker API key
  projectNumber: '',
  documentId: '',    // optional; selecting an existing file still grants access
  documentName: '',
  timezone: 'Asia/Seoul'
};
