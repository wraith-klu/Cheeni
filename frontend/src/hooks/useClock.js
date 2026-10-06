import React, { useState, useEffect } from "react";

/**
 * Custom hook to maintain live system time, formatted date, and a dynamic greeting.
 *
 * @returns {{ currentTime: string, currentDate: string, greeting: string }}
 */
export function useClock() {
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
      setCurrentDate(
        now.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      );
      const hour = now.getHours();
      if (hour < 12) setGreeting("Good Morning");
      else if (hour < 17) setGreeting("Good Afternoon");
      else setGreeting("Good Evening");
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return { currentTime, currentDate, greeting };
}
