const Cache = importModule('Cache');
const cache = new Cache('github-heatmap');

// Configuration and constants
const GITHUB_USERNAME = args.widgetParameter || "vtolj";
const GITHUB_TOKEN = "GITHUB_TOKEN";
const GITHUB_API_URL = "https://api.github.com/graphql";

const DAY_COLOR = config.runsInAccessoryWidget ? "#ffffff" : null;
const COLUMNS = 16;
const ROWS = 7;
const CELL_SIZE = 9;  // Increased cell size for better visibility
const PADDING = 1;    // Reduced padding for optimal spacing
const BORDER_RADIUS = 3;  // Larger corner radius for modern look

// Fetch heatmap data from GitHub or cache
async function getHeatmap() {
    let data = await cache.read(GITHUB_USERNAME, 30);
    if (data) return data;

    const graphqlQuery = `
    {
      user(login: "${GITHUB_USERNAME}") {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionLevel,
                color
              }
            }
          }
        }
      }
    }
  `;

    const request = new Request(GITHUB_API_URL);
    request.body = JSON.stringify({ query: graphqlQuery });
    request.headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GITHUB_TOKEN
    };
    request.method = "POST";

    data = await request.loadJSON();
    await cache.write(GITHUB_USERNAME, data);
    return data;
}

// Custom Visibility Enhancements
function getLevel(level) {
    const levelMap = {
        "NONE": 0,
        "FIRST_QUARTILE": 1,
        "SECOND_QUARTILE": 2,
        "THIRD_QUARTILE": 3,
        "FOURTH_QUARTILE": 4
    };
    return remap(levelMap[level], 0, 4, 0.3, 1);  // Boosted minimum brightness
}

function remap(value, in_min, in_max, out_min, out_max) {
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

// Create and configure the widget with the heatmap
async function createWidget() {
    const contributionsData = (await getHeatmap()).data.user.contributionsCollection.contributionCalendar;

    const widget = new ListWidget();
    widget.setPadding(0, 0, 0, 0);
    const weekOffset = contributionsData.weeks.length - COLUMNS;

    for (let row = 0; row < ROWS; row++) {
        const rowStack = widget.addStack();
        rowStack.spacing = PADDING;
        rowStack.layoutHorizontally();

        for (let col = 0; col < COLUMNS; col++) {
            const day = contributionsData.weeks[col + weekOffset]?.contributionDays[row];
            if (!day) break;

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