export type QueueMessage =
  | { type: "campaign.start"; campaignId: string; cursor?: string }
  | { type: "email.send"; emailId: string };
