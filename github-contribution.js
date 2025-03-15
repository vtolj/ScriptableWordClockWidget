// This Scriptable uses the Cache module by @evandcoleman
// https://github.com/yaylinda/scriptable/blob/main/Cache.js
// For a detailed guide on importing modules, visit https://docs.scriptable.app/importmodule/
const Cache = importModule('Cache');
const cache = new Cache('github-heatmap');

// Configuration and constants
const GITHUB_USERNAME = args.widgetParameter || "vtolj";
const GITHUB_API_URL = "https://api.github.com/graphql";
const GITHUB_TOKEN = Keychain.get("GITHUB_TOKEN");

if (!GITHUB_TOKEN) {
    throw new Error("❌ GitHub token not found. Please store it in Keychain first.");
}

// New Layout Configuration for Full Widget Coverage
const DAY_COLOR = config.runsInAccessoryWidget ? "#ffffff" : null;
const COLUMNS = 25;   // Number of weeks to display
const ROWS = 10;      // Number of days per week (more than 7 to ensure full coverage)
const CELL_SIZE = 10; // Cell size
const PADDING = 2;
const BORDER_RADIUS = 2;

// Date utilities
function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
}

function getOneYearAgoDate() {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 1);
    return today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
}

// Fetch heatmap data from GitHub or cache
async function getHeatmap() {
    let data = await cache.read(GITHUB_USERNAME, 30);
    if (data) return data;

    const graphqlQuery = `
    {
      user(login: "${GITHUB_USERNAME}") {
        contributionsCollection(from: "${getOneYearAgoDate()}", to: "${getTodayDate()}") {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionLevel,
                color,
                date
              }
            }
          }
        }
      }
    }`;

    const request = new Request(GITHUB_API_URL);
    request.body = JSON.stringify({ query: graphqlQuery });
    request.headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GITHUB_TOKEN
    };
    request.method = "POST";

    try {
        data = await request.loadJSON();
        await cache.write(GITHUB_USERNAME, data);
        return data;
    } catch (error) {
        console.error("❌ Failed to fetch data from GitHub:", error);
        throw new Error("GitHub API request failed.");
    }
}

// Remap function to convert one range of numbers to another
function remap(value, in_min, in_max, out_min, out_max) {
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

// Map GitHub's contribution levels to opacity values
function getLevel(level) {
    const levelMap = {
        "NONE": 0,
        "FIRST_QUARTILE": 1,
        "SECOND_QUARTILE": 2,
        "THIRD_QUARTILE": 3,
        "FOURTH_QUARTILE": 4
    };
    return remap(levelMap[level], 0, 4, 0.1, 1);
}

// Create and configure the widget with the heatmap
async function createWidget() {
    const contributionsData = (await getHeatmap()).data.user.contributionsCollection.contributionCalendar;

    const widget = new ListWidget();
    widget.setPadding(0, 0, 0, 0);

    const weekOffset = Math.max(0, contributionsData.weeks.length - COLUMNS);

    // Generate the heatmap grid
    for (let row = 0; row < ROWS; row++) {
        const rowStack = widget.addStack();
        rowStack.spacing = PADDING;
        rowStack.layoutHorizontally();

        for (let col = 0; col < COLUMNS; col++) {
            const week = contributionsData.weeks[col + weekOffset];
            const day = week?.contributionDays[row % 7]; // Cycle through 7 days per week
            if (!week || !day) {
                // Fill with default if data is missing
                const boxStack = rowStack.addStack();
                boxStack.backgroundColor = new Color("#1e1e1e", 0.1); // Default gray
                boxStack.cornerRadius = BORDER_RADIUS;
                boxStack.size = new Size(CELL_SIZE, CELL_SIZE);
                continue;
            }

            const boxStack = rowStack.addStack();
            boxStack.backgroundColor = new Color(DAY_COLOR || day.color, getLevel(day.contributionLevel));
            boxStack.cornerRadius = BORDER_RADIUS;
            boxStack.size = new Size(CELL_SIZE, CELL_SIZE);
        }

        widget.addStack(rowStack);
        if (row < ROWS - 1) {
            widget.addSpacer(PADDING);
        }
    }

    return widget;
}

// Display the widget
const widget = await createWidget();
if (config.runsInAccessoryWidget) {
    Script.setWidget(widget);
} else {
    widget.presentMedium();
}
Script.complete();