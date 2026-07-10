const IS_DEV = process.env.APP_ENV === 'development';

export default {
  expo: {
    name: IS_DEV ? "NEXUS Test" : "NEXUS",
    slug: "nexus",
    scheme: [
      "nexus",
      "com.googleusercontent.apps.487589350519-njhmlbtte7vq4oc1edofetjs5539i57j"
    ],
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.noahg.nexus",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleDocumentTypes: [
          {
            CFBundleTypeName: "NEXUS Vault Backup",
            LSHandlerRank: "Owner",
            LSItemContentTypes: [
              "com.noahg.nexus.backup"
            ]
          }
        ],
        UTExportedTypeDeclarations: [
          {
            UTTypeIdentifier: "com.noahg.nexus.backup",
            UTTypeDescription: "NEXUS Vault Backup",
            UTTypeConformsTo: [
              "public.data"
            ],
            UTTypeTagSpecification: {
              "public.filename-extension": [
                "nexus"
              ]
            }
          }
        ]
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "a1a52118-12b3-4d32-87ee-e35984c9322c"
      }
    },
    plugins: [
      "expo-font",
      "expo-secure-store",
      "expo-web-browser",
      [
        "react-native-health",
        {
          "NSHealthShareUsageDescription": "NEXUS requires sleep and HR data to calculate training readiness."
        }
      ]
    ]
  }
};
