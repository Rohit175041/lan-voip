import React from "react";
import "./TimerProgress.css";

export default function TimerProgress({ timeLeft }) {
  return (
    <div className="timer">
      <div className="bar-bg">
        <div className="bar" style={{ width: `${(timeLeft / 120) * 100}%` }} />
      </div>
      <p>Waiting... {timeLeft}s</p>
    </div>
  );
}
