/**
 * Shared tool definitions. Only LOCAL_COMMAND_TOOLS are exposed to the model
 * until additional operations have dedicated validation and approval policies.
 */

export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "launch_app",
      description: "Launch an application from the supported desktop app allowlist. Unsupported apps are rejected.",
      parameters: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "A supported app alias such as notepad, calculator, chrome, vscode, spotify, or paint.",
          },
        },
        required: ["app_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_app",
      description: "Terminate or close a running application or process on the user's desktop.",
      parameters: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "The name of the application or process to close, e.g., 'notepad', 'calculator', 'chrome'.",
          },
        },
        required: ["app_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "control_volume",
      description: "Control the user's master system audio volume (set level, mute, unmute, step up/down).",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["set", "mute", "unmute", "increase", "decrease", "get"],
            description: "The audio action to perform.",
          },
          level: {
            type: "number",
            description: "Target volume level percentage from 0 to 100 (applicable when action is 'set', 'increase', or 'decrease').",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_window",
      description: "Manipulate open desktop windows (minimize, maximize, restore, snap left, snap right, show desktop).",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["minimize", "maximize", "restore", "snap_left", "snap_right", "show_desktop", "list_open"],
            description: "The window manipulation action to perform.",
          },
          window_title: {
            type: "string",
            description: "Target window title or application name if focusing a specific window.",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_telemetry",
      description: "Fetch real-time laptop diagnostics including battery percentage, charging state, CPU/RAM usage, or current system time.",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: ["battery", "cpu_ram", "specs", "datetime", "all"],
            description: "Specific telemetry or hardware metric to inspect.",
          },
        },
        required: ["metric"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Open a web search or YouTube search URL. This does not read pages or play media.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query string or song title to find.",
          },
          target: {
            type: "string",
            enum: ["google", "youtube", "duckduckgo"],
            description: "Target search engine or media platform.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "capture_screen_context",
      description: "Take a screenshot of the user's active desktop screen to inspect what code, error message, UI, or document is currently visible.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "What to look for or answer regarding the current screen contents.",
          },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_folder",
      description: "Open one of the user's standard folders: home, desktop, documents, or downloads.",
      parameters: {
        type: "object",
        properties: {
          folder: {
            type: "string",
            enum: ["home", "desktop", "documents", "downloads"],
            description: "The standard user folder to open.",
          },
        },
        required: ["folder"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_url",
      description: "Open a specified web address directly in the default browser.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            format: "uri",
            description: "The fully qualified URL to open (e.g., https://github.com, https://leetcode.com).",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "List upcoming events from the user's connected Google Calendar. Requires Google Calendar integration to be connected.",
      parameters: {
        type: "object",
        properties: {
          date_range: {
            type: "object",
            properties: {
              start: {
                type: "string",
                description: "Start of query window in ISO8601 format (e.g. 2026-10-15T00:00:00Z)",
              },
              end: {
                type: "string",
                description: "End of query window in ISO8601 format (e.g. 2026-10-16T23:59:59Z, max 31 days span)",
              },
            },
            required: ["start", "end"],
            additionalProperties: false,
          },
          max_results: {
            type: "number",
            description: "Maximum number of events to return (1-25).",
          },
        },
        required: ["date_range"],
        additionalProperties: false,
      },
    },
  },
];

export const INTEGRATION_TOOLS = AGENT_TOOLS.filter(({ function: tool }) =>
  tool.name === "list_calendar_events"
);

export const LOCAL_COMMAND_TOOLS = AGENT_TOOLS.filter(({ function: tool }) =>
  ["launch_app", "open_folder", "open_url", "get_system_telemetry"].includes(tool.name)
);

for (const { function: tool } of LOCAL_COMMAND_TOOLS) {
  tool.parameters.additionalProperties = false;
}

