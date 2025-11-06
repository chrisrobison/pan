function isSerializable(data) {
  try {
    JSON.stringify(data);
    return true;
  } catch (e) {
    return false;
  }
}
function checkSerializable(data) {
  if (data === void 0) {
    return { valid: true };
  }
  if (typeof data === "function") {
    return { valid: false, error: "Functions cannot be serialized" };
  }
  if (data instanceof Node || data instanceof Element) {
    return { valid: false, error: "DOM nodes cannot be serialized" };
  }
  if (data instanceof Window) {
    return { valid: false, error: "Window objects cannot be serialized" };
  }
  try {
    JSON.stringify(data);
    return { valid: true };
  } catch (e) {
    if (e.message.includes("circular")) {
      return { valid: false, error: "Circular references are not allowed" };
    }
    if (e.message.includes("BigInt")) {
      return { valid: false, error: "BigInt values are not JSON-serializable (convert to string first)" };
    }
    return { valid: false, error: `Serialization error: ${e.message}` };
  }
}
function estimateSize(obj) {
  try {
    const json = JSON.stringify(obj);
    return new Blob([json]).size;
  } catch (e) {
    return 0;
  }
}
function validateTopic(topic) {
  if (!topic || typeof topic !== "string") {
    return { valid: false, error: "Topic must be a non-empty string" };
  }
  if (topic.length > 256) {
    return { valid: false, error: "Topic must be less than 256 characters" };
  }
  if (!/^[a-z0-9:.*_-]+$/i.test(topic)) {
    return {
      valid: false,
      error: "Topic can only contain letters, numbers, dots, colons, hyphens, underscores, and asterisks"
    };
  }
  if (topic.includes("..")) {
    return { valid: false, error: "Topic cannot contain consecutive dots" };
  }
  if (topic.startsWith(".") || topic.endsWith(".")) {
    return { valid: false, error: "Topic cannot start or end with a dot" };
  }
  return { valid: true };
}
function validatePattern(pattern, options = {}) {
  const {
    allowGlobalWildcard = true,
    maxWildcards = 5
  } = options;
  const topicValidation = validateTopic(pattern);
  if (!topicValidation.valid) {
    return topicValidation;
  }
  if (pattern === "*") {
    if (!allowGlobalWildcard) {
      return {
        valid: false,
        error: "Global wildcard (*) is disabled for security reasons"
      };
    }
    return { valid: true };
  }
  const wildcardCount = (pattern.match(/\*/g) || []).length;
  if (wildcardCount > maxWildcards) {
    return {
      valid: false,
      error: `Too many wildcards (${wildcardCount}), maximum is ${maxWildcards}`
    };
  }
  const segments = pattern.split(".");
  for (const segment of segments) {
    if (segment.includes("*") && segment !== "*") {
      return {
        valid: false,
        error: 'Wildcards must be a complete segment (use "users.*" not "users.u*")'
      };
    }
  }
  return { valid: true };
}
function validateMessage(msg, limits = {}) {
  const {
    maxMessageSize = 1048576,
    maxPayloadSize = 524288
  } = limits;
  const topicValidation = validateTopic(msg.topic);
  if (!topicValidation.valid) {
    return topicValidation;
  }
  const dataValidation = checkSerializable(msg.data);
  if (!dataValidation.valid) {
    return { valid: false, error: `Data validation failed: ${dataValidation.error}` };
  }
  const msgSize = estimateSize(msg);
  if (msgSize > maxMessageSize) {
    return {
      valid: false,
      error: `Message size (${msgSize} bytes) exceeds limit (${maxMessageSize} bytes)`
    };
  }
  const dataSize = estimateSize(msg.data);
  if (dataSize > maxPayloadSize) {
    return {
      valid: false,
      error: `Payload size (${dataSize} bytes) exceeds limit (${maxPayloadSize} bytes)`
    };
  }
  if (msg.id !== void 0 && typeof msg.id !== "string") {
    return { valid: false, error: "Message id must be a string" };
  }
  if (msg.ts !== void 0 && typeof msg.ts !== "number") {
    return { valid: false, error: "Message timestamp must be a number" };
  }
  if (msg.retain !== void 0 && typeof msg.retain !== "boolean") {
    return { valid: false, error: "Message retain must be a boolean" };
  }
  if (msg.replyTo !== void 0) {
    const replyToValidation = validateTopic(msg.replyTo);
    if (!replyToValidation.valid) {
      return { valid: false, error: `Invalid replyTo: ${replyToValidation.error}` };
    }
  }
  if (msg.correlationId !== void 0 && typeof msg.correlationId !== "string") {
    return { valid: false, error: "Message correlationId must be a string" };
  }
  if (msg.headers !== void 0) {
    if (typeof msg.headers !== "object" || Array.isArray(msg.headers)) {
      return { valid: false, error: "Message headers must be an object" };
    }
    for (const [key, value] of Object.entries(msg.headers)) {
      if (typeof value !== "string") {
        return { valid: false, error: `Header "${key}" must be a string value` };
      }
    }
  }
  return { valid: true };
}
function isElementAlive(el) {
  if (!el) return false;
  if (!el.isConnected) return false;
  return document.contains(el) || document.body.contains(el);
}
function sanitizeError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") {
    return error.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[email]").replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[card]").replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]");
  }
  if (error instanceof Error) {
    return sanitizeError(error.message);
  }
  try {
    return sanitizeError(String(error));
  } catch (e) {
    return "Error cannot be displayed";
  }
}
var pan_validation_default = {
  isSerializable,
  checkSerializable,
  estimateSize,
  validateTopic,
  validatePattern,
  validateMessage,
  isElementAlive,
  sanitizeError
};
export {
  checkSerializable,
  pan_validation_default as default,
  estimateSize,
  isElementAlive,
  isSerializable,
  sanitizeError,
  validateMessage,
  validatePattern,
  validateTopic
};
//# sourceMappingURL=pan-validation.js.map
