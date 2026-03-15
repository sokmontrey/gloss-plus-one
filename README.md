# GlossPlusOne (gloss+1)

<div align="center">
A Chrome browser extension for immersive language learning<br>
Built at Hack Canada 2026 🇨🇦<br>
</div>

## 🌟 Overview
GlossPlusOne (g+1) is an intelligent language learning overlay that transforms your everyday browsing into an immersive language learning experience. 

## What's this random ahh sounding name?
Let's address this. 
- Gloss = the saying of "glossing over something"
- Plus One = Krashen's i + 1 Hypothesis (Input Hypothesis)

## ✨ Key Features
- 🔍 **Instant Translation Overlay** - Highlight any text to see translations with contextual definitions
- 🗣️ **Text-to-Speech Pronunciation** - Hear native pronunciations for words and phrases
- 📚 **AI-Powered Glossary** - Context-aware definitions powered by Gemini and Groq
- 🧠 **Continuous Memory** - Language progress syncs continuously with an AI assistant through Backboard
- 🎯 **Self-Assessment "Try Out" Mode** - Select English text sections and test your translation skills
- 🎮 **Gamified Learning** - Earn scores and track your progress as you learn
- 🌍 **Multi-Language Support** - Learn multiple languages while browsing naturally
- ⚡ **Seamless Integration** - Works on any website without disrupting your browsing

## 🎯 How It Works
1. **Browse Naturally** - Visit any website in your target language
2. **Highlight & Learn** - Select words or phrases you don't understand
3. **Get Instant Help** - See translations, definitions, and hear pronunciations
4. **Practice & Test** - Use "Try Out" mode to translate sections and get scored
5. **Level Up** - Track your progress and improve over time

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- NPM or PNPM
- Google Chrome Browser
- **API Keys**:
  - Google Gemini API Key
  - Groq API Key
  - ElevenLabs API Key
  - Backboard API Key and Assistant ID

### Installation & Configuration
1. Clone the repository:
   ```bash
   git clone https://github.com/sokmontrey/gloss-plus-one.git
   cd gloss-plus-one
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root directory and add your API credentials:
   ```ini
   VITE_GEMINI_API_KEY=your_gemini_key_here
   VITE_GROQ_API_KEY=your_groq_key_here
   VITE_ELEVENLABS_API_KEY=your_elevenlabs_key_here
   VITE_BACKBOARD_API_KEY=your_backboard_key_here
   VITE_BACKBOARD_ASSISTANT_ID=your_backboard_assistant_id_here
   ```

## 💻 Development

### Tech Stack
- **Frontend**: React, TypeScript, Chrome Extension API (Manifest V3), Shadcn UI, Vite
- **AI/ML**: Google Gemini API, Groq API (LLaMA inference)
- **Text-to-Speech**: ElevenLabs API / Web Speech API
- **Styling**: Tailwind CSS

### Setup for Development
Run the local Vite development server:
```bash
npm run dev
```

### Building
To build a production bundle for the Chrome Extension store:
```bash
npm run build
```
Once built, the production files will be placed inside the `dist/` directory.

### Loading the Extension in Chrome
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right.
3. Click "Load unpacked" and select the `dist/` folder inside the `gloss-plus-one` project directory.
4. The extension is now active and ready to use!

### Testing
Use `npm run typecheck` to verify TypeScript typings and find regressions:
```bash
npm run typecheck
```

## 🎨 Features Deep Dive

### Translation Overlay
Hover or click highlighted text to see instant translations with contextual definitions that help you understand not just the word, but how it's used. Includes audio pronunciations via ElevenLabs.

### AI-Powered Learning
Our integration with Gemini and Groq provides intelligent, context-aware definitions that adapt to your learning level. The structural translations help parse sentence flow visually.

### Continuous Progress Memory
GlossPlusOne automatically generates progress reports indicating which phrases you know well, what you are reinforcing, and what you are struggling with. This is continuously synced to a backend assistant thread via **Backboard** (`https://app.backboard.io/api`), ensuring long-term learning memory.

### Self-Assessment Mode
Transform passive learning into active practice:
1. Select any section of English text
2. Click "Try Out" to attempt to translate it to your target language
3. Get instant evaluation, a precise visual diff, and 1-5 scoring
4. See assessments mapped directly into your vocabulary bank's progression thresholds!

### Gamification
- Earn points for correct translations directly into your _Assessment Score_.
- Track your learning streaks.
- Consistently achieving high scores quickly bumps phrase confidence levels, unlocking the next tier of language difficulty.
- Monitor progress across different difficulty levels right in the popup overlay or the custom dashboard.

## 🛠️ Usage

### Basic Usage
After installing the extension and configuring your target language via the extension popup (defaulting to Spanish), visit any website. Use your mouse to select foreign text. A floating widget will automatically decode the text for you, adding new phrases straight into your personal "Phrase Bank" for spaced-repetition testing.

### Advanced Features
- **Progression Thresholds**: Tweak the slider inside the popup to control how confidently you want to memorize phrases before GlossPlusOne injects new, highly-complex vocabulary into the pages you read.
- **Page Blacklisting**: If the overlay ruins formatting on a sensitive site (like online banking), quickly click "Disable on this page" in the popup menu.

## 🤝 Contributing
We welcome contributions! This project was built at Hack Canada 2026, and we're excited to continue improving it.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License
Distributed under the MIT License. See `LICENSE` for more information.

## 🏆 Hackathon
Built with ❤️ at Hack Canada 2026

**Awards**
- 🥈 Second Place Overall
- 🥇 SPUR Founder Track - Build a Real Canadian Startup (Top 3)
- 🏅 SPUR Founder Track - Build a Real Canadian Startup (Top 10)

**Links**
- [Devpost Submission](https://devpost.com/software/glossplusone)

**Team**
- Me, I, myself, and a will to love.

### 🙏 Acknowledgments
- The Hack Canada 2026 organizers and sponsors. You guys are cooking.
- Our [HuskyHack](https://huskyhack.ca) Gang from GBP. Thanks for making this adventure less lonely.

## 📧 Contact
For support or questions, feel free to open an issue or reach out to the project maintainers!

## What's next for GlossPlusOne (g+1)

### Immediate Improvements
- [ ] **Polish Text Extraction**: Minimize token input being sent to LLMs by improving our content extraction algorithm to better filter out non-essential page elements
- [ ] **Better Content Differentiation**: Implement a more sophisticated webpage content extraction system that can better determine which words and phrases are worth replacing versus which are UI elements or navigation

### Enhanced Assessment Features
- [ ] **Additional Frictionless Assessment**: Expand on the passive skill tracking to capture more learning signals from user behavior
- [ ] **Pronunciation Practice Self-Test**: Use state-of-the-art speech analysis services to provide users with quick pronunciation correction for phrases

### Language & Technical Expansion
- [ ] **Right-to-Left Language Support**: Deal with RTL languages like Arabic, which require different text handling and UI considerations
- [ ] **Progressive Definition Localization**: Implement the feature where definitions themselves become more and more in the target language as the user acquires necessary words or phrases to explain them - keeping the immersion going even in the learning aids

### Production & Scalability
- [ ] **Centralized Server Architecture**: Make everything production-ready with a centralized server for more efficient processing, word bank generation (which can be reused across users with similar preferences), and informed replacement decisions
- [ ] **Automatic Progression to Sentence Replacement**: Implement automatic switching from phrase replacement to sentence replacement for better embedded context translation once the ratio of target language phrases in the user's bank is high enough

<div align="center">
Happy Learning! 🌍📚<br>
Making language learning natural, one highlight at a time.
</div>
