// Personalized feedback messages based on user name
// Frida gets Swedish messages, Morten gets Danish messages

type ActionType = 
  | 'user_updated'
  | 'user_deleted'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'course_updated'
  | 'image_uploaded'
  | 'image_deleted'
  | 'email_sent'
  | 'phone_updated'
  | 'commission_updated'
  | 'contact_logged'
  | 'onboarding_updated'
  | 'credentials_saved'
  | 'general_success';

interface FeedbackMessages {
  [key: string]: {
    [action in ActionType]: string[];
  };
}

const feedbackMessages: FeedbackMessages = {
  "Morten": {
    user_updated: [
      "Boom! Bruger opdateret! Du er hurtig, Morten! ⚡",
      "Perfekt! Brugerdata er gemt! 💪",
      "Done deal! Hvor er du effektiv! 🎯",
    ],
    user_deleted: [
      "Bruger slettet! Clean sweep, Morten! 🧹",
      "Væk med dem! Godt ryddet op! ✨",
    ],
    booking_confirmed: [
      "YES! Booking bekræftet! Pengene ruller! 💰",
      "Bekræftet! En glad kunde mere! 🏌️",
      "Booking i hus! Du er en maskine, Morten! 🔥",
    ],
    booking_cancelled: [
      "Booking annulleret. Onwards and upwards! 💪",
      "Cancelled. Næste booking venter! 🎯",
    ],
    course_updated: [
      "Bane opdateret! Looking sharp! ⛳",
      "Gemt! Du holder styr på tingene! 📋",
      "Perfekt! Banen er up-to-date! ✅",
    ],
    image_uploaded: [
      "Flot billede! Det ser professionelt ud! 📸",
      "Billede uploadet! Banen ser lækker ud! 🌟",
      "Nice! Godt arbejde med billederne! 🎨",
    ],
    image_deleted: [
      "Billede slettet! Ryddet op! 🧹",
      "Væk med det gamle! Plads til nyt! ✨",
    ],
    email_sent: [
      "Email afsted! Du er en kommunikations-ninja! 📧",
      "Sendt! Banerne kan ikke modstå dig! 💌",
      "Email delivered! Partnerships incoming! 🚀",
    ],
    phone_updated: [
      "Telefonnummer rettet! Godt spottet, Morten! 📱",
      "Nummer opdateret! Detaljerne er vigtige! ✅",
      "Perfekt! Nu kan vi nå dem! 📞",
    ],
    commission_updated: [
      "Commission opdateret! Show me the money! 💰",
      "Kickback justeret! Smart move! 📈",
      "Provision gemt! Pengene kommer! 💸",
    ],
    contact_logged: [
      "Kontakt logget! Du holder styr på det hele! 📝",
      "Noteret! Godt med dokumentation! ✍️",
    ],
    onboarding_updated: [
      "Status opdateret! Pipeline looking good! 📊",
      "Nice! Onboarding kører! 🚀",
    ],
    credentials_saved: [
      "Credentials gemt! Nu kører API'en! 🔐",
      "Login-data gemt sikkert! 🔒",
    ],
    general_success: [
      "Done! Hvor er du god, Morten! 🌟",
      "Perfekt! Keep crushing it! 💪",
      "Success! Du gør det bare så godt! 🎯",
    ],
  },
  "Frida": {
    user_updated: [
      "Boom! Användare uppdaterad! Du är snabb, Frida! ⚡",
      "Perfekt! Användardata är sparad! 💪",
      "Klart! Så effektiv du är! 🎯",
    ],
    user_deleted: [
      "Användare borttagen! Snyggt städat, Frida! 🧹",
      "Bort med dem! Bra jobbat! ✨",
    ],
    booking_confirmed: [
      "YES! Bokning bekräftad! Pengarna rullar! 💰",
      "Bekräftad! En nöjd kund till! 🏌️",
      "Bokning i hamn! Du är en maskin, Frida! 🔥",
    ],
    booking_cancelled: [
      "Bokning avbokad. Onwards and upwards! 💪",
      "Avbokad. Nästa bokning väntar! 🎯",
    ],
    course_updated: [
      "Bana uppdaterad! Looking sharp! ⛳",
      "Sparat! Du har koll på allt! 📋",
      "Perfekt! Banan är up-to-date! ✅",
    ],
    image_uploaded: [
      "Snygg bild! Det ser professionellt ut! 📸",
      "Bild uppladdad! Banan ser grym ut! 🌟",
      "Nice! Bra jobbat med bilderna! 🎨",
    ],
    image_deleted: [
      "Bild borttagen! Städat och fint! 🧹",
      "Bort med det gamla! Plats för nytt! ✨",
    ],
    email_sent: [
      "Email iväg! Du är en kommunikations-ninja! 📧",
      "Skickat! Banorna kan inte motstå dig! 💌",
      "Email delivered! Partnerships incoming! 🚀",
    ],
    phone_updated: [
      "Telefonnummer rättat! Bra sett, Frida! 📱",
      "Nummer uppdaterat! Detaljerna är viktiga! ✅",
      "Perfekt! Nu kan vi nå dem! 📞",
    ],
    commission_updated: [
      "Commission uppdaterad! Show me the money! 💰",
      "Kickback justerad! Smart drag! 📈",
      "Provision sparad! Pengarna kommer! 💸",
    ],
    contact_logged: [
      "Kontakt loggad! Du har koll på allt! 📝",
      "Noterat! Bra med dokumentation! ✍️",
    ],
    onboarding_updated: [
      "Status uppdaterad! Pipeline looking good! 📊",
      "Nice! Onboarding rullar! 🚀",
    ],
    credentials_saved: [
      "Credentials sparade! Nu kör API:n! 🔐",
      "Login-data sparat säkert! 🔒",
    ],
    general_success: [
      "Klart! Så duktig du är, Frida! 🌟",
      "Perfekt! Keep crushing it! 💪",
      "Success! Du gör det bara så bra! 🎯",
    ],
  },
};

// Default messages (English) for other users
const defaultMessages: { [action in ActionType]: string[] } = {
  user_updated: ["User updated successfully! ✅"],
  user_deleted: ["User deleted successfully! ✅"],
  booking_confirmed: ["Booking confirmed! 🎉"],
  booking_cancelled: ["Booking cancelled ✅"],
  course_updated: ["Course updated! ⛳"],
  image_uploaded: ["Image uploaded! 📸"],
  image_deleted: ["Image deleted! 🧹"],
  email_sent: ["Email sent! 📧"],
  phone_updated: ["Phone number updated! 📱"],
  commission_updated: ["Commission updated! 💰"],
  contact_logged: ["Contact logged! 📝"],
  onboarding_updated: ["Status updated! 📊"],
  credentials_saved: ["Credentials saved! 🔐"],
  general_success: ["Success! ✅"],
};

export function getPersonalFeedback(firstName: string | undefined, action: ActionType): { title: string; description: string } {
  const name = firstName || "Boss";
  const messages = feedbackMessages[name] || null;
  
  let messagePool: string[];
  if (messages && messages[action]) {
    messagePool = messages[action];
  } else {
    messagePool = defaultMessages[action];
  }
  
  // Pick a random message
  const message = messagePool[Math.floor(Math.random() * messagePool.length)];
  
  // Generate a fun title based on name
  const titles: { [key: string]: string[] } = {
    "Morten": ["Nice, Morten!", "Godt gået!", "Sådan!", "Perfekt!", "Yes!"],
    "Frida": ["Snyggt, Frida!", "Bra jobbat!", "Toppen!", "Perfekt!", "Yes!"],
  };
  
  const titlePool = titles[name] || ["Success!", "Done!", "Great!"];
  const title = titlePool[Math.floor(Math.random() * titlePool.length)];
  
  return { title, description: message };
}

export type { ActionType };
