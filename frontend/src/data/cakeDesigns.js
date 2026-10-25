const cakePhotoIds = [
  5140055, 19036040, 17321240, 18613263, 15564375, 33759172,
  32552698, 7711168, 29388914, 27501163, 19758069, 16935947,
  7180854, 38595765, 35578144, 38668377, 7552737, 38595764,
  11753321, 25559070, 31482552, 18127556, 14160778, 10949655,
  8015236, 20009393, 33173914, 35241183, 32290116, 30575906
];

const cakeDesigns = [
  { id: 'chocolate-rose-garden', name: 'Chocolate Rose Garden', category: 'Birthday', flavor: 'Dutch Truffle Chocolate Fudge', frosting: 'Belgian Dark Ganache', color: '#542b3b', accent: '#f3a4b8', decor: '🌹', background: '#fff1f2' },
  { id: 'golden-drip-celebration', name: 'Golden Drip Celebration', category: 'Birthday', flavor: 'Vanilla Bean White Chocolate', frosting: 'Swiss Buttercream', color: '#f2c879', accent: '#fff5d6', decor: '✨', background: '#fff8e7' },
  { id: 'red-velvet-rosette', name: 'Red Velvet Rosette', category: 'Birthday', flavor: 'Velvet Royale Strawberry Cream', frosting: 'Swiss Buttercream', color: '#a52d4d', accent: '#ffe0e8', decor: '🌸', background: '#fff0f3' },
  { id: 'berry-crown', name: 'Fresh Berry Crown', category: 'Birthday', flavor: 'Vanilla Bean White Chocolate', frosting: 'Swiss Buttercream', color: '#f6dce5', accent: '#bf315b', decor: '🍓', background: '#fff3f7' },
  { id: 'midnight-ganache', name: 'Midnight Ganache', category: 'Birthday', flavor: 'Dutch Truffle Chocolate Fudge', frosting: 'Belgian Dark Ganache', color: '#29243d', accent: '#c7a2ff', decor: '⭐', background: '#f3efff' },
  { id: 'pastel-confetti', name: 'Pastel Confetti', category: 'Birthday', flavor: 'Vanilla Bean White Chocolate', frosting: 'Swiss Buttercream', color: '#f3a9bb', accent: '#8fc9df', decor: '🎉', background: '#fdf0f5' },
  { id: 'ivory-pearl-tier', name: 'Ivory Pearl Tier', category: 'Wedding', flavor: 'Vanilla Bean White Chocolate', frosting: 'Royal Fondant', color: '#fff9eb', accent: '#d3b477', decor: '🤍', background: '#faf6ed' },
  { id: 'gold-leaf-elegance', name: 'Gold Leaf Elegance', category: 'Wedding', flavor: 'Vanilla Bean White Chocolate', frosting: 'Royal Fondant', color: '#f4e8ca', accent: '#c49a42', decor: '✨', background: '#fcf6e9' },
  { id: 'blush-floral-tier', name: 'Blush Floral Tier', category: 'Wedding', flavor: 'Velvet Royale Strawberry Cream', frosting: 'Swiss Buttercream', color: '#f4c4cd', accent: '#ad4965', decor: '🌷', background: '#fff1f4' },
  { id: 'midnight-wedding', name: 'Midnight Wedding', category: 'Wedding', flavor: 'Dutch Truffle Chocolate Fudge', frosting: 'Royal Fondant', color: '#343244', accent: '#e4c16c', decor: '💍', background: '#f4f1f7' },
  { id: 'white-rose-cascade', name: 'White Rose Cascade', category: 'Wedding', flavor: 'Vanilla Bean White Chocolate', frosting: 'Swiss Buttercream', color: '#fffdf7', accent: '#d9a7b2', decor: '🌹', background: '#f8f5f1' },
  { id: 'sage-and-gold', name: 'Sage & Gold', category: 'Wedding', flavor: 'Black Forest Cherry Royale', frosting: 'Royal Fondant', color: '#a9b5a0', accent: '#d6ba73', decor: '🌿', background: '#f2f5ed' },
  { id: 'rose-gold-hearts', name: 'Rose Gold Hearts', category: 'Anniversary', flavor: 'Velvet Royale Strawberry Cream', frosting: 'Swiss Buttercream', color: '#edc2c2', accent: '#bf7e78', decor: '💗', background: '#fff2f1' },
  { id: 'velvet-romance', name: 'Velvet Romance', category: 'Anniversary', flavor: 'Velvet Royale Strawberry Cream', frosting: 'Belgian Dark Ganache', color: '#842d48', accent: '#f2c1ce', decor: '❤️', background: '#faedf1' },
  { id: 'champagne-bloom', name: 'Champagne Bloom', category: 'Anniversary', flavor: 'Vanilla Bean White Chocolate', frosting: 'Swiss Buttercream', color: '#f0dfbd', accent: '#b89767', decor: '🥂', background: '#fbf4e7' },
  { id: 'berry-love', name: 'Berry Love', category: 'Anniversary', flavor: 'Black Forest Cherry Royale', frosting: 'Swiss Buttercream', color: '#e9bdca', accent: '#7f2948', decor: '🍒', background: '#fff0f4' },
  { id: 'minimal-love', name: 'Minimal Love', category: 'Anniversary', flavor: 'Vanilla Bean White Chocolate', frosting: 'Royal Fondant', color: '#fff8ef', accent: '#b85b62', decor: '♡', background: '#faf4ee' },
  { id: 'golden-anniversary', name: 'Golden Anniversary', category: 'Anniversary', flavor: 'Dutch Truffle Chocolate Fudge', frosting: 'Belgian Dark Ganache', color: '#493239', accent: '#d4b15e', decor: '💛', background: '#f8f1df' },
  { id: 'rainbow-sprinkle', name: 'Rainbow Sprinkle', category: 'Kids', flavor: 'Vanilla Bean White Chocolate', frosting: 'Swiss Buttercream', color: '#9b8ee8', accent: '#f1a8c8', decor: '🌈', background: '#f6f0ff' },
  { id: 'dino-adventure', name: 'Dino Adventure', category: 'Kids', flavor: 'Dutch Truffle Chocolate Fudge', frosting: 'Swiss Buttercream', color: '#77a66d', accent: '#d6a56d', decor: '🦕', background: '#eff7e9' },
  { id: 'unicorn-dream', name: 'Unicorn Dream', category: 'Kids', flavor: 'Velvet Royale Strawberry Cream', frosting: 'Swiss Buttercream', color: '#e6a8d5', accent: '#9b8ee8', decor: '🦄', background: '#fbf0fc' },
  { id: 'space-explorer', name: 'Space Explorer', category: 'Kids', flavor: 'Dutch Truffle Chocolate Fudge', frosting: 'Belgian Dark Ganache', color: '#35345f', accent: '#80cee1', decor: '🚀', background: '#eff3ff' },
  { id: 'safari-friends', name: 'Safari Friends', category: 'Kids', flavor: 'Black Forest Cherry Royale', frosting: 'Swiss Buttercream', color: '#d3a967', accent: '#70945e', decor: '🦁', background: '#fbf3e3' },
  { id: 'mermaid-lagoon', name: 'Mermaid Lagoon', category: 'Kids', flavor: 'Vanilla Bean White Chocolate', frosting: 'Swiss Buttercream', color: '#78c8c5', accent: '#bb8ee5', decor: '🧜‍♀️', background: '#eafafa' },
  { id: 'vanilla-pearl-minimal', name: 'Vanilla Pearl Minimal', category: 'Minimal', flavor: 'Vanilla Bean White Chocolate', frosting: 'Royal Fondant', color: '#fffaf0', accent: '#d6c9ab', decor: '🤍', background: '#f8f6ef' },
  { id: 'cocoa-brushstroke', name: 'Cocoa Brushstroke', category: 'Minimal', flavor: 'Dutch Truffle Chocolate Fudge', frosting: 'Belgian Dark Ganache', color: '#66483c', accent: '#d6a982', decor: '🎨', background: '#f6eee8' },
  { id: 'pistachio-garden', name: 'Pistachio Garden', category: 'Minimal', flavor: 'Vanilla Bean White Chocolate', frosting: 'Swiss Buttercream', color: '#a7b88a', accent: '#e4d7a8', decor: '🌿', background: '#f2f6e9' },
  { id: 'citrus-fresh', name: 'Citrus Fresh', category: 'Minimal', flavor: 'Vanilla Bean White Chocolate', frosting: 'Swiss Buttercream', color: '#f4d778', accent: '#fff1ad', decor: '🍋', background: '#fff9df' },
  { id: 'blueberry-cloud', name: 'Blueberry Cloud', category: 'Minimal', flavor: 'Velvet Royale Strawberry Cream', frosting: 'Swiss Buttercream', color: '#a7b3e0', accent: '#e4c7d9', decor: '🫐', background: '#f0f2ff' },
  { id: 'mocha-marble', name: 'Mocha Marble', category: 'Minimal', flavor: 'Dutch Truffle Chocolate Fudge', frosting: 'Belgian Dark Ganache', color: '#967562', accent: '#ead8c6', decor: '☕', background: '#f7f0e9' }
];

const categoryDescriptions = {
  Birthday: 'A joyful celebration cake finished with festive piping and a personal message.',
  Wedding: 'An elegant centerpiece with refined fondant details, ideal for a wedding table.',
  Anniversary: 'A romantic handcrafted cake with delicate accents for a special milestone.',
  Kids: 'A colorful playful cake, decorated by hand for a memorable kids’ celebration.',
  Minimal: 'A clean, modern cake with a smooth finish and carefully placed decoration.'
};

export const CAKE_DESIGNS = cakeDesigns.map((design, index) => ({
  ...design,
  image: `https://images.pexels.com/photos/${cakePhotoIds[index]}/pexels-photo-${cakePhotoIds[index]}.jpeg?auto=compress&cs=tinysrgb&w=600`,
  description: categoryDescriptions[design.category]
}));
