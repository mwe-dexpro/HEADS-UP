// Node has no built-in IndexedDB — polyfill it for secureCache's tests.
// Node's own Web Crypto (globalThis.crypto.subtle) is used as-is, no polyfill needed.
import "fake-indexeddb/auto";
