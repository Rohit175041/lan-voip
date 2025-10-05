import React from "react";
import "./TimerProgress.css";

export default function TimerProgress({ timeLeft, totalTime = 120 }) {
  const percentage = Math.max(0, Math.round((timeLeft / totalTime) * 100));

  return (
    <div className="progress-container">
      <div
        className="progress-bar"
        style={{ width: `${percentage}%` }}
      ></div>
      <span className="progress-text">
        Waiting... {timeLeft}s
      </span>
    </div>
  );
}
