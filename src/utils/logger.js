
const COLORS = {
  info: "color:#00BFFF",     // Blue
  warn: "color:#FFA500",     // Orange
  error: "color:#FF4500",    // Red
  success: "color:#00C853",  // Green
  debug: "color:#999999",    // Gray
};

function getTime() {
  return new Date().toLocaleTimeString("en-IN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Unified log function to display level, tag, and message
 */
function print(level, tag, ...args) {
  const color = COLORS[level] || "color:#ccc";
  const time = getTime();
  console.log(`%c[${time}] [%s] [%s]`, color, level.toUpperCase(), tag, ...args);
}

/**
 * Logger object with multiple levels
 */
export const log = {
  info: (tag, ...args) => print("info", tag, ...args),
  warn: (tag, ...args) => print("warn", tag, ...args),
  error: (tag, ...args) => print("error", tag, ...args),
  success: (tag, ...args) => print("success", tag, ...args),
  debug: (tag, ...args) => print("debug", tag, ...args),
};
