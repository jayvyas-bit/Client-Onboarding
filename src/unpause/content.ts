import type { SectionSpec } from "./types.js";

const LOGO_RELEVANT_OPTIONS = [
  "A new logo",
  "Refreshing or redesigning an existing logo",
  "A complete brand identity (logo, colors, typography, visual direction)",
  "I'm not entirely sure what I need yet",
];

function wantsLogoWork(answers: Record<string, unknown>): boolean {
  const selected = answers["q4.main"];
  if (!Array.isArray(selected) || selected.length === 0) return true;
  return selected.some((option) => LOGO_RELEVANT_OPTIONS.includes(option));
}

function hasSpecificLaunchDate(answers: Record<string, unknown>): boolean {
  return answers["q25.main"] === "I have a specific launch date";
}

function hasMaxBudget(answers: Record<string, unknown>): boolean {
  return answers["q27.main"] === "Yes — I have a maximum budget";
}

export const INTRO = {
  eyebrow: "THE UNBRIEF",
  title: "A little about you. A lot about what could be.",
  body: "Before we make anything, we'd love to get to know you, your world, and what you're imagining. No design terminology, no finished strategy, no perfectly tidy answers needed. A strong opinion and a good reference are plenty, and this is a conversation, not a test.",
  time: "About 10–15 minutes.",
  teamNote:
    "You'll hear from Vera, Iris, and Dex, our AI team, built to make this first conversation useful. A human reviews everything you share.",
};

export const THANK_YOU = {
  title: "A little curiosity goes a long way.",
  body: [
    "Thank you for sharing a piece of your world with us.",
    "Vera, Iris, and Dex have done the introductions. Now it's our turn.",
    "The Unpause team will review what you've shared and use it to prepare a thoughtful starting point for our conversation.",
    "No generic pitch. No unnecessary assumptions. Just a better-informed beginning.",
  ],
  cta: "We'll be in touch.",
  signoff: "Until then, keep making things.",
};

export const SECTIONS: SectionSpec[] = [
  {
    id: "hello-you",
    number: "01",
    title: "HELLO, YOU.",
    host: "With Vera",
    intro: "First, the introductions. Nothing too ceremonial.",
    questions: [
      {
        id: "q1",
        number: 1,
        prompt: "Who are we meeting?",
        parts: [
          {
            id: "main",
            part: {
              kind: "fields",
              fields: [
                { id: "name", label: "Your name", required: true },
                { id: "email", label: "Best email to reach you", required: true, type: "email" },
                { id: "role", label: "Your role" },
                { id: "brand", label: "Brand / business name" },
                { id: "website", label: "Website or social media profile" },
                { id: "location", label: "Where are you based? (City / country)" },
              ],
            },
          },
        ],
      },
      {
        id: "q2",
        number: 2,
        prompt: "Tell us a little about what you do.",
        helper:
          "Imagine you're introducing your brand to someone who's never heard of it. What do you make, sell, or offer? How did it begin? A sentence is fine. A story is welcome.",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
      {
        id: "q3",
        number: 3,
        prompt: "Where is your brand in its journey?",
        helper: "Choose the closest fit.",
        parts: [
          {
            id: "main",
            part: {
              kind: "single-select",
              options: [
                "Just getting started",
                "Already selling, but still building our identity",
                "Established and ready to grow",
                "Rebranding or changing direction",
                "Launching something new under an existing brand",
                "Somewhere in between",
              ],
            },
          },
        ],
      },
      {
        id: "q4",
        number: 4,
        prompt: "What brings you to Unpause?",
        helper: "What would you like us to work on together? Select all that apply.",
        parts: [
          {
            id: "main",
            part: {
              kind: "multi-select",
              options: [
                "A new logo",
                "Refreshing or redesigning an existing logo",
                "A complete brand identity (logo, colors, typography, visual direction)",
                "Packaging, labels, tags, or branded materials",
                "Social media branding and templates",
                "Website design",
                "Website development or e-commerce",
                "A digital product or experience",
                "Creative direction or brand strategy",
                "Ongoing design and development support",
                "I'm not entirely sure what I need yet",
              ],
              allowOther: true,
            },
          },
        ],
      },
      {
        id: "q5",
        number: 5,
        prompt: "Why this project, and why now?",
        helper:
          "Is there a launch coming up? Has your business grown? Does your current branding no longer feel right? Or is it simply time to give your work the identity it deserves? We're interested in what prompted the decision, not just the deliverable.",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
      {
        id: "q6",
        number: 6,
        prompt: "What would make you say, \"Yes. That's exactly what I wanted\"?",
        helper: "Picture this project finished, six months from now, and you're genuinely glad you did it. What's different?",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
    ],
  },
  {
    id: "the-people",
    number: "02",
    title: "THE PEOPLE ON THE OTHER SIDE.",
    host: "With Vera & Iris",
    intro: "Your brand doesn't exist in a vacuum. Let's talk about the people who find their way to it.",
    questions: [
      {
        id: "q7",
        number: 7,
        prompt: "Who are your people?",
        helper: "Who buys from you today, and who would you love to reach? Think interests, lifestyles, habits, or values.",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
      {
        id: "q8",
        number: 8,
        prompt: "Why do people choose what you make or offer?",
        helper: "Choose anything that feels true.",
        parts: [
          {
            id: "main",
            part: {
              kind: "multi-select",
              options: [
                "The design or aesthetic",
                "Quality and craftsmanship",
                "Something unique or difficult to find elsewhere",
                "Personalization or customization",
                "Functionality and practicality",
                "The story behind the brand",
                "Price and accessibility",
                "Supporting independent or small businesses",
                "The experience of buying from us",
                "I'm still discovering this",
              ],
              allowOther: true,
            },
          },
        ],
      },
      {
        id: "q9",
        number: 9,
        prompt: "When someone encounters your brand for the first time, what would you love them to think?",
        helper: "This covers the whole brand, logo included. Pick up to three, or write your own.",
        parts: [
          {
            id: "main",
            part: {
              kind: "multi-select",
              maxSelect: 3,
              options: [
                "\"I want one.\"",
                "\"This feels really well made.\"",
                "\"I've never seen anything quite like it.\"",
                "\"This feels like my kind of brand.\"",
                "\"There's so much personality here.\"",
                "\"This feels thoughtful and intentional.\"",
                "\"This looks like something I'd treasure.\"",
                "\"I trust the quality.\"",
                "\"I want to know the person behind this.\"",
                "\"This feels handmade and crafted.\"",
                "\"This feels bold and confident.\"",
                "\"This feels warm and approachable.\"",
              ],
              allowOther: true,
            },
          },
        ],
      },
    ],
  },
  {
    id: "your-world",
    number: "03",
    title: "YOUR WORLD, YOUR RULES.",
    host: "With Iris",
    intro:
      "Hi, I'm Iris. I look after the design side of things. You don't need to explain your taste like a designer. In fact, I'd rather you didn't try. Show me what you're drawn to, what puts you off, and what feels unmistakably yours. We'll find the patterns together.",
    questions: [
      {
        id: "q10",
        number: 10,
        prompt: "If your brand were a place someone could walk into, where would they be?",
        helper: "A boutique? A quiet gallery? Somewhere that doesn't exist yet? Describe it however you like.",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
      {
        id: "q11",
        number: 11,
        prompt: "Let's get a feel for your brand's personality.",
        helper:
          "Imagine a sliding scale between each pair. Where would you place your brand? Somewhere in the middle is perfectly valid. Contradictions are welcome, too.",
        parts: [
          {
            id: "main",
            part: {
              kind: "scale-pairs",
              pairs: [
                ["Understated", "Expressive"],
                ["Playful", "Serious"],
                ["Minimal", "Detailed"],
                ["Familiar", "Unexpected"],
                ["Soft", "Bold"],
                ["Timeless", "Trend-driven"],
                ["Refined", "Eclectic"],
                ["Organic", "Structured"],
              ],
            },
          },
        ],
      },
      {
        id: "q12",
        number: 12,
        prompt: "Show me something you love.",
        helper:
          "It doesn't have to be another logo. It could be a bag, a fabric, a vintage label, a piece of jewelry, a magazine cover, a café, a typeface, a photograph, a movie, or another brand. Share up to three references if you'd like. You can upload images, paste links, or describe them.",
        parts: [
          {
            id: "references",
            part: {
              kind: "upload-or-text",
              placeholder: "Paste links, or describe your references here...",
            },
          },
        ],
      },
      {
        id: "q12b",
        number: 13,
        prompt: "For each one, what exactly draws you to it?",
        helper: "The colors? The lettering? The texture? The attitude? The way it makes you feel?",
        parts: [{ id: "why", part: { kind: "long-text" } }],
      },
      {
        id: "q13",
        number: 14,
        prompt: "Now tell me what you absolutely don't want.",
        helper: "Any colors, styles, or trends you'd rather avoid? What you don't like is often just as useful as what you do.",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
      {
        id: "q14",
        number: 15,
        prompt: "What's something about your brand that would be difficult for someone else to replicate?",
        helper:
          "Think process, materials, a personal story, how you see things, or something visual — a color, shape, texture, or detail that already feels distinctive. Not a slogan, just what makes it yours.",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
    ],
  },
  {
    id: "the-logo",
    number: "04",
    title: "LET'S TALK ABOUT THE LOGO.",
    host: "With Iris",
    intro:
      "Now we're getting into the good stuff. A logo has a fairly small job description for something expected to represent an entire brand. Let's make sure we understand where it needs to work, what it needs to say, and what it doesn't need to explain.",
    condition: wantsLogoWork,
    questions: [
      {
        id: "q15",
        number: 16,
        prompt: "What name should appear in your logo?",
        helper:
          "Please include the exact spelling, capitalization, and punctuation you'd like us to consider. If you haven't decided on the final wording, that's okay.",
        parts: [
          {
            id: "main",
            part: {
              kind: "fields",
              fields: [
                { id: "brandName", label: "Brand name" },
                { id: "tagline", label: "Tagline, if any" },
                {
                  id: "alternates",
                  label: "Any initials, abbreviations, or alternative names you're open to exploring?",
                },
              ],
            },
          },
        ],
      },
      {
        id: "q16",
        number: 17,
        prompt: "What kind of logo are you imagining?",
        helper: "Choose anything you're drawn to. We can explore more than one direction.",
        parts: [
          {
            id: "main",
            part: {
              kind: "multi-select",
              options: [
                "A typography-led logo, where the brand name is the main feature",
                "A symbol or icon alongside the brand name",
                "A monogram or initials",
                "A hand-drawn or illustrated approach",
                "A combination of lettering and a distinctive visual element",
                "I'm open to the designer's interpretation",
                "I'm not familiar with the differences yet",
              ],
            },
          },
        ],
      },
      {
        id: "q18",
        number: 18,
        prompt: "Should your logo tell people what you make, or should it tell them who you are?",
        helper:
          "For example, a handmade bag brand might use a bag or stitch-inspired symbol, and a software tool might choose an abstract mark with no literal tie to what it does. Both are valid, just different bets. Which direction feels more interesting to you?",
        parts: [
          {
            id: "main",
            part: {
              kind: "single-select",
              options: [
                "I want people to immediately understand what I sell",
                "I want a distinctive identity that represents the brand beyond the product",
                "I'd love a clever balance of both",
                "I'm open to exploring",
              ],
            },
          },
        ],
      },
      {
        id: "q18b",
        number: 19,
        prompt: "Why does that direction appeal to you?",
        parts: [{ id: "why", part: { kind: "long-text" } }],
      },
      {
        id: "q19",
        number: 20,
        prompt: "Where will your logo need to live?",
        helper:
          "Think beyond Instagram. A good identity needs to work in the places your customers actually encounter it. Select all that apply.",
        parts: [
          {
            id: "main",
            part: {
              kind: "multi-select",
              options: [
                "Instagram / social media profile",
                "Social media posts and stories",
                "Product labels or fabric tags",
                "Sewn-in or woven labels",
                "Hang tags",
                "Packaging, boxes, or mailers",
                "Stickers and thank-you cards",
                "Business cards",
                "Website or online shop",
                "Market stalls, pop-ups, or signage",
                "Printed merchandise",
              ],
              allowOther: true,
            },
          },
        ],
      },
      {
        id: "q19b",
        number: 21,
        prompt:
          "One practical detail: will any of these have size, material, color, or printing limitations we should consider?",
        helper: "For example, a beautifully detailed logo might not translate well to a tiny woven label.",
        parts: [{ id: "limitations", part: { kind: "long-text" } }],
      },
      {
        id: "q20",
        number: 22,
        prompt: "What would you like us to hand over at the end?",
        helper: "Select what you think you'll need. We'll clarify the exact deliverables together before preparing a proposal.",
        parts: [
          {
            id: "main",
            part: {
              kind: "multi-select",
              options: [
                "Primary logo",
                "Secondary or alternate logo",
                "Small icon / monogram",
                "Logo variations for light and dark backgrounds",
                "Black-and-white versions",
                "Brand color palette",
                "Typography recommendations",
                "Mini brand guidelines explaining how to use everything",
                "Social media profile image / basic branded assets",
                "Packaging, label, or tag design",
                "Editable or production-ready logo files",
                "Not sure yet — I'd appreciate a recommendation",
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "working-with",
    number: "05",
    title: "WHAT WE'RE WORKING WITH.",
    host: "With Vera",
    intro: "Thanks, Iris. Let's look at what's already in place and what this project actually needs.",
    questions: [
      {
        id: "q22",
        number: 23,
        prompt: "What do you already have?",
        helper: "Choose everything that applies.",
        parts: [
          {
            id: "main",
            part: {
              kind: "multi-select",
              options: [
                "An existing logo",
                "Brand colors or fonts",
                "Product photography",
                "Packaging or labels",
                "A social media presence",
                "An online shop or website",
                "Existing design files",
                "Previous logo concepts or sketches",
                "Brand guidelines",
                "Nothing formal yet — we're starting fresh",
              ],
            },
          },
        ],
      },
      {
        id: "q22b",
        number: 24,
        prompt: "Share any relevant links or files.",
        parts: [{ id: "links", part: { kind: "upload-or-text" } }],
      },
      {
        id: "q23",
        number: 25,
        prompt: "What should we keep, change, or leave behind?",
        helper:
          "If you're updating an existing identity, what still works? If you're starting fresh, are there things about your products, business, or current aesthetic that you definitely want to preserve?",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
      {
        id: "q24",
        number: 26,
        prompt: "Are there other brands you'd like us to know about?",
        helper: "Competitors, similar brands, or ones you just admire. Names, handles, or links are all fine.",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
    ],
  },
  {
    id: "making-it-real",
    number: "06",
    title: "MAKING IT REAL.",
    host: "With Vera",
    intro:
      "Let's talk about the practical side. These answers help us put together a realistic scope and proposal without guessing at your resources or priorities.",
    questions: [
      {
        id: "q25",
        number: 27,
        prompt: "When would you ideally like this project completed?",
        parts: [
          {
            id: "main",
            part: {
              kind: "single-select",
              options: [
                "As soon as reasonably possible",
                "Within the next 2–4 weeks",
                "Within the next 1–2 months",
                "Within the next 3 months",
                "I have a specific launch date",
                "I'm flexible",
                "I'm just exploring for now",
              ],
            },
          },
        ],
      },
      {
        id: "q25b",
        number: 28,
        prompt: "What's the date?",
        helper: "And is it connected to a launch, event, collection, market, or other important milestone?",
        condition: hasSpecificLaunchDate,
        parts: [{ id: "date", part: { kind: "short-text" } }],
      },
      {
        id: "q26",
        number: 29,
        prompt: "What's your preferred investment range? (USD)",
        helper:
          "Let's talk investment. Have you thought about how much you'd like to invest in this project? We ask because there are different ways to approach a creative brief. Understanding your budget helps us recommend a scope that makes sense rather than proposing work you don't need.",
        parts: [
          {
            id: "main",
            part: {
              kind: "single-select",
              options: [
                "Under $500",
                "500–1,500",
                "1,500–3,000",
                "3,000–5,000",
                "5,000–10,000",
                "$10,000+",
                "I have a specific amount in mind",
                "I haven't decided yet",
                "I'd like guidance on what's realistic",
              ],
            },
          },
        ],
      },
      {
        id: "q27",
        number: 30,
        prompt: "Do you have an absolute spending ceiling?",
        helper:
          "In other words, is there a maximum amount you cannot or do not want to go beyond for this project? Your preferred investment and your maximum budget don't have to be the same. Knowing both helps us respect your boundaries.",
        parts: [
          {
            id: "main",
            part: {
              kind: "single-select",
              options: [
                "Yes — I have a maximum budget",
                "I have a preferred budget, but some flexibility",
                "No fixed ceiling yet",
                "I'd rather discuss this directly",
              ],
            },
          },
        ],
      },
      {
        id: "q27b",
        number: 31,
        prompt: "What's your maximum budget?",
        condition: hasMaxBudget,
        parts: [{ id: "amount", part: { kind: "short-text", placeholder: "e.g. $2,000" } }],
      },
      {
        id: "q28",
        number: 32,
        prompt: "If we needed to prioritize, what's most important to you?",
        helper: "Choose up to three.",
        parts: [
          {
            id: "main",
            part: {
              kind: "multi-select",
              maxSelect: 3,
              options: [
                "Staying within budget",
                "Getting the creative direction exactly right",
                "Having several concepts to consider",
                "Receiving a polished, versatile logo",
                "Having a broader visual identity system",
                "Getting everything ready for print and packaging",
                "Launching by a particular date",
                "Leaving room for future brand growth",
                "An efficient process with clear milestones",
              ],
            },
          },
        ],
      },
      {
        id: "q29",
        number: 33,
        prompt: "Who will be involved in making decisions?",
        parts: [
          {
            id: "main",
            part: {
              kind: "single-select",
              options: ["Just me", "Me and a business partner", "A small team", "Several stakeholders"],
              allowOther: true,
            },
          },
        ],
      },
      {
        id: "q29b",
        number: 34,
        prompt: "And how do you prefer to collaborate?",
        parts: [
          {
            id: "style",
            part: {
              kind: "single-select",
              options: [
                "I'd love you to explore and present your recommendations",
                "I prefer to be closely involved throughout",
                "A balance of both",
                "I'm open to what works best",
              ],
            },
          },
        ],
      },
      {
        id: "q30",
        number: 35,
        prompt: "Are you looking for a defined design service or a longer-term creative partner?",
        parts: [
          {
            id: "main",
            part: {
              kind: "single-select",
              options: [
                "Just this project for now",
                "This project, with possible additions later",
                "Ongoing creative support",
                "I'm open to exploring what makes sense",
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "one-last-thing",
    number: "07",
    title: "ONE LAST THING.",
    host: "With Vera",
    intro: "Almost done. Here's your chance to tell us anything our questions missed.",
    questions: [
      {
        id: "q31",
        number: 36,
        prompt: "Is there something we haven't asked that you wish we had?",
        helper:
          "A wild idea, a concern, an important constraint, an inside story, or something you haven't quite figured out how to articulate. We're listening.",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
      {
        id: "q32",
        number: 37,
        prompt: "Finish this thought, if you'd like:",
        helper: "\"If we could make just one thing possible with this project, it would be __________.\"",
        parts: [{ id: "main", part: { kind: "long-text" } }],
      },
    ],
  },
];
