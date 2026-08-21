/**
 * In-memory cache instance using node-cache.
 *
 * This cache is scoped to a single Node.js process — data stored here
 * is not shared across instances or restarts. That's why node-cache
 * was chosen over Redis for this assessment: it's a single-instance app
 * that doesn't need an external cache server or persistence.
 *
 * stdTTL of 60 seconds means cached entries expire automatically
 * after one minute, keeping data reasonably fresh without requiring
 * manual expiration logic for every possible stale scenario.
 */
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 60 });

export default cache;
