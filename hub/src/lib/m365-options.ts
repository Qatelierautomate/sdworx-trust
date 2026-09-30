// Client-safe Microsoft 365 connector metadata.
export const M365_CONNECTORS = [
  {
    connectorId: "microsoft_teams",
    label: "Teams chats & channels",
    short: "Teams",
    detail: "Conversations in the channels your knowledge admin has approved.",
    scopes: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "Chat.Read",
      "Channel.ReadBasic",
      "ChannelMessage.Read.All",
    ],
  },
  {
    connectorId: "microsoft_outlook",
    label: "Outlook mail",
    short: "Outlook",
    detail: "Mail in the folders your knowledge admin has approved.",
    scopes: ["openid", "profile", "email", "offline_access", "Mail.Read"],
  },
  {
    connectorId: "microsoft_sharepoint",
    label: "SharePoint sites",
    short: "SharePoint",
    detail: "Pages and libraries on the sites your knowledge admin has approved.",
    scopes: ["openid", "profile", "email", "offline_access", "Sites.Read.All"],
  },
  {
    connectorId: "microsoft_onedrive",
    label: "OneDrive files",
    short: "OneDrive",
    detail: "Documents in the folders your knowledge admin has approved.",
    scopes: ["openid", "profile", "email", "offline_access", "Files.Read"],
  },
] as const;

export type M365ConnectorId = (typeof M365_CONNECTORS)[number]["connectorId"];

export const M365_CONNECTOR_IDS = M365_CONNECTORS.map((connector) => connector.connectorId) as [
  M365ConnectorId,
  ...M365ConnectorId[],
];

export const m365ClientEnvVar = (connectorId: string) =>
  `${connectorId.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`;
