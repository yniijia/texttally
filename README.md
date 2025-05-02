# TextTally

![TextTally Logo](assets/icon128.png)

> Count smarter, write better

TextTally is a browser extension that provides instant text analysis when you need it. Highlight any text, right-click, and get comprehensive statistics to improve your writing.

## Features

- **Word Count**: Total number of words in selected text
- **Character Count**: Both with and without spaces
- **Reading Time**: Estimated time to read at average speed
- **Keyword Analysis**: See your most frequently used words
- **Readability Score**: Flesch-Kincaid grade level assessment
- **Long Sentence Alerts**: Identifies overly long sentences

## Installation

### Chrome

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the TextTally folder
5. The extension is now installed and ready to use

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select any file in the TextTally folder
5. The extension is now installed and ready to use

## How to Use

1. Select any text on a webpage
2. Right-click on the selected text
3. Click "Analyze with TextTally" from the context menu
4. View your text statistics in the popup window

## Privacy

TextTally respects your privacy:
- All text analysis is performed locally in your browser
- No data is sent to external servers
- No tracking or analytics

## Development

### Project Structure

- `manifest.json`: Extension configuration
- `src/`: Source code files
  - `background.js`: Background script for context menu
  - `content.js`: Content script for text analysis
  - `popup.html/js`: Extension popup UI
- `styles/`: CSS files
- `assets/`: Images and icons

### Building from Source

1. Clone the repository
2. Make your changes
3. Load the extension in developer mode as described in the installation section

## License

MIT License

## Credits

- **Developer**: Tony Fiston ([@yniijia](https://github.com/yniijia))
- Mascot: Buzz the Hummingbird
- Colors: Teal (#00CEC9) + Coral (#FF6B6B)