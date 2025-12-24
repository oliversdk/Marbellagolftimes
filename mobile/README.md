# Marbella Golf Times - iOS App

React Native/Expo app for booking golf tee times on Costa del Sol.

## Prerequisites

1. **Apple Developer Account** ($99/year) - Required for App Store
2. **Mac with Xcode** - Required for iOS builds
3. **Node.js 18+** installed

## Quick Start

### 1. Install dependencies
```bash
cd mobile
npm install
```

### 2. Install additional required packages
```bash
npx expo install expo-router expo-secure-store expo-location react-native-safe-area-context
```

### 3. Run in development
```bash
# iOS Simulator (requires Mac)
npm run ios

# Or use Expo Go app on your phone
npm run start
```

## Building for App Store

### 1. Setup EAS Build (Expo Application Services)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure
```

### 2. Build for iOS
```bash
# Build for App Store
eas build --platform ios --profile production

# Build for TestFlight (beta testing)
eas build --platform ios --profile preview
```

### 3. Submit to App Store
```bash
eas submit --platform ios
```

## Project Structure

```
mobile/
├── App.tsx              # Main app entry
├── app.json             # Expo configuration
├── src/
│   ├── api/
│   │   └── client.ts    # API client for backend
│   ├── screens/
│   │   └── HomeScreen.tsx
│   ├── components/
│   └── hooks/
└── assets/              # App icons and images
```

## Configuration

### API URL
Set your production API URL in `app.json`:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://marbellagolftimes.com/api"
    }
  }
}
```

### Bundle Identifier
Update in `app.json` for your Apple Developer account:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.marbellagolftimes"
    }
  }
}
```

## App Store Requirements

Before submitting to App Store:

1. **Privacy Policy URL** - Required
2. **App Screenshots** - iPhone 6.5" and 5.5" required
3. **App Description** - Max 4000 characters
4. **Keywords** - For App Store search
5. **Support URL** - Contact page

## Features

- Browse 50+ golf courses on Costa del Sol
- Real-time tee time availability
- Book directly from the app
- Secure payments with Stripe/Apple Pay
- Location-based course discovery
